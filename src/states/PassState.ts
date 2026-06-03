/**
 * Pass state implementation for Amazon States Language.
 * A Pass state passes its input to its output, performing no work. Pass states
 * are useful when constructing and debugging state machines.
 */
import {BaseState, StateError, getPathProcessor, ValidateOptions} from "./base";

export interface PassStateConfig {
    name: string;
    nextState?: string | undefined;
    end?: boolean;
    inputPath?: string | undefined;
    resultPath?: string | undefined;
    outputPath?: string | undefined;
    result?: unknown;
    parameters?: Record<string, unknown> | undefined;
    comment?: string | undefined;
}

export class PassState extends BaseState {
    result?: unknown;
    parameters?: Record<string, unknown> | undefined;

    constructor(config: PassStateConfig) {
        super();

        this.name = config.name;
        this.type = "Pass";
        this.nextState = config.nextState;
        this.end = config.end ?? false;
        this.inputPath = config.inputPath;
        this.resultPath = config.resultPath;
        this.outputPath = config.outputPath;
        this.result = config.result;
        this.parameters = config.parameters;
        this.comment = config.comment;

        // Equivalent to Python's __post_init__
        this.validate();
    }

    async execute(
        inputData: unknown,
        context?: Record<string, unknown>
    ): Promise<[unknown, string | undefined]> {
        if (!context) context = {};

        try {
            const processor = this._pathProcessor || getPathProcessor();

            // Process input path
            const processedInput = processor.applyInputPath(inputData, this.inputPath);

            // Determine the result to use
            let stateResult: unknown;
            if (this.result !== undefined && this.result !== null) {
                stateResult = this.result;
            } else if (this.parameters !== undefined && this.parameters !== null) {
                // 👇 EXPAND PARAMETERS using JSONPath (CRITICAL for ASL compliance)
                stateResult = this.expandValue(this.parameters, { $: processedInput }, processor);
            } else {
                stateResult = undefined;
            }

            // Apply result path
            let combinedData: unknown;
            if (stateResult !== undefined && stateResult !== null) {
                combinedData = processor.applyResultPath(processedInput, stateResult, this.resultPath);
            } else {
                combinedData = processedInput;
            }

            // Process output path
            const finalOutput = processor.applyOutputPath(combinedData, this.outputPath);

            return [finalOutput, this.nextState];
        } catch (e: unknown) {
            // Wrap any processing error in StateError
            const message = e instanceof Error ? e.message : String(e);
            throw new StateError(
                `Failed to execute pass state '${this.name}': ${message}`,
                this.name,
                "States.Runtime"
            );
        }
    }

    override validate(options?: ValidateOptions): void {
        // Pass state specific validations
        if (this.type !== "Pass") {
            throw new Error(
                `Pass state '${this.name}' must have Type 'Pass', got '${this.type}'`
            );
        }

        // Cannot have both Result and Parameters
        if (
            this.result !== undefined && this.result !== null &&
            this.parameters !== undefined && this.parameters !== null
        ) {
            throw new Error(
                `Pass state '${this.name}' cannot have both Result and Parameters`
            );
        }

        // Call parent validation
        super.validate({...options, skipType: true});
    }

    override toDict(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            Type: this.type,
        };

        if (this.nextState !== undefined) result.Next = this.nextState;
        if (this.end) result.End = this.end;
        if (this.inputPath !== undefined) result.InputPath = this.inputPath;
        if (this.resultPath !== undefined) result.ResultPath = this.resultPath;
        if (this.outputPath !== undefined) result.OutputPath = this.outputPath;
        if (this.result !== undefined && this.result !== null) result.Result = this.result;
        if (this.parameters !== undefined && this.parameters !== null) result.Parameters = this.parameters;
        if (this.comment !== undefined) result.Comment = this.comment;

        return result;
    }

    override toString(): string {
        return `PassState(name=${this.name})`;
    }
}
