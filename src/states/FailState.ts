/**
 * Fail state implementation for Amazon States Language.
 *
 * A Fail state stops execution of the state machine and marks it as a failure.
 * The Fail state only allows the use of Type, Comment, Error, and Cause fields.
 */
import { BaseState, StateError, ValidateOptions } from "./base";

export interface FailStateConfig {
    name: string;
    /** Required error name/code for the failure (e.g., "States.Timeout", "CustomError") */
    error: string;
    /** Human-readable error message */
    cause?: string;
    /** Human-readable description of the state */
    comment?: string;

    // The following are included for validation purposes - they MUST NOT be set
    nextState?: string;
    end?: boolean;
    inputPath?: string;
    resultPath?: string;
    outputPath?: string;
}

export class FailState extends BaseState {
    error: string;
    cause?: string | undefined;

    constructor(config: FailStateConfig) {
        super();

        this.name = config.name;
        this.type = "Fail";
        this.error = config.error;
        this.cause = config.cause;
        this.comment = config.comment;

        // Fail states cannot have these fields - enforce terminal state properties
        this.nextState = config.nextState;
        this.end = config.end ?? false;
        this.inputPath = config.inputPath;
        this.resultPath = config.resultPath;
        this.outputPath = config.outputPath;

        // Validate after initialization (equivalent to Python's __post_init__)
        this.validate();
    }

    /**
     * Execute the Fail state.
     *
     * Fail states always throw a StateError and never return a next state.
     * The error's `errorType` is set to the state's `error` field, and the
     * message is set to the `cause` field (or a default message).
     *
     * @param inputData - Input data for the state (ignored by Fail states)
     * @param context - Optional execution context
     * @throws StateError always - with the configured error code and cause
     */
    async execute(
        inputData: any,
        context?: Record<string, any>
    ): Promise<[any, string | undefined]> {
        if (!context) context = {};

        // Fail states always raise a StateError with the configured error code
        throw new StateError(
            this.cause || `State '${this.name}' failed`,
            this.name,
            this.error
        );
    }

    override validate(options?: ValidateOptions): void {
        // Fail state specific validations

        // Type must be "Fail"
        if (this.type !== "Fail") {
            throw new Error(
                `Fail state '${this.name}' must have Type 'Fail', got '${this.type}'`
            );
        }

        // Error field is required
        if (!this.error) {
            throw new Error(`Fail state '${this.name}' must have Error field`);
        }

        // Fail states cannot have Next field (they're implicitly terminal)
        if (this.nextState !== undefined) {
            throw new Error(`Fail state '${this.name}' cannot have Next field`);
        }

        // Fail states cannot have End field (it's implicit)
        if (this.end) {
            throw new Error(`Fail state '${this.name}' cannot have End field (it's implicit)`);
        }

        // Fail states cannot have InputPath
        if (this.inputPath !== undefined) {
            throw new Error(`Fail state '${this.name}' cannot have InputPath`);
        }

        // Fail states cannot have OutputPath
        if (this.outputPath !== undefined) {
            throw new Error(`Fail state '${this.name}' cannot have OutputPath`);
        }

        // Fail states cannot have ResultPath
        if (this.resultPath !== undefined) {
            throw new Error(`Fail state '${this.name}' cannot have ResultPath`);
        }

        // Call parent validation with skip flags
        super.validate({ ...options, skipType: true, skipNextState: true });
    }

    /**
     * Get all possible next state names for graph validation.
     * Fail states are terminal, so this always returns an empty list.
     */
    override getNextStates(): string[] {
        return [];
    }

    override toDict(): Record<string, any> {
        const result: Record<string, any> = {
            Type: this.type,
            Error: this.error,
        };

        if (this.cause !== undefined) result.Cause = this.cause;
        if (this.comment !== undefined) result.Comment = this.comment;

        // Explicitly exclude disallowed fields:
        // Next, End, InputPath, OutputPath, ResultPath should never appear

        return result;
    }

    override toString(): string {
        return `FailState(name=${this.name}, error=${this.error})`;
    }
}
