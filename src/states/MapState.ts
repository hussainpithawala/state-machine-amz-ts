/**
 * Map state implementation for Amazon States Language.
 *
 * Processes all elements of an array, potentially in parallel,
 * applying a nested state machine (ItemProcessor) to each element.
 */
import {
  BaseState,
  StateError,
  getPathProcessor,
  ValidateOptions,
} from "./base";
import { StateMachine } from "../machine/StateMachine";
import ExecutionImpl from "../../src/execution/ExecutionImpl";

export interface ItemBatcherConfig {
  maxItemsPerBatch?: number | undefined;
  maxInputBytesPerBatch?: number | undefined;
  batchInput?: Record<string, unknown> | undefined;
}

export class ItemBatcher {
  maxItemsPerBatch?: number | undefined;
  maxInputBytesPerBatch?: number | undefined;
  batchInput?: Record<string, unknown> | undefined;

  constructor(config: ItemBatcherConfig) {
    this.maxItemsPerBatch = config.maxItemsPerBatch;
    this.maxInputBytesPerBatch = config.maxInputBytesPerBatch;
    this.batchInput = config.batchInput;
  }
}

export interface MapStateConfig {
  name: string;
  itemProcessor: Record<string, unknown>;
  itemsPath?: string | undefined;
  itemSelector?: Record<string, unknown> | undefined;
  itemBatcher?: ItemBatcherConfig | undefined;
  maxConcurrency?: number | undefined;
  toleratedFailurePercentage?: number | undefined;
  toleratedFailureCount?: number | undefined;

  // BaseState fields
  nextState?: string | undefined;
  end?: boolean | undefined;
  inputPath?: string | undefined;
  resultPath?: string | undefined;
  outputPath?: string | undefined;
  resultSelector?: Record<string, unknown> | undefined;
  comment?: string | undefined;
}

export class MapState extends BaseState {
  itemProcessorDef: Record<string, unknown>;
  itemsPath?: string | undefined;
  itemSelector?: Record<string, unknown> | undefined;
  itemBatcher?: ItemBatcher | undefined;
  maxConcurrency: number;
  toleratedFailurePercentage?: number | undefined;
  toleratedFailureCount?: number | undefined;
  resultSelector: Record<string, unknown> | undefined;

  constructor(config: MapStateConfig) {
    super();
    this.name = config.name;
    this.type = "Map";
    this.itemProcessorDef = config.itemProcessor;
    this.itemsPath = config.itemsPath;
    this.itemSelector = config.itemSelector;
    this.itemBatcher = config.itemBatcher
      ? new ItemBatcher(config.itemBatcher)
      : undefined;
    this.maxConcurrency = config.maxConcurrency ?? 0;
    this.toleratedFailurePercentage = config.toleratedFailurePercentage;
    this.toleratedFailureCount = config.toleratedFailureCount;

    this.nextState = config.nextState;
    this.end = config.end ?? false;
    this.inputPath = config.inputPath;
    this.resultPath = config.resultPath;
    this.outputPath = config.outputPath;
    this.resultSelector = config.resultSelector;
    this.comment = config.comment;

    this.validate();
  }

  override validate(options?: ValidateOptions): void {
    super.validate({ ...options, skipType: true });

    if (
      !this.itemProcessorDef ||
      !this.itemProcessorDef.StartAt ||
      !this.itemProcessorDef.States
    ) {
      throw new Error(
        `Map state '${this.name}' must have a valid ItemProcessor with StartAt and States`,
      );
    }
    if (this.maxConcurrency < 0) {
      throw new Error(`Map state '${this.name}' MaxConcurrency must be >= 0`);
    }
    // Update these checks to only run if the values are explicitly defined
    if (
      this.toleratedFailurePercentage !== undefined &&
      (this.toleratedFailurePercentage < 0 ||
        this.toleratedFailurePercentage > 100)
    ) {
      throw new Error(
        `Map state '${this.name}' ToleratedFailurePercentage must be between 0 and 100`,
      );
    }

    if (
      this.toleratedFailureCount !== undefined &&
      this.toleratedFailureCount < 0
    ) {
      throw new Error(
        `Map state '${this.name}' ToleratedFailureCount must be >= 0`,
      );
    }
  }

