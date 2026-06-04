/**
 * Choice state implementation for Amazon States Language.
 * Enables conditional branching based on input data evaluation.
 */
import { BaseState, StateError, getPathProcessor, ValidateOptions } from "./base";

export interface ChoiceRuleConfig {
    variable?: string | undefined;
    next?: string | undefined;
    // String comparison operators
    stringEquals?: string | undefined;
    stringLessThan?: string | undefined;
    stringGreaterThan?: string | undefined;
    stringLessThanEquals?: string | undefined;
    stringGreaterThanEquals?: string | undefined;
    // Numeric comparison operators
    numericEquals?: number | undefined;
    numericLessThan?: number | undefined;
    numericGreaterThan?: number | undefined;
    numericLessThanEquals?: number | undefined;
    numericGreaterThanEquals?: number | undefined;
    // Boolean comparison operator
    booleanEquals?: boolean;
    // Timestamp comparison operators
    timestampEquals?: string | undefined;
    timestampLessThan?: string | undefined;
    timestampGreaterThan?: string | undefined;
    timestampLessThanEquals?: string | undefined;
    timestampGreaterThanEquals?: string | undefined;
    // Compound operators
    andRules?: ChoiceRule[] | undefined;
    orRules?: ChoiceRule[] | undefined;
    notRule?: ChoiceRule | undefined;
    // Optional comment
    comment?: string | undefined;
}

export class ChoiceRule {
    variable?: string | undefined;
    next?: string | undefined;
    // String comparison operators
    stringEquals?: string | undefined;
    stringLessThan?: string | undefined;
    stringGreaterThan?: string | undefined;
    stringLessThanEquals?: string | undefined;
    stringGreaterThanEquals?: string | undefined;
    // Numeric comparison operators
    numericEquals?: number | undefined;
    numericLessThan?: number | undefined;
    numericGreaterThan?: number | undefined;
    numericLessThanEquals?: number | undefined;
    numericGreaterThanEquals?: number | undefined;
    // Boolean comparison operator
    booleanEquals?: boolean;
    // Timestamp comparison operators
    timestampEquals?: string | undefined;
    timestampLessThan?: string | undefined;
    timestampGreaterThan?: string | undefined;
    timestampLessThanEquals?: string | undefined;
    timestampGreaterThanEquals?: string | undefined;
    // Compound operators
    andRules: ChoiceRule[];
    orRules: ChoiceRule[];
    notRule?: ChoiceRule;
    // Optional comment
    comment?: string;

    constructor(config: ChoiceRuleConfig) {
        this.variable = config.variable;
        this.next = config.next;
        this.stringEquals = config.stringEquals;
        this.stringLessThan = config.stringLessThan;
        this.stringGreaterThan = config.stringGreaterThan;
        this.stringLessThanEquals = config.stringLessThanEquals;
        this.stringGreaterThanEquals = config.stringGreaterThanEquals;
        this.numericEquals = config.numericEquals;
        this.numericLessThan = config.numericLessThan;
        this.numericGreaterThan = config.numericGreaterThan;
        this.numericLessThanEquals = config.numericLessThanEquals;
        this.numericGreaterThanEquals = config.numericGreaterThanEquals;
        this.booleanEquals = config.booleanEquals;
        this.timestampEquals = config.timestampEquals;
        this.timestampLessThan = config.timestampLessThan;
        this.timestampGreaterThan = config.timestampGreaterThan;
        this.timestampLessThanEquals = config.timestampLessThanEquals;
        this.timestampGreaterThanEquals = config.timestampGreaterThanEquals;
        this.andRules = config.andRules || [];
        this.orRules = config.orRules || [];
        this.notRule = config.notRule;
        this.comment = config.comment;
    }

    toDict(): Record<string, never> {
        const result: Record<string, any> = {
            Variable: this.variable,
            Next: this.next,
        };

        // Mapping of attribute names to their JSON keys for comparison operators
        const comparisonOps: Record<string, string> = {
            stringEquals: "StringEquals",
            stringLessThan: "StringLessThan",
            stringGreaterThan: "StringGreaterThan",
            stringLessThanEquals: "StringLessThanEquals",
            stringGreaterThanEquals: "StringGreaterThanEquals",
            numericEquals: "NumericEquals",
            numericLessThan: "NumericLessThan",
            numericGreaterThan: "NumericGreaterThan",
            numericLessThanEquals: "NumericLessThanEquals",
            numericGreaterThanEquals: "NumericGreaterThanEquals",
            booleanEquals: "BooleanEquals",
            timestampEquals: "TimestampEquals",
            timestampLessThan: "TimestampLessThan",
            timestampGreaterThan: "TimestampGreaterThan",
            timestampLessThanEquals: "TimestampLessThanEquals",
            timestampGreaterThanEquals: "TimestampGreaterThanEquals",
        };

        for (const [attr, key] of Object.entries(comparisonOps)) {
            const value = (this as any)[attr];
            if (value !== undefined) {
                result[key] = value;
            }
        }

        // Add compound operators if present
        if (this.andRules.length > 0) {
            result.And = this.andRules.map((rule) => rule.toDict());
        }
        if (this.orRules.length > 0) {
            result.Or = this.orRules.map((rule) => rule.toDict());
        }
        if (this.notRule !== undefined) {
            result.Not = this.notRule.toDict();
        }

        if (this.comment) {
            result.Comment = this.comment;
        }

        return result;
    }
}

