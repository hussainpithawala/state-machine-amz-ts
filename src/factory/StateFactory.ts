/**
 * Factory for creating state objects from definitions.
 *
 * Creates appropriate state objects based on the "Type" field.
 */
import { BaseState, RetryRule, CatchRule } from "../states/base";
import { PassState, PassStateConfig } from "../states/PassState";
import { FailState, FailStateConfig } from "../states/FailState";
import { SucceedState, SucceedStateConfig } from "../states/SucceedState";
import { TaskState, TaskStateConfig } from "../states/TaskState";
import { WaitState, WaitStateConfig } from "../states//WaitState";

import {
  ChoiceState,
  ChoiceRule,
  ChoiceStateConfig,
} from "../states/ChoiceState";
import {
  MapState,
  MapStateConfig,
  ItemBatcherConfig,
} from "../states/MapState";

type StateData = Record<string, unknown>;
type StateCreator = (name: string, data: StateData) => BaseState;

export class StateFactory {
  private creators: Record<string, StateCreator> = {};

  constructor() {
    this.registerDefaultCreators();
  }

  private registerDefaultCreators(): void {
    this.creators = {
      Pass: this.createPassState.bind(this),
      Fail: this.createFailState.bind(this),
      Succeed: this.createSucceedState.bind(this),
      Task: this.createTaskState.bind(this),
      Choice: this.createChoiceState.bind(this),
      Map: this.createMapState.bind(this),
      Wait: this.createWaitState.bind(this),
    };
    // Note: Uncomment the above lines once WaitState and ParallelState are implemented.
  }

  /**
   * Create a state from dictionary data.
   *
   * @param name - State name
   * @param stateData - Dictionary with state configuration
   * @returns State object
   * @throws Error if state type is unknown or creation fails
   */
  public createState(name: string, stateData: StateData): BaseState {
    if (!("Type" in stateData) || typeof stateData.Type !== "string") {
      throw new Error(`State '${name}' missing Type field`);
    }

    const stateType = stateData.Type;

    if (!(stateType in this.creators)) {
      throw new Error(`Unknown state type: ${stateType}`);
    }

    const creator = this.creators[stateType];
    return creator(name, stateData);
  }

  private createWaitState(name: string, data: StateData): BaseState {
    const config: WaitStateConfig = {
      name,
      seconds: data.Seconds as number | undefined,
      secondsPath: data.SecondsPath as string | undefined,
      timestamp: data.Timestamp as string | undefined,
      timestampPath: data.TimestampPath as string | undefined,
      nextState: data.Next as string | undefined,
      end: (data.End as boolean) ?? false,
      inputPath: data.InputPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      comment: data.Comment as string | undefined,
    };
    return new WaitState(config);
  }

  private createMapState(name: string, data: StateData): BaseState {
    const itemProcessor = (data.ItemProcessor || data.Iterator) as Record<
      string,
      unknown
    >;
    if (!itemProcessor) {
      throw new Error(`Map state '${name}' requires ItemProcessor or Iterator`);
    }

    let itemBatcher: ItemBatcherConfig | undefined;
    const batcherData = data.ItemBatcher as StateData | undefined;
    if (batcherData) {
      itemBatcher = {
        maxItemsPerBatch: batcherData.MaxItemsPerBatch as number | undefined,
        maxInputBytesPerBatch: batcherData.MaxInputBytesPerBatch as
          | number
          | undefined,
        batchInput: batcherData.BatchInput as
          | Record<string, unknown>
          | undefined,
      };
    }

    const config: MapStateConfig = {
      name,
      itemProcessor,
      itemsPath: data.ItemsPath as string | undefined,
      itemSelector: data.ItemSelector as Record<string, unknown> | undefined,
      itemBatcher,
      maxConcurrency: data.MaxConcurrency as number | undefined,
      toleratedFailurePercentage: data.ToleratedFailurePercentage as
        | number
        | undefined,
      toleratedFailureCount: data.ToleratedFailureCount as number | undefined,
      nextState: data.Next as string | undefined,
      end: (data.End as boolean) ?? false,
      inputPath: data.InputPath as string | undefined,
      resultPath: data.ResultPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      resultSelector: data.ResultSelector as
        | Record<string, unknown>
        | undefined,
      comment: data.Comment as string | undefined,
    };

    return new MapState(config);
  }

  private createPassState(name: string, data: StateData): BaseState {
    const config: PassStateConfig = {
      name,
      nextState: data.Next as string | undefined,
      end: (data.End as boolean) ?? false,
      inputPath: data.InputPath as string | undefined,
      resultPath: data.ResultPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      comment: data.Comment as string | undefined,
      result: data.Result,
      parameters: data.Parameters as Record<string, unknown> | undefined,
    };
    return new PassState(config);
    // Note: If you are using the updated PassState that enforces terminal properties,
    // ensure `end` and `nextState` are handled according to your specific validation rules.
  }

  private createFailState(name: string, data: StateData): BaseState {
    const config: FailStateConfig = {
      name,
      error: (data.Error as string) || "States.Fail",
      cause: (data.Cause as string) || "Fail state reached",
      comment: data.Comment as string | undefined,
    };
    return new FailState(config);
  }

  private createSucceedState(name: string, data: StateData): BaseState {
    const config: SucceedStateConfig = {
      name,
      inputPath: data.InputPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      comment: data.Comment as string | undefined,
    };
    return new SucceedState(config);
  }