  async execute(
    inputData: unknown,
    context?: Record<string, unknown>,
  ): Promise<[unknown, string | undefined]> {
    if (!context) context = {};
    const processor = this._pathProcessor || getPathProcessor();

    try {
      // 1. Apply InputPath
      const effectiveInput = processor.applyInputPath(
        inputData,
        this.inputPath,
      );

      // 2. Get Items Array
      let itemsArray: unknown[];
      if (this.itemsPath) {
        const extracted = processor.applyInputPath(
          effectiveInput,
          this.itemsPath,
        );
        if (!Array.isArray(extracted)) {
          throw new StateError(
            `ItemsPath '${this.itemsPath}' did not resolve to an array`,
            this.name,
            "States.Runtime",
          );
        }
        itemsArray = extracted;
      } else {
        if (!Array.isArray(effectiveInput)) {
          throw new StateError(
            `Effective input is not an array and no ItemsPath is specified`,
            this.name,
            "States.Runtime",
          );
        }
        itemsArray = effectiveInput;
      }

      // 3. Apply ItemSelector
      let selectedItems: unknown[] = itemsArray;
      if (this.itemSelector) {
        selectedItems = itemsArray.map((item) => {
          return this.expandValue(this.itemSelector, { $: item }, processor);
        });
      }

      // 4. Apply ItemBatcher
      let executionItems: unknown[] = selectedItems;
      if (this.itemBatcher) {
        executionItems = this.batchItems(selectedItems);
      }

      // 5. Execute ItemProcessor (Nested State Machine)
      const nestedMachine = StateMachine.fromDict(this.itemProcessorDef);
      const results: unknown[] = new Array(executionItems.length);
      let failureCount = 0;
      const totalItems = executionItems.length;

      const executeItem = async (
        item: unknown,
        index: number,
      ): Promise<void> => {
        // Check tolerance (ASL Spec compliant)
        const hasCount = this.toleratedFailureCount !== undefined;
        const hasPercentage = this.toleratedFailurePercentage !== undefined;
        let exceeded = false;
        let reason = "";

        // If ToleratedFailureCount is explicitly specified, check it
        if (hasCount && failureCount > this.toleratedFailureCount!) {
          exceeded = true;
          reason = `count ${failureCount} > ${this.toleratedFailureCount}`;
        }

        // If ToleratedFailurePercentage is explicitly specified, check it
        if (hasPercentage) {
          const failurePercentage =
            totalItems > 0 ? (failureCount / totalItems) * 100 : 0;
          if (failurePercentage > this.toleratedFailurePercentage!) {
            exceeded = true;
            reason = `percentage ${failurePercentage.toFixed(2)}% > ${this.toleratedFailurePercentage}%`;
          }
        }

        // If NEITHER is specified, default behavior is 0 failures allowed
        if (!hasCount && !hasPercentage && failureCount > 0) {
          exceeded = true;
          reason = `default 0 failures allowed, got ${failureCount}`;
        }

        if (exceeded) {
          throw new StateError(
            `Map state exceeded failure tolerance (${reason})`,
            this.name,
            "States.MapRunFailed",
          );
        }

        try {
          const execCtx = ExecutionImpl.newContext(
            `map-iteration-${index}`,
            nestedMachine.startAt,
            item,
          );
          const result = await nestedMachine.runExecution(execCtx, context);

          if (result.status === "SUCCEEDED") {
            results[index] = result.output;
          } else {
            failureCount++;
            results[index] = {
              Error: result.error?.name || "States.Runtime",
              Cause: result.error?.message || "Iteration failed",
            };
          }
        } catch (err) {
          failureCount++;
          results[index] = {
            Error: err instanceof Error ? err.name : "States.Runtime",
            Cause: err instanceof Error ? err.message : String(err),
          };
        }

        // Check tolerance
        const failurePercentage =
          totalItems > 0 ? (failureCount / totalItems) * 100 : 0;

        if (
          // @ts-ignore
          failureCount > this.toleratedFailureCount ||
          // @ts-ignore
          failurePercentage > this.toleratedFailurePercentage
        ) {
          throw new StateError(
            `Map state exceeded failure tolerance (${failureCount} failures, ${failurePercentage.toFixed(2)}%)`,
            this.name,
            "States.MapRunFailed",
          );
        }
      };

      await this.executeWithConcurrencyLimit(
        executionItems,
        this.maxConcurrency,
        executeItem,
      );

      // 6. Aggregate Results
      let output: unknown = results;

      // 7. Apply ResultSelector
      if (this.resultSelector) {
        output = this.expandValue(
          this.resultSelector,
          { $: results },
          processor,
        );
      }

      // 8. Apply ResultPath
      output = processor.applyResultPath(
        effectiveInput,
        output,
        this.resultPath,
      );

      // 9. Apply OutputPath
      output = processor.applyOutputPath(output, this.outputPath);

      return [output, this.nextState];
    } catch (e) {
      if (e instanceof StateError) throw e;
      throw new StateError(
        `Map state execution failed: ${e instanceof Error ? e.message : String(e)}`,
        this.name,
        "States.Runtime",
      );
    }
  }

