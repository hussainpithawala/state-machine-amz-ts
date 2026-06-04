/**
 * Base state classes for Amazon States Language implementation.
 * Based on the Go implementation structure.
 */
import { JSONPathProcessor } from "./json_path"; // Safe direct import due to 'import type' in json_path.ts

export interface PathProcessor {
  applyInputPath(inputData: unknown, path?: string): unknown;
  applyResultPath(inputData: unknown, result: unknown, path?: string): unknown;
  applyOutputPath(output: unknown, path?: string): unknown;
}

export interface RetryRuleConfig {
  errorEquals: string[];
  intervalSeconds?: number;
  maxAttempts?: number;
  backoffRate?: number;
  maxDelaySeconds?: number;
  jitterStrategy?: string;
}

export class RetryRule {
  errorEquals: string[];
  intervalSeconds: number;
  maxAttempts?: number;
  backoffRate: number;
  maxDelaySeconds?: number;
  jitterStrategy?: string;

  constructor(config: RetryRuleConfig) {
    this.errorEquals = config.errorEquals;
    this.intervalSeconds = config.intervalSeconds ?? 1;
    this.maxAttempts = config.maxAttempts ?? 0;
    this.backoffRate = config.backoffRate ?? 2.0;
    this.maxDelaySeconds = config.maxDelaySeconds ?? 0;
    this.jitterStrategy = config.jitterStrategy ?? "full";
    this.validate();
  }

  private validate(): void {
    if (!this.errorEquals || this.errorEquals.length === 0) {
      throw new Error("ErrorEquals cannot be empty");
    }
    if (this.intervalSeconds < 0) {
      throw new Error("IntervalSeconds must be >= 0");
    }
    if (this.maxAttempts !== undefined && this.maxAttempts < 0) {
      throw new Error("MaxAttempts must be >= 0");
    }
    if (this.backoffRate < 1.0) {
      throw new Error("BackoffRate must be >= 1.0");
    }
    if (this.maxDelaySeconds !== undefined && this.maxDelaySeconds < 0) {
      throw new Error("MaxDelaySeconds must be >= 0");
    }
  }

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = { ErrorEquals: this.errorEquals };
    if (this.intervalSeconds !== 1)
      result.IntervalSeconds = this.intervalSeconds;
    if (this.maxAttempts !== undefined) result.MaxAttempts = this.maxAttempts;
    if (this.backoffRate !== 2.0) result.BackoffRate = this.backoffRate;
    if (this.maxDelaySeconds !== undefined)
      result.MaxDelaySeconds = this.maxDelaySeconds;
    if (this.jitterStrategy !== undefined)
      result.JitterStrategy = this.jitterStrategy;
    return result;
  }
}

export interface CatchRuleConfig {
  errorEquals: string[];
  nextState: string;
  resultPath?: string | undefined;
}

export class CatchRule {
  errorEquals: string[];
  nextState: string;
  resultPath?: string | undefined;

  constructor(config: CatchRuleConfig) {
    this.errorEquals = config.errorEquals;
    this.nextState = config.nextState;
    this.resultPath = config.resultPath;
    this.validate();
  }

  private validate(): void {
    if (!this.errorEquals || this.errorEquals.length === 0) {
      throw new Error("ErrorEquals cannot be empty");
    }
    if (!this.nextState) {
      throw new Error("Next cannot be empty");
    }
  }

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      ErrorEquals: this.errorEquals,
      Next: this.nextState,
    };
    if (this.resultPath !== undefined) result.ResultPath = this.resultPath;
    return result;
  }
}

export interface ValidateOptions {
  skipName?: boolean;
  skipType?: boolean;
  skipNextState?: boolean;
}

export abstract class BaseState {
  name!: string;
  type!: string;
  nextState?: string;
  end: boolean = false;
  inputPath?: string;
  resultPath?: string;
  outputPath?: string;
  comment?: string;

  protected _pathProcessor?: PathProcessor;

  get stateName(): string {
    return this.name;
  }
  get stateType(): string {
    return this.type;
  }
  getNext(): string | undefined {
    return this.nextState;
  }
  isEnd(): boolean {
    return this.end;
  }

