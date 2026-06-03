/**
 * Parallel state implementation for Amazon States Language.
 *
 * Executes multiple branches concurrently and collects their results.
 */
import {BaseState, StateError, getPathProcessor, ValidateOptions, PathProcessor} from "./base";

export interface BranchConfig {
    startAt: string;
    states: Record<string, BaseState>;
    comment?: string;
}

/**
 * Represents a single branch in a Parallel state.
 * Each branch is essentially a mini state machine with its own
 * StartAt and States configuration.
 */
export class Branch {
    public startAt: string;
    public states: Record<string, BaseState>;
    public comment?: string;

    constructor(config: BranchConfig) {
        this.startAt = config.startAt;
        this.states = config.states;
        this.comment = config.comment;
        this.validate();
    }

    private validate(): void {
        if (!this.startAt) {
            throw new Error("Branch StartAt is required");
        }
        if (!this.states || Object.keys(this.states).length === 0) {
            throw new Error("Branch must have at least one state");
        }
    }

    public toDict(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            StartAt: this.startAt,
            States: Object.fromEntries(
                Object.entries(this.states).map(([name, state]) => [name, state.toDict()])
            ),
        };

        if (this.comment !== undefined) {
            result.Comment = this.comment;
        }

        return result;
    }
}

export interface ParallelStateConfig {
    name: string;
    branches: Branch[];
    resultSelector?: Record<string, unknown>;
    nextState?: string;
    end?: boolean;
    inputPath?: string;
    resultPath?: string;
    outputPath?: string;
    comment?: string;
}

/**
 * Parallel state for executing multiple branches concurrently.
 *
 * The Parallel state executes all branches simultaneously and waits for
 * all to complete. Results from all branches are collected into an array.
 */
export class ParallelState extends BaseState {
    public branches: Branch[];
    public resultSelector?: Record<string, unknown>;

    constructor(config: ParallelStateConfig) {
        super();
        this.name = config.name;
        this.type = "Parallel";
        this.branches = config.branches;
        this.resultSelector = config.resultSelector;
        this.nextState = config.nextState;
        this.end = config.end ?? false;
        this.inputPath = config.inputPath;
        this.resultPath = config.resultPath;
        this.outputPath = config.outputPath;
        this.comment = config.comment;

        this.validate();
    }

    override validate(options?: ValidateOptions): void {
        // 1. Validate branches first (structural validation)
        if (!this.branches || this.branches.length === 0) {
            throw new Error(`Parallel state '${this.name}' must have at least one branch`);
        }

        // Validate each branch
        for (let i = 0; i < this.branches.length; i++) {
            const branch = this.branches[i];

            if (!branch.startAt) {
                throw new Error(`Parallel state '${this.name}' branch ${i}: StartAt is required`);
            }
            if (!branch.states || Object.keys(branch.states).length === 0) {
                throw new Error(`Parallel state '${this.name}' branch ${i}: States must not be empty`);
            }
            if (!(branch.startAt in branch.states)) {
                throw new Error(
                    `Parallel state '${this.name}' branch ${i}: StartAt state '${branch.startAt}' not found`
                );
            }

            // Validate that all states in the branch have proper configuration
            // This is where the "State must have either Next or End" error will surface
            // for invalid inner states (like the PassState in the test).
            for (const stateName of Object.keys(branch.states)) {
                branch.states[stateName].validate();
            }
        }

        // 2. Call super.validate() to check name, etc.
        // We pass skipNextState: true because ParallelState's Next/End validation
        // is deferred to the StateMachineValidator (matching the Python implementation).
        super.validate({ ...options, skipType: true, skipNextState: true, type: "Parallel" });
    }

    async execute(
        inputData: unknown,
        context?: Record<string, unknown>
    ): Promise<[unknown, string | undefined]> {
        if (!context) context = {};

        try {
            const processor = this._pathProcessor || getPathProcessor();

            // Apply input path
            const processedInput = processor.applyInputPath(inputData, this.inputPath);

            // Execute all branches concurrently
            const tasks = this.branches.map((branch) =>
                this.executeBranch(branch, processedInput, context!)
            );
            const results = await Promise.all(tasks);

            // Combine results into an array
            let output: unknown = results;

            // Apply result selector if provided
            if (this.resultSelector !== undefined) {
                output = this.expandValue(this.resultSelector, { $: results }, processor); // 👈 Pass processor
            }

            // Apply result path
            output = processor.applyResultPath(processedInput, output, this.resultPath);

            // Apply output path
            output = processor.applyOutputPath(output, this.outputPath);

            return [output, this.nextState];
        } catch (e) {
            if (e instanceof StateError) throw e;
            throw new StateError(
                `Parallel state execution failed: ${e instanceof Error ? e.message : String(e)}`,
                this.name,
                "States.Runtime"
            );
        }
    }