  private batchItems(items: unknown[]): unknown[] {
    if (!this.itemBatcher) return items;

    const batches: unknown[] = [];
    let currentBatch: unknown[] = [];
    let currentBatchSize = 0;

    for (const item of items) {
      const itemSize = this.itemBatcher.maxInputBytesPerBatch
        ? JSON.stringify(item).length
        : 0;

      const wouldExceedItems =
        this.itemBatcher.maxItemsPerBatch !== undefined &&
        currentBatch.length >= this.itemBatcher.maxItemsPerBatch;
      const wouldExceedBytes =
        this.itemBatcher.maxInputBytesPerBatch !== undefined &&
        currentBatchSize + itemSize > this.itemBatcher.maxInputBytesPerBatch &&
        currentBatch.length > 0;

      if (wouldExceedItems || wouldExceedBytes) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }

      currentBatch.push(item);
      currentBatchSize += itemSize;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private async executeWithConcurrencyLimit<T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    if (limit === 0) {
      // Unlimited concurrency
      await Promise.all(items.map((item, index) => fn(item, index)));
      return;
    }

    let currentIndex = 0;
    let aborted = false;
    let firstError: Error | null = null;

    const workers = Array(Math.min(limit, items.length))
      .fill(null)
      .map(async () => {
        while (currentIndex < items.length && !aborted) {
          const index = currentIndex++;
          try {
            await fn(items[index], index);
          } catch (err) {
            aborted = true;
            if (!firstError)
              firstError = err instanceof Error ? err : new Error(String(err));
          }
        }
      });

    await Promise.all(workers);
    if (firstError) throw firstError;
  }

  override toDict(): Record<string, unknown> {
    const result = super.toDict() as Record<string, unknown>;
    result.ItemProcessor = this.itemProcessorDef;

    if (this.itemsPath) result.ItemsPath = this.itemsPath;
    if (this.itemSelector) result.ItemSelector = this.itemSelector;
    if (this.itemBatcher) {
      const batcherDict: Record<string, unknown> = {};
      if (this.itemBatcher.maxItemsPerBatch !== undefined)
        batcherDict.MaxItemsPerBatch = this.itemBatcher.maxItemsPerBatch;
      if (this.itemBatcher.maxInputBytesPerBatch !== undefined)
        batcherDict.MaxInputBytesPerBatch =
          this.itemBatcher.maxInputBytesPerBatch;
      if (this.itemBatcher.batchInput)
        batcherDict.BatchInput = this.itemBatcher.batchInput;
      result.ItemBatcher = batcherDict;
    }
    // Change these lines at the bottom of toDict()
    if (this.maxConcurrency !== 0) result.MaxConcurrency = this.maxConcurrency;

    // Only include tolerance fields if they were explicitly defined
    if (this.toleratedFailurePercentage !== undefined)
      result.ToleratedFailurePercentage = this.toleratedFailurePercentage;
    if (this.toleratedFailureCount !== undefined)
      result.ToleratedFailureCount = this.toleratedFailureCount;
    return result;
  }
}
