/**
 * Execution context for state machine executions.
 *
 * Tracks execution state, history, and metadata.
 */
import {ExecutionInterface, ExecutionStatus, StateHistoryInterface, StateType} from "../../src/types";
import {BaseState} from "../../src/states/base";

export interface StateHistoryConfig {
    id: string;
    executionId: string;
    stateName: string;
    stateType: StateType;
    status: ExecutionStatus;
    input?: unknown;
    output?: unknown;
    timestamp?: Date;
    startTime?: Date;
    endTime?: Date;
    retryCount?: number;
    sequenceNumber?: number;
    error?: Error;
}

export class StateHistory implements StateHistoryInterface {
    public id: string;
    public executionId: string;
    public stateName: string;
    public stateType: StateType;
    public status: ExecutionStatus;
    public input: unknown;
    public output: unknown;
    public timestamp: Date;
    public startTime: Date;
    public endTime: Date;
    public retryCount: number;
    public sequenceNumber: number;
    public error?: Error | undefined;

    constructor(config: {
        stateName: string;
        endTime: Date | undefined;
        error: Error | undefined;
        retryCount: number;
        startTime: Date | undefined;
        stateType: StateType;
        status: ExecutionStatus;
        input: unknown;
        output: unknown;
        executionId: string;
        id: string;
        timestamp: Date;
        sequenceNumber: number
    }) {
        this.id = config.id;
        this.executionId = config.executionId;
        this.stateName = config.stateName;
        this.stateType = config.stateType;
        this.status = config.status;
        this.input = config.input;
        this.output = config.output;
        this.timestamp = config.timestamp || new Date();
        this.startTime = config.startTime || new Date();
        this.endTime = config.endTime || new Date();
        this.retryCount = config.retryCount || 0;
        this.sequenceNumber = config.sequenceNumber || 0;
        this.error = config.error;
    }

    /**
     * Convert to dictionary for serialization.
     */
    public toDict(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            stateName: this.stateName,
            status: this.status,
            timestamp: this.timestamp.toISOString(),
        };

        if (this.stateType) {
            result.stateType = this.stateType;
        }
        if (this.input !== undefined) {
            result.input = this.input;
        }
        if (this.output !== undefined) {
            result.output = this.output;
        }
        if (this.retryCount > 0) {
            result.retryCount = this.retryCount;
        }
        if (this.error) {
            result.error = this.error.message;
        }

        return result;
    }
}

export interface ExecutionConfig {
    id: string;
    name: string;
    status?: ExecutionStatus | undefined;
    startTime?: Date;
    endTime?: Date;
    input?: unknown;
    output?: unknown;
    error?: Error | undefined;
    currentStateName?: string | undefined;
    currentState?: BaseState;
    history?: StateHistory[];
    stateMachineId: string;
}

class Execution implements ExecutionInterface {
    public id: string;
    public name: string;
    public status?: ExecutionStatus | undefined;
    public startTime: Date;
    public endTime: Date | undefined;
    public input: unknown;
    public output?: unknown;
    public error?: Error | undefined;
    public currentStateName?: string | undefined;
    public currentState?: BaseState | undefined;
    public history: StateHistory[];
    public stateMachineId?: string | undefined;

    constructor(config: ExecutionConfig) {
        this.id = config.id;
        this.name = config.name;
        this.status = config.status || undefined;
        this.startTime = config.startTime || new Date();
        this.endTime = config.endTime;
        this.input = config.input;
        this.output = config.output;
        this.error = config.error;
        this.currentStateName = config.currentStateName;
        this.currentState = config.currentState || undefined;
        this.history = config.history || [];
        this.stateMachineId = config.stateMachineId || "";
    }

    /**
     * Create a new execution context.
     */
    public static newContext(
        name: string,
        currentStateName: string,
        inputData: unknown
    ): Execution {
        return new Execution({
            id: generateExecutionId(),
            name,
            currentStateName: currentStateName,
            status: "RUNNING",
            startTime: new Date(),
            input: inputData,
            stateMachineId: "",
            history: [],
        });
    }

    /**
     * Create a new execution with a custom ID.
     * Note: Named 'create' instead of 'new' to avoid conflicts with the JS 'new' keyword,
     * while maintaining the same semantic meaning as the Python @classmethod.
     */
    public static create(
        id: string | undefined,
        name: string,
        inputData: unknown,
    ): Execution {
        return new Execution({
            id: id || generateExecutionId(),
            stateMachineId: "",
            name,
            status: "RUNNING",
            startTime: new Date(),
            input: inputData,
            history: [],
        });
    }

    /**
     * Add a state execution to history.
     */
    public addStateHistory(
        state: BaseState,
        inputData: unknown,
        output: unknown,
    ): void {
        this.history.push(
            new StateHistory({
                stateName: state.stateName,
                stateType: state.type,
                endTime: undefined,
                error: undefined,
                retryCount: 0,
                startTime: undefined,
                status: "SUCCEEDED",
                input: inputData,
                output,
                executionId: "",
                id: "",
                timestamp: new Date(),
                sequenceNumber: this.history.length
            }),
        );
    }

    /**
     * Get the last executed state.
     * @throws Error if no history is available
     */
    public getLastState(): StateHistory {
        if (this.history.length === 0) {
            throw new Error("No history available");
        }
        // @ts-ignore
        return this.history[this.history.length - 1];
    }

    /**
     * Get history for a specific state.
     */
    public getStateHistory(stateName: string): StateHistory[] {
        return this.history.filter((h) => h.stateName === stateName);
    }

    /**
     * Get execution duration in seconds.
     */
    public getDuration(): number {
        const end = this.endTime || new Date();
        return (end.getTime() - this.startTime.getTime()) / 1000;
    }

    /**
     * Check if execution is complete.
     */
    public isComplete(): boolean {
        if (this.status === undefined) {
            return false;
        } else {
            let statusString = this.status.toString();
            return ["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"].includes(
                statusString,
            );
        }
    }

    /**
     * Convert execution to dictionary for serialization.
     */
    public toDict(): Record<string, unknown> {
        const result: Record<string, unknown> = {
            id: this.id,
            name: this.name,
            status: this.status,
            startTime: this.startTime.toISOString(),
            currentState: this.currentState,
            duration: `${this.getDuration().toFixed(2)}s`,
        };

        if (this.stateMachineId) {
            result.stateMachineId = this.stateMachineId;
        }
        if (this.endTime) {
            result.endTime = this.endTime.toISOString();
        }
        if (this.input !== undefined) {
            result.input = this.input;
        }
        if (this.output !== undefined) {
            result.output = this.output;
        }
        if (this.error) {
            result.error = this.error.message;
        }

        // Add history summary
        if (this.history.length > 0) {
            result.history = this.history.map((h) => h.toDict());
        }

        return result;
    }

    /**
     * String representation of execution.
     */
    public toString(): string {
        return `Execution(id=${this.id}, name=${this.name}, status=${this.status}, states=${this.history.length})`;
    }
}

export default Execution

/**
 * Generate a unique execution ID.
 */
function generateExecutionId(): string {
    // Use native crypto.randomUUID if available (Node.js 14.17+ / modern browsers)
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `exec-${crypto.randomUUID().replace(/-/g, "").substring(0, 8)}`;
    }

    // Fallback for older environments
    return `exec-${Math.random().toString(36).substring(2, 10)}`;
}
