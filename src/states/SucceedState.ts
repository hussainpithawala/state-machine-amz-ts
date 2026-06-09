/**
 * Succeed state implementation for Amazon States Language.
 * A Succeed state is a terminal state that stops execution successfully.
 * It is a useful target for Choice state branches that don't do anything
 * but stop the execution.
 */
import {
  BaseState,
  StateError,
  getPathProcessor,
  ValidateOptions,
} from "./base";

export interface SucceedStateConfig {
  name: string;
  inputPath?: string | undefined;
    outputPath?: string | undefined;
    comment?: string | undefined;
    // The following are included for validation purposes - they MUST not be set
    nextState?: string | undefined;
    end?: boolean | undefined;
    resultPath?: string | undefined;
}

export class SucceedState extends BaseState {
  constructor(config: SucceedStateConfig) {
    super();

    this.name = config.name;
    this.type = "Succeed";
    this.nextState = config.nextState;
    this.end = config.end ?? false;
    this.inputPath = config.inputPath;
    this.resultPath = config.resultPath;
    this.outputPath = config.outputPath;
    this.comment = config.comment;

    // Validate after initialization (equivalent to Python's __post_init__)
    this.validate();
  }

  /**
   * Execute the Succeed state.
   *
   * Succeed states apply input/output paths and then halt execution.
   * They never produce a next state - execution is implicitly terminal.
   *
   * @param inputData - Input data for the state
   * @param context - Optional execution context
   * @returns Tuple of [output, undefined] - next_state is always undefined
   * @throws StateError if path processing fails
   */
  async execute(
    inputData: any,
    context?: Record<string, any>,
  ): Promise<[any, string | undefined]> {
    if (!context) context = {};

    try {
      const processor = this._pathProcessor || getPathProcessor();

      // Process input path
      const processedInput = processor.applyInputPath(
        inputData,
        this.inputPath,
      );

      // Process output path
      const finalOutput = processor.applyOutputPath(
        processedInput,
        this.outputPath,
      );

      // Succeed states always end execution (no next state, no error)
      return [finalOutput, undefined];
    } catch (e: any) {
      // Wrap any processing error in StateError
      throw new StateError(
        `Failed to execute succeed state '${this.name}': ${e.message || e}`,
        this.name,
        "States.Runtime",
      );
    }
  }

  override validate(options?: ValidateOptions): void {
    // Succeed state specific validations

    // Type must be "Succeed"
    if (this.type !== "Succeed") {
      throw new Error(
        `Succeed state '${this.name}' must have Type 'Succeed', got '${this.type}'`,
      );
    }

    // Succeed states cannot have Next field (they're implicitly terminal)
    if (this.nextState !== undefined) {
      throw new Error(`Succeed state '${this.name}' cannot have Next field`);
    }

    // Succeed states cannot have End field (it's implicit)
    if (this.end) {
      throw new Error(
        `Succeed state '${this.name}' cannot have End field (it's implicit)`,
      );
    }

    // Succeed states cannot have ResultPath (no result is produced)
    if (this.resultPath !== undefined) {
      throw new Error(`Succeed state '${this.name}' cannot have ResultPath`);
    }

    // Call parent validation, skipping type and next_state checks since we handle them above
    super.validate({ ...options, skipType: true, skipNextState: true });
  }

  /**
   * Get all possible next state names for graph validation.
   * Succeed states are terminal, so this always returns an empty list.
   */
  override getNextStates(): string[] {
    return [];
  }

  override toDict(): Record<string, any> {
    const result: Record<string, any> = {
      Type: this.type,
    };

    // Only include allowed fields for Succeed state
    if (this.inputPath !== undefined) result.InputPath = this.inputPath;
    if (this.outputPath !== undefined) result.OutputPath = this.outputPath;
    if (this.comment !== undefined) result.Comment = this.comment;

    // Explicitly exclude disallowed fields:
    // Next, End, ResultPath should never appear in the serialized output

    return result;
  }

  override toString(): string {
    return `SucceedState(name=${this.name})`;
  }
}