  private createTaskState(name: string, data: StateData): BaseState {
    // Parse retry policies
    const retry: RetryRule[] = [];
    const retryData = data.Retry as StateData[] | undefined;
    if (Array.isArray(retryData)) {
      for (const r of retryData) {
        retry.push(
          new RetryRule({
            errorEquals: (r.ErrorEquals as string[]) || [],
            intervalSeconds: (r.IntervalSeconds as number) ?? 1,
            maxAttempts: r.MaxAttempts as number | undefined,
            backoffRate: (r.BackoffRate as number) ?? 2.0,
            maxDelaySeconds: r.MaxDelaySeconds as number | undefined,
            jitterStrategy: r.JitterStrategy as string | undefined,
          }),
        );
      }
    }

    // Parse catch policies
    const catchRules: CatchRule[] = [];
    const catchData = data.Catch as StateData[] | undefined;
    if (Array.isArray(catchData)) {
      for (const c of catchData) {
        catchRules.push(
          new CatchRule({
            errorEquals: (c.ErrorEquals as string[]) || [],
            nextState: (c.Next as string) || "",
            resultPath: c.ResultPath as string | undefined,
          }),
        );
      }
    }

    const config: TaskStateConfig = {
      name,
      resource: (data.Resource as string) || "",
      nextState: data.Next as string | undefined,
      end: (data.End as boolean) ?? false,
      inputPath: data.InputPath as string | undefined,
      resultPath: data.ResultPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      comment: data.Comment as string | undefined,
      parameters: data.Parameters as Record<string, unknown> | undefined,
      timeoutSeconds: data.TimeoutSeconds as number | undefined,
      heartbeatSeconds: data.HeartbeatSeconds as number | undefined,
      retry,
      catch: catchRules,
      resultSelector: data.ResultSelector as
        | Record<string, unknown>
        | undefined,
    };

    return new TaskState(config);
  }

  private createChoiceState(name: string, data: StateData): BaseState {
    const parseRule = (ruleData: StateData): ChoiceRule => {
      const rule = new ChoiceRule({
        variable: ruleData.Variable as string | undefined,
        next: ruleData.Next as string | undefined,
        stringEquals: ruleData.StringEquals as string | undefined,
        stringLessThan: ruleData.StringLessThan as string | undefined,
        stringGreaterThan: ruleData.StringGreaterThan as string | undefined,
        stringLessThanEquals: ruleData.StringLessThanEquals as
          | string
          | undefined,
        stringGreaterThanEquals: ruleData.StringGreaterThanEquals as
          | string
          | undefined,
        numericEquals: ruleData.NumericEquals as number | undefined,
        numericLessThan: ruleData.NumericLessThan as number | undefined,
        numericGreaterThan: ruleData.NumericGreaterThan as number | undefined,
        numericLessThanEquals: ruleData.NumericLessThanEquals as
          | number
          | undefined,
        numericGreaterThanEquals: ruleData.NumericGreaterThanEquals as
          | number
          | undefined,
        booleanEquals: ruleData.BooleanEquals as boolean | undefined,
        timestampEquals: ruleData.TimestampEquals as string | undefined,
        timestampLessThan: ruleData.TimestampLessThan as string | undefined,
        timestampGreaterThan: ruleData.TimestampGreaterThan as
          | string
          | undefined,
        timestampLessThanEquals: ruleData.TimestampLessThanEquals as
          | string
          | undefined,
        timestampGreaterThanEquals: ruleData.TimestampGreaterThanEquals as
          | string
          | undefined,
        comment: ruleData.Comment as string | undefined,
      });

      if (ruleData.And && Array.isArray(ruleData.And)) {
        rule.andRules = (ruleData.And as StateData[]).map(parseRule);
      }
      if (ruleData.Or && Array.isArray(ruleData.Or)) {
        rule.orRules = (ruleData.Or as StateData[]).map(parseRule);
      }
      if (
        ruleData.Not &&
        typeof ruleData.Not === "object" &&
        ruleData.Not !== null
      ) {
        rule.notRule = parseRule(ruleData.Not as StateData);
      }

      return rule;
    };

    const choices: ChoiceRule[] = [];
    const choicesData = data.Choices as StateData[] | undefined;
    if (Array.isArray(choicesData)) {
      for (const choiceData of choicesData) {
        choices.push(parseRule(choiceData));
      }
    }

    const config: ChoiceStateConfig = {
      name,
      choices,
      default: data.Default as string | undefined,
      inputPath: data.InputPath as string | undefined,
      resultPath: data.ResultPath as string | undefined,
      outputPath: data.OutputPath as string | undefined,
      comment: data.Comment as string | undefined,
    };

    return new ChoiceState(config);
  }

  // ==========================================
  // Placeholder for future states
  // ==========================================

  /*
    private createWaitState(name: string, data: StateData): BaseState {
      // Implement WaitState creation here
      throw new Error("WaitState creation not yet implemented");
    }

    private createParallelState(name: string, data: StateData): BaseState {
      // Implement ParallelState creation here
      // Note: This requires recursively calling this.createState for each state in each branch
      throw new Error("ParallelState creation not yet implemented");
    }
    */

  /**
   * Register a custom state creator.
   *
   * @param stateType - State type name (e.g., "CustomState")
   * @param creator - Creator function that takes (name, data) and returns a BaseState
   */
  public registerCreator(stateType: string, creator: StateCreator): void {
    this.creators[stateType] = creator;
  }
}