export interface ChoiceStateConfig {
    name: string;
    choices?: ChoiceRule[];
    default?: string;
    inputPath?: string;
    resultPath?: string;
    outputPath?: string;
    comment?: string;
}

export class ChoiceState extends BaseState {
    choices: ChoiceRule[];
    default?: string;

    constructor(config: ChoiceStateConfig) {
        super();

        this.name = config.name;
        this.type = "Choice";
        this.choices = config.choices || [];
        this.default = config.default;
        this.nextState = undefined; // Choice states don't have Next
        this.end = false; // Choice states don't have End
        this.inputPath = config.inputPath;
        this.resultPath = config.resultPath;
        this.outputPath = config.outputPath;
        this.comment = config.comment;

        // Validate after initialization
        this.validate();
    }

    override validate(_options?: ValidateOptions): void {
        // Validate basic fields
        if (!this.name) {
            throw new Error("State name cannot be empty");
        }

        if (this.type !== "Choice") {
            throw new Error("Choice state must have Type 'Choice'");
        }

        // Choice states cannot have Next
        if (this.nextState !== undefined) {
            throw new Error(`Choice state '${this.name}' cannot have Next field`);
        }

        // Choice states cannot have End
        if (this.end) {
            throw new Error(`Choice state '${this.name}' cannot have End field`);
        }

        // Must have at least one choice or a default
        if (this.choices.length === 0 && this.default === undefined) {
            throw new Error(
                `Choice state '${this.name}' must have either Choices or Default`
            );
        }

        // Validate each choice
        for (let i = 0; i < this.choices.length; i++) {
            this.validateChoice(this.choices[i], i, true);
        }
    }

    private validateChoice(
        choice: ChoiceRule,
        index: number,
        nextRequired: boolean
    ): void {
        // Count operators
        const comparisonCount = this.countComparisonOperators(choice);
        const compoundCount = this.countCompoundOperators(choice);

        // For rules with comparison operators, Variable is required
        if (comparisonCount > 0 && !choice.variable) {
            throw new Error(
                `Choice ${index}: Variable is required for comparison operators`
            );
        }

        // Must have at least one operator
        if (comparisonCount === 0 && compoundCount === 0) {
            throw new Error(
                `Choice ${index}: must have at least one comparison operator or compound operator`
            );
        }

        // Validate Next field if required
        if (nextRequired && !choice.next) {
            throw new Error(`Choice ${index}: Next is required`);
        }

        // Validate nested compound operators recursively
        for (let i = 0; i < choice.andRules.length; i++) {
            this.validateChoice(choice.andRules[i], i, false);
        }

        for (let i = 0; i < choice.orRules.length; i++) {
            this.validateChoice(choice.orRules[i], i, false);
        }

        if (choice.notRule !== undefined) {
            this.validateChoice(choice.notRule, 0, false);
        }
    }

    private countComparisonOperators(choice: ChoiceRule): number {
        const operators = [
            choice.stringEquals,
            choice.stringLessThan,
            choice.stringGreaterThan,
            choice.stringLessThanEquals,
            choice.stringGreaterThanEquals,
            choice.numericEquals,
            choice.numericLessThan,
            choice.numericGreaterThan,
            choice.numericLessThanEquals,
            choice.numericGreaterThanEquals,
            choice.booleanEquals,
            choice.timestampEquals,
            choice.timestampLessThan,
            choice.timestampGreaterThan,
            choice.timestampLessThanEquals,
            choice.timestampGreaterThanEquals,
        ];

        return operators.filter((op) => op !== undefined).length;
    }

    private countCompoundOperators(choice: ChoiceRule): number {
        let count = 0;
        if (choice.andRules.length > 0) count++;
        if (choice.orRules.length > 0) count++;
        if (choice.notRule !== undefined) count++;
        return count;
    }

