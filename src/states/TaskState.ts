/**
 * Task state implementation for Amazon States Language.
 */
import type {PathProcessor} from "./base";
import {BaseState, CatchRule, getPathProcessor, RetryRule, StateError, ValidateOptions,} from "./base";
import {DefaultTaskHandler, EXECUTION_CONTEXT_KEY, ExecutionContext, TaskHandler} from "./../types";

export interface TaskStateConfig {
  name: string;
  resource: string;
  parameters?: Record<string, unknown> | undefined;
  timeoutSeconds?: number | undefined;
  heartbeatSeconds?: number | undefined;
  retry?: RetryRule[] | undefined;
  catch?: CatchRule[] | undefined;
  resultSelector?: Record<string, unknown> | undefined;
  taskHandler?: TaskHandler | undefined;
  nextState?: string | undefined;
  end?: boolean | undefined;
  inputPath?: string | undefined;
  resultPath?: string | undefined;
  outputPath?: string | undefined;
  comment?: string | undefined;
}

export class TaskState extends BaseState {
  resource: string;
  parameters?: Record<string, unknown> | undefined;
  timeoutSeconds?: number | undefined;
  heartbeatSeconds?: number | undefined;
  retry: RetryRule[];
  catch: CatchRule[];
  resultSelector?: Record<string, unknown> | undefined;
  taskHandler?: TaskHandler | undefined;

  constructor(config: TaskStateConfig) {
    super();
    this.name = config.name;
    this.type = "Task";
    this.resource = config.resource;
    this.parameters = config.parameters;
    this.timeoutSeconds = config.timeoutSeconds;
    this.heartbeatSeconds = config.heartbeatSeconds;
    this.retry = config.retry || [];
    this.catch = config.catch || [];
    this.resultSelector = config.resultSelector;
    this.taskHandler = config.taskHandler;
    this.nextState = config.nextState;
    this.end = config.end ?? false;
    this.inputPath = config.inputPath;
    this.resultPath = config.resultPath;
    this.outputPath = config.outputPath;
    this.comment = config.comment;

    this.validate({ skipType: true, skipNextState: false });
  }

  override validate(options?: ValidateOptions): void {
    super.validate(options);
    if (!this.resource)
      throw new Error(`Task state '${this.name}' Resource is required`);
    if (this.timeoutSeconds !== undefined && this.timeoutSeconds <= 0)
      throw new Error(
        `Task state '${this.name}' TimeoutSeconds must be positive`,
      );
    if (this.heartbeatSeconds !== undefined && this.heartbeatSeconds <= 0)
      throw new Error(
        `Task state '${this.name}' HeartbeatSeconds must be positive`,
      );
    if (
      this.heartbeatSeconds !== undefined &&
      this.timeoutSeconds !== undefined &&
      this.heartbeatSeconds >= this.timeoutSeconds
    ) {
      throw new Error(
        `Task state '${this.name}' HeartbeatSeconds must be less than TimeoutSeconds`,
      );
    }


    for (let i = 0; i < this.retry.length; i++) {
      const policy = this.retry[i];
      if (!policy || !policy.errorEquals || policy.errorEquals.length === 0)
        throw new Error(
          `Task state '${this.name}' Retry policy ${i}: ErrorEquals is required`,
        );
      if (policy && policy.backoffRate < 1.0)
        throw new Error(
          `Task state '${this.name}' Retry policy ${i}: BackoffRate must be >= 1.0`,
        );
    }

    for (let i = 0; i < this.catch.length; i++) {
      const policy = this.catch[i];
      if (!policy || !policy.errorEquals || policy.errorEquals.length === 0)
        throw new Error(
          `Task state '${this.name}' Catch policy ${i}: ErrorEquals is required`,
        );
      if (!policy || !policy.nextState)
        throw new Error(
          `Task state '${this.name}' Catch policy ${i}: Next is required`,
        );
    }
  }