    /**
     * Execute a single branch as a mini state machine.
     */
    private async executeBranch(
        branch: Branch,
        inputData: unknown,
        context: Record<string, unknown>
    ): Promise<unknown> {
        let currentStateName = branch.startAt;
        let currentInput = inputData;

        while (true) {
            const state = branch.states[currentStateName];
            if (!state) {
                throw new StateError(
                    `State "${currentStateName}" not found in branch`,
                    this.name,
                    "States.Runtime"
                );
            }

            // Execute the state
            const [output, nextState] = await state.execute(currentInput, context);

            // Check if this is an end state
            if (state.isEnd() || nextState === undefined) {
                return output;
            }

            // Move to next state
            currentStateName = nextState;
            currentInput = output;
        }
    }

    /**
     * Get all possible next states.
     * Note: Branch states are not included here as they're internal to the Parallel state.
     */
    override getNextStates(): string[] {
        if (this.nextState !== undefined) {
            return [this.nextState];
        }
        return [];
    }

    override toDict(): Record<string, unknown> {
        const result = super.toDict() as Record<string, unknown>;
        result.Branches = this.branches.map((branch) => branch.toDict());

        if (this.resultSelector !== undefined) {
            result.ResultSelector = this.resultSelector;
        }

        return result;
    }

    // ==========================================
    // Helper methods for ResultSelector
    // ==========================================

    private expandValue(template: unknown, context: Record<string, unknown>, processor: PathProcessor): unknown {
        // If it's a string starting with "$", evaluate it as a JSONPath against the context data
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


    private extractValue(path: string, context: Record<string, unknown>): unknown {
        if (path === "$") return context["$"];
        const parts = path.replace(/^\$\./, "").split(".");
        let current: unknown = context["$"];

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== "object") {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }
        return current;
    }

    // ==========================================
    // Factory / Parsing Methods
    // ==========================================

    /**
     * Create ParallelState from dictionary.
     * Note: Added 'name' parameter which was implicitly missing in the Python version.
     */
    public static fromDict(
        name: string,
        stateDict: Record<string, unknown>,
        stateFactory?: { createState: (name: string, data: Record<string, unknown>) => BaseState }
    ): ParallelState {
        const nextState = stateDict.Next as string | undefined;
        const end = (stateDict.End as boolean) ?? false;
        const inputPath = stateDict.InputPath as string | undefined;
        const resultPath = stateDict.ResultPath as string | undefined;
        const outputPath = stateDict.OutputPath as string | undefined;
        const comment = stateDict.Comment as string | undefined;
        const resultSelector = stateDict.ResultSelector as Record<string, unknown> | undefined;

        // Parse branches
        const branches: Branch[] = [];
        const branchesData = stateDict.Branches as Record<string, unknown>[] | undefined;
        if (Array.isArray(branchesData)) {
            for (const branchDict of branchesData) {
                branches.push(this.parseBranch(branchDict, stateFactory));
            }
        }

        return new ParallelState({
            name,
            branches,
            resultSelector,
            nextState,
            end,
            inputPath,
            resultPath,
            outputPath,
            comment,
        });
    }

    /**
     * Parse a branch from dictionary.
     */
    public static parseBranch(
        branchDict: Record<string, unknown>,
        stateFactory?: { createState: (name: string, data: Record<string, unknown>) => BaseState }
    ): Branch {
        const startAt = (branchDict.StartAt as string) || "";
        const comment = branchDict.Comment as string | undefined;
        const statesDict = branchDict.States as Record<string, unknown> | undefined;

        const states: Record<string, BaseState> = {};
        if (statesDict && typeof statesDict === "object") {
            if (stateFactory) {
                for (const [stateName, stateData] of Object.entries(statesDict)) {
                    states[stateName] = stateFactory.createState(stateName, stateData as Record<string, unknown>);
                }
            } else {
                throw new Error("StateFactory is required to parse branch states from dictionary.");
            }
        }

        return new Branch({ startAt, states, comment });
    }
}

/**
 * Helper function to create a Branch.
 */
export function createBranch(
    startAt: string,
    states: Record<string, BaseState>,
    comment?: string
): Branch {
    return new Branch({ startAt, states, comment });
}