    async execute(
        inputData: any,
        context?: Record<string, any>
    ): Promise<[never, string | undefined]> {
        if (!context) context = {};

        try {
            // Get path processor
            const processor = this._pathProcessor || getPathProcessor();

            // Apply input path
            const processedInput = processor.applyInputPath(inputData, this.inputPath);

            // Evaluate each choice in order
            for (const choice of this.choices) {
                if (this.evaluateChoice(choice, processedInput)) {
                    // Apply result path and output path
                    const processedResult = processor.applyResultPath(
                        processedInput,
                        processedInput,
                        this.resultPath
                    );
                    const finalOutput = processor.applyOutputPath(
                        processedResult,
                        this.outputPath
                    );
                    if (finalOutput == undefined) {
                        return [inputData, choice.next];
                    } else {
                        return [finalOutput, choice.next];
                    }
                }
            }

            // No choice matched, use default if specified
            if (this.default !== undefined) {
                const processedResult = processor.applyResultPath(
                    processedInput,
                    processedInput,
                    this.resultPath
                );
                const finalOutput = processor.applyOutputPath(
                    processedResult,
                    this.outputPath
                );
                return [finalOutput, this.default];
            }

            // No choice matched and no default - this is an error
            throw new StateError(
                "no choice rule matched and no default specified",
                this.name
            );
        } catch (e: any) {
            if (e instanceof StateError) throw e;
            throw new StateError(
                `Failed to execute choice state '${this.name}': ${e.message || e}`,
                this.name,
                "States.Runtime"
            );
        }
    }

    private evaluateChoice(rule: ChoiceRule, inputData: any): boolean {
        // Determine the context for this rule
        let context = inputData;
        if (rule.variable) {
            context = this.getVariableValue(rule.variable, inputData);
            // If the variable doesn't exist, the choice evaluates to false
            if (context === undefined || context === null) {
                return false;
            }
        }

        // Handle compound operators
        if (rule.andRules.length > 0) {
            return this.evaluateAnd(rule.andRules, context);
        }

        if (rule.orRules.length > 0) {
            return this.evaluateOr(rule.orRules, context);
        }

        if (rule.notRule !== undefined) {
            return !this.evaluateChoice(rule.notRule, context);
        }

        // Evaluate comparison operators
        return this.evaluateComparison(rule, context);
    }

    private evaluateAnd(rules: ChoiceRule[], context: any): boolean {
        for (const rule of rules) {
            if (!this.evaluateChoice(rule, context)) {
                return false;
            }
        }
        return true;
    }

    private evaluateOr(rules: ChoiceRule[], context: any): boolean {
        for (const rule of rules) {
            if (this.evaluateChoice(rule, context)) {
                return true;
            }
        }
        return false;
    }
    private evaluateComparison(rule: ChoiceRule, variableValue: any): boolean {
        // Define comparison configurations
        const comparisons: Array<{
            attr: string;
            handler: (val: any, expected: any) => boolean;
        }> = [
            { attr: "stringEquals", handler: (val, exp) => this.compareString(val, exp, (a, b) => a === b) },
            { attr: "stringLessThan", handler: (val, exp) => this.compareString(val, exp, (a, b) => a < b) },
            { attr: "stringGreaterThan", handler: (val, exp) => this.compareString(val, exp, (a, b) => a > b) },
            { attr: "stringLessThanEquals", handler: (val, exp) => this.compareString(val, exp, (a, b) => a <= b) },
            { attr: "stringGreaterThanEquals", handler: (val, exp) => this.compareString(val, exp, (a, b) => a >= b) },
            { attr: "numericEquals", handler: (val, exp) => this.compareNumeric(val, exp, (a, b) => a === b) },
            { attr: "numericLessThan", handler: (val, exp) => this.compareNumeric(val, exp, (a, b) => a < b) },
            { attr: "numericGreaterThan", handler: (val, exp) => this.compareNumeric(val, exp, (a, b) => a > b) },
            { attr: "numericLessThanEquals", handler: (val, exp) => this.compareNumeric(val, exp, (a, b) => a <= b) },
            { attr: "numericGreaterThanEquals", handler: (val, exp) => this.compareNumeric(val, exp, (a, b) => a >= b) },
            { attr: "booleanEquals", handler: (val, exp) => this.compareBoolean(val, exp) },
            { attr: "timestampEquals", handler: (val, exp) => this.compareTimestamp(val, exp, (a, b) => a.getTime() === b.getTime()) },
            { attr: "timestampLessThan", handler: (val, exp) => this.compareTimestamp(val, exp, (a, b) => a.getTime() < b.getTime()) },
            { attr: "timestampGreaterThan", handler: (val, exp) => this.compareTimestamp(val, exp, (a, b) => a.getTime() > b.getTime()) },
            { attr: "timestampLessThanEquals", handler: (val, exp) => this.compareTimestamp(val, exp, (a, b) => a.getTime() <= b.getTime()) },
            { attr: "timestampGreaterThanEquals", handler: (val, exp) => this.compareTimestamp(val, exp, (a, b) => a.getTime() >= b.getTime()) },
        ];

        let operatorFound = false;

        // ASL Spec: If multiple comparators are present in a single rule, they are implicitly ANDed.
        // ALL conditions must evaluate to true for the rule to match.
        for (const { attr, handler } of comparisons) {
            const expected = (rule as any)[attr];
            if (expected !== undefined) {
                operatorFound = true;
                if (!handler(variableValue, expected)) {
                    return false; // If any condition fails, the entire rule fails
                }
            }
        }

        if (!operatorFound) {
            throw new StateError(
                "no comparison operator specified in choice rule",
                this.name
            );
        }

        return true; // All defined conditions passed
    }