  async execute(
    inputData: unknown,
    context?: Record<string, unknown>,
  ): Promise<[unknown, string | undefined]> {
    if (!context) context = {};
    try {
      const { processor, taskInput, processedInput } =
        this.prepareInput(inputData);
      const execCtx = context[EXECUTION_CONTEXT_KEY] as
        | ExecutionContext
        | undefined;
      let handler = execCtx ? execCtx.getTaskHandler(this.resource) : null;
      if (!handler) handler = this.getTaskHandler();

      const [result, taskError] = await this.executeWithRetry(
        handler,
        taskInput,
        context,
      );
      return this.handleTaskResult(
        processor,
        processedInput,
        result,
        taskError,
        context,
      );
    } catch (e) {
      if (e instanceof StateError) throw e;
      throw new StateError(
        `Task execution failed: ${e instanceof Error ? e.message : String(e)}`,
        this.name,
        "States.TaskFailed",
      );
    }
  }

  private prepareInput(inputData: unknown): {
    processor: PathProcessor;
    taskInput: unknown;
    processedInput: unknown;
  } {
    const processor = this._pathProcessor || getPathProcessor();
    const processedInput = processor.applyInputPath(inputData, this.inputPath);

    let taskInput = processedInput;
    if (this.parameters !== undefined) {
      taskInput = this.expandValueForTaskState(
        this.parameters,
        { $: processedInput },
        processor,
      ); // 👈 Pass processor
    }

    return { processor, taskInput, processedInput };
  }

  private getTaskHandler(): TaskHandler {
    return this.taskHandler || new DefaultTaskHandler();
  }