  validate(options?: ValidateOptions): void {
    const {
      skipName = false,
      skipType = false,
      skipNextState = false,
    } = options || {};
    if (!skipName && !this.name) throw new Error("State name cannot be empty");
    if (!skipType && !this.type) throw new Error("State type cannot be empty");
    if (!skipNextState && this.nextState === undefined && !this.end)
      throw new Error("State must have either Next or End");
    if (!skipNextState && this.nextState !== undefined && this.end)
      throw new Error("State cannot have both Next and End");
  }

  getNextStates(): string[] {
    return this.nextState !== undefined ? [this.nextState] : [];
  }

  /**
   * Recursively expand a template object/array using JSONPath against a context.
   * Used for evaluating Parameters and ResultSelector fields.
   */
  protected expandValue(
    template: unknown,
    context: Record<string, unknown>,
    processor: PathProcessor,
  ): unknown {
    if (typeof template === "string" && template.startsWith("$")) {
      const data = context["$"];
      return processor.applyInputPath(data, template);
    }
    if (Array.isArray(template)) {
      return template.map((item) => this.expandValue(item, context, processor));
    }
    if (typeof template === "object" && template !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.expandValue(value, context, processor);
      }
      return result;
    }
    return template;
  }

  protected _applyPaths(
    inputData: unknown,
    result: unknown,
    context?: Record<string, unknown>,
  ): unknown {
    if (!context) context = {};
    const processor = this._pathProcessor || getPathProcessor();
    const currentData = processor.applyInputPath(inputData, this.inputPath);
    const processedData =
      result !== undefined && result !== null
        ? processor.applyResultPath(currentData, result, this.resultPath)
        : currentData;
    return processor.applyOutputPath(processedData, this.outputPath);
  }

  abstract execute(
    inputData: unknown,
    context?: Record<string, unknown>,
  ): Promise<[unknown, string | undefined]>;

  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = { Type: this.type };
    if (this.nextState !== undefined) result.Next = this.nextState;
    if (this.end) result.End = this.end;
    if (this.inputPath !== undefined) result.InputPath = this.inputPath;
    if (this.resultPath !== undefined) result.ResultPath = this.resultPath;
    if (this.outputPath !== undefined) result.OutputPath = this.outputPath;
    if (this.comment !== undefined) result.Comment = this.comment;
    return result;
  }

  toJson(indent?: number): string {
    return JSON.stringify(this.toDict(), null, indent);
  }

  setPathProcessor(processor: PathProcessor): void {
    this._pathProcessor = processor;
  }

  toString(): string {
    return `${this.type}State(name=${this.name})`;
  }
}

// ==========================================
// Global Path Processor Management
// ==========================================

// Single, default implementation instantiated immediately
let _defaultPathProcessor: PathProcessor = new JSONPathProcessor();

export function getPathProcessor(): PathProcessor {
  return _defaultPathProcessor;
}

export function setPathProcessor(processor: PathProcessor): void {
  _defaultPathProcessor = processor;
}

export async function withTemporaryPathProcessor<T>(
  processor: PathProcessor,
  fn: () => Promise<T> | T,
): Promise<T> {
  const original = _defaultPathProcessor;
  _defaultPathProcessor = processor;
  try {
    return await fn();
  } finally {
    _defaultPathProcessor = original;
  }
}

// ==========================================
// Exceptions
// ==========================================

export class StateError extends Error {
  stateName: string;
  errorType: string;

  constructor(message: string, stateName: string, errorType?: string) {
    super(message);
    this.stateName = stateName;
    this.errorType = errorType || "States.Runtime";
    this.name = "StateError";
  }

  override toString(): string {
    const parts = [];
    if (this.stateName) parts.push(`State: ${this.stateName}`);
    parts.push(`Error: ${this.message}`);
    parts.push(`Type: ${this.errorType}`);
    return parts.join(" | ");
  }
}

export class StateValidationError extends StateError {
  constructor(message: string, stateName: string) {
    super(message, stateName, "States.Validation");
    this.name = "StateValidationError";
  }
}

export class StateExecutionError extends StateError {
  constructor(message: string, stateName: string) {
    super(message, stateName, "States.Runtime");
    this.name = "StateExecutionError";
  }
}

export class StateTimeoutError extends StateError {
  constructor(message: string, stateName: string) {
    super(message, stateName, "States.Timeout");
    this.name = "StateTimeoutError";
  }
}

export class StateTaskFailedError extends StateError {
  constructor(message: string, stateName: string) {
    super(message, stateName, "States.TaskFailed");
    this.name = "StateTaskFailedError";
  }
}