    private compareString(
        variableValue: any,
        expected: string,
        compareFunc: (a: string, b: string) => boolean
    ): boolean {
        const strValue =
            typeof variableValue === "string" ? variableValue : String(variableValue);
        return compareFunc(strValue, expected);
    }

    private compareNumeric(
        variableValue: any,
        expected: number,
        compareFunc: (a: number, b: number) => boolean
    ): boolean {
        try {
            let numValue: number;
            if (typeof variableValue === "number") {
                numValue = variableValue;
            } else if (typeof variableValue === "string") {
                numValue = parseFloat(variableValue);
            } else {
                return false;
            }

            if (isNaN(numValue)) {
                return false;
            }

            return compareFunc(numValue, expected);
        } catch {
            return false;
        }
    }

    private compareBoolean(variableValue: any, expected: boolean): boolean {
        if (typeof variableValue === "boolean") {
            return variableValue === expected;
        } else if (typeof variableValue === "string") {
            const lowerStr = variableValue.toLowerCase();
            if (lowerStr === "true") {
                return expected === true;
            } else if (lowerStr === "false") {
                return expected === false;
            }
        }
        return false;
    }

    private compareTimestamp(
        variableValue: any,
        expectedStr: string,
        compareFunc: (a: Date, b: Date) => boolean
    ): boolean {
        try {
            const expectedTime = this.parseTimestamp(expectedStr);

            let variableTime: Date;
            if (variableValue instanceof Date) {
                variableTime = variableValue;
            } else if (typeof variableValue === "string") {
                variableTime = this.parseTimestamp(variableValue);
            } else if (typeof variableValue === "number") {
                // Assume Unix timestamp (seconds)
                variableTime = new Date(variableValue * 1000);
            } else {
                return false;
            }

            return compareFunc(variableTime, expectedTime);
        } catch {
            return false;
        }
    }

    private parseTimestamp(timestampStr: string): Date {
        // Try ISO format first (handles most common formats)
        const date = new Date(timestampStr);
        if (!isNaN(date.getTime())) {
            return date;
        }

        throw new Error(`Invalid timestamp format: ${timestampStr}`);
    }

    private getVariableValue(path: string, inputData: any): any {
        try {
            const processor = this._pathProcessor || getPathProcessor();
            return processor.applyInputPath(inputData, path);
        } catch {
            // Any error accessing the variable means it doesn't exist
            return undefined;
        }
    }

    override getNextStates(): string[] {
        const nextStates: string[] = [];

        // Add all choice destinations
        for (const choice of this.choices) {
            if (choice.next) {
                nextStates.push(choice.next);
            }
        }

        // Add default if present
        if (this.default !== undefined) {
            nextStates.push(this.default);
        }

        return nextStates;
    }

    override toDict(): Record<string, any> {
        const result: Record<string, any> = {
            Type: this.type,
            Choices: this.choices.map((choice) => choice.toDict()),
        };

        if (this.default !== undefined) {
            result.Default = this.default;
        }

        if (this.inputPath !== undefined) {
            result.InputPath = this.inputPath;
        }

        if (this.resultPath !== undefined) {
            result.ResultPath = this.resultPath;
        }

        if (this.outputPath !== undefined) {
            result.OutputPath = this.outputPath;
        }

        if (this.comment !== undefined) {
            result.Comment = this.comment;
        }

        return result;
    }

    override toString(): string {
        return `ChoiceState(name=${this.name})`;
    }
}