  private async executeWithRetry(
    handler:
      | TaskHandler
      | ((
          resource: string,
          inputData: unknown,
          parameters?: Record<string, unknown>,
        ) => Promise<unknown>),
    taskInput: unknown,
    context: Record<string, unknown>,
  ): Promise<[unknown, Error | null]> {
    let result: unknown = null;
    const maxAttempts = this.calculateMaxAttempts();
    let backoffDuration = 1.0;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        if (typeof handler === "function") {
          result = await handler(this.resource, taskInput, this.parameters);
        } else if ("executeWithTimeout" in handler) {
          result = await handler.executeWithTimeout(
            this.resource,
            taskInput,
            this.parameters,
            this.timeoutSeconds,
            context,
          );
        } else if ("execute" in handler) {
          result = await handler.execute(
            this.resource,
            taskInput,
            this.parameters,
          );
        } else {
          throw new Error("Invalid task handler");
        }
        return [result, null];
      } catch (taskError) {
        const error =
          taskError instanceof Error ? taskError : new Error(String(taskError));
        if (!this.shouldRetry(error, attempt, maxAttempts))
          return [null, error];
        backoffDuration = this.calculateBackoffDuration(error, backoffDuration);
        await new Promise((resolve) =>
          setTimeout(resolve, backoffDuration * 1000),
        );
      }
    }
    return [null, new StateError("Max retry attempts exceeded", this.name)];
  }

  private calculateMaxAttempts(): number {
    for (const policy of this.retry) {
      if (policy.maxAttempts !== undefined && policy.maxAttempts > 0)
        return policy.maxAttempts;
    }
    return 0;
  }

  private shouldRetry(
    taskError: Error,
    attempt: number,
    maxAttempts: number,
  ): boolean {
    if (attempt >= maxAttempts) return false;
    return this.retry.some((policy) =>
      this.errorMatches(taskError, policy.errorEquals),
    );
  }

  private calculateBackoffDuration(
    taskError: Error,
    currentDuration: number,
  ): number {
    let duration = currentDuration;
    for (const policy of this.retry) {
      if (this.errorMatches(taskError, policy.errorEquals)) {
        if (currentDuration === 1.0) duration = policy.intervalSeconds ?? 1.0;
        if (policy.backoffRate > 1.0) duration = duration * policy.backoffRate;
        if (
          policy.maxDelaySeconds !== undefined &&
          duration > policy.maxDelaySeconds
        ) {
          duration = policy.maxDelaySeconds;
        }
        break;
      }
    }
    return duration;
  }

  private handleTaskResult(
    processor: PathProcessor,
    processedInput: unknown,
    result: unknown,
    taskError: Error | null,
    _context: Record<string, unknown>,
  ): [unknown, string | undefined] {
    return taskError !== null
      ? this.handleTaskFailure(processor, processedInput, taskError)
      : this.processSuccessfulResult(processor, processedInput, result);
  }

  private handleTaskFailure(
    processor: PathProcessor,
    processedInput: unknown,
    taskError: Error,
  ): [unknown, string | undefined] {
    for (const policy of this.catch) {
      if (this.errorMatches(taskError, policy.errorEquals)) {
        return this.handleCaughtError(
          processor,
          processedInput,
          taskError,
          policy,
        );
      }
    }
    throw taskError;
  }

  private handleCaughtError(
    processor: PathProcessor,
    processedInput: unknown,
    taskError: Error,
    catchPolicy: CatchRule,
  ): [unknown, string | undefined] {
    const errorResult = {
      Error: taskError.message || String(taskError),
      Cause: taskError.message || String(taskError),
    };
    return [
      processor.applyResultPath(
        processedInput,
        errorResult,
        catchPolicy.resultPath,
      ),
      catchPolicy.nextState,
    ];
  }

  private processSuccessfulResult(
    processor: PathProcessor,
    processedInput: unknown,
    result: unknown,
  ): [unknown, string | undefined] {
    let output = result;

    if (this.resultSelector !== undefined) {
      output = this.expandValueForTaskState(this.resultSelector, { $: result }, processor); // 👈 Pass processor
    }

    output = processor.applyResultPath(processedInput, output, this.resultPath);
    output = processor.applyOutputPath(output, this.outputPath);

    return [output, this.nextState];
  }

  private errorMatches(error: Error, errorPatterns: string[]): boolean {
    const errorMsg = error.message;
    const errorType =
      "errorType" in error
        ? (error as { errorType: string }).errorType
        : error.name;
    return errorPatterns.some(
      (pattern) =>
        pattern === "States.ALL" ||
        pattern === errorMsg ||
        pattern === errorType ||
        errorMsg.includes(pattern),
    );
  }

  private expandValueForTaskState(
    template: unknown,
    context: Record<string, unknown>,
    processor: PathProcessor,
  ): unknown {
    // If it's a string starting with "$", evaluate it as a JSONPath against the context data
    if (typeof template === "string" && template.startsWith("$")) {
      const data = context["$"];
      return processor.applyInputPath(data, template);
    }
    if (Array.isArray(template)) {
      return template.map((item) => this.expandValueForTaskState(item, context, processor));
    }
    if (typeof template === "object" && template !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.expandValueForTaskState(value, context, processor);
      }
      return result;
    }
    return template;
  }

  override getNextStates(): string[] {
    const nextStates: string[] = [];
    if (this.nextState !== undefined) nextStates.push(this.nextState);
    for (const policy of this.catch) nextStates.push(policy.nextState);
    return nextStates;
  }

  override toDict(): Record<string, unknown> {
    const result = super.toDict() as Record<string, unknown>;
    result.Resource = this.resource;
    if (this.parameters !== undefined) result.Parameters = this.parameters;
    if (this.timeoutSeconds !== undefined)
      result.TimeoutSeconds = this.timeoutSeconds;
    if (this.heartbeatSeconds !== undefined)
      result.HeartbeatSeconds = this.heartbeatSeconds;
    if (this.retry.length > 0) result.Retry = this.retry.map((r) => r.toDict());
    if (this.catch.length > 0) result.Catch = this.catch.map((c) => c.toDict());
    if (this.resultSelector !== undefined)
      result.ResultSelector = this.resultSelector;
    return result;
  }
}
