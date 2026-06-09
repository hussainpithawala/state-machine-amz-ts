import {BaseState, StateError} from "./../../src/states/base";

export type ExecutionStatus =
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "TIMED_OUT"
    | "ABORTED";

export interface StateDefinition {

    Type: StateType;
    Next?: string;
    End?: boolean;
    Comment?: string;
}

export type StateType =
    | "Task"
    | "Pass"
    | "Choice"
    | "Wait"
    | "Succeed"
    | "Fail"
    | "Parallel"
    | "Map";

export interface StateMachineDefinition {
    StartAt: string;
    States: Record<string, StateDefinition>;
    Comment?: string;
    Version?: string;
    TimeoutSeconds?: number;
}

export interface ExecutionInterface {
    id: string;
    name: string;
    stateMachineId?: string | undefined;
    status?: ExecutionStatus | undefined;
    input: unknown;
    output?: unknown;
    endTime?: Date | undefined;
    startTime: Date;
    stopTime?: Date;
    error?: Error | undefined;
    cause?: string;
    currentState?: BaseState | undefined;
    history: StateHistoryInterface[];
}

export interface StateHistoryInterface {
    id: string;
    executionId: string;
    stateName: string;
    stateType: StateType;
    status: ExecutionStatus;
    input: unknown;
    output?: unknown;
    startTime: Date;
    endTime?: Date;
    retryCount: number;
    error?: Error
        | undefined;
}

export interface ExecutionFilter {
    status?: ExecutionStatus;
    stateMachineId?: string;
    startAfter?: Date;
    startBefore?: Date;
    limit?: number;
    offset?: number;
}

export const EXECUTION_CONTEXT_KEY = "executionContext";

export interface TaskHandler {
    execute(
        resource: string,
        inputData: unknown,
        parameters?: Record<string, unknown>,
    ): Promise<unknown>;

    executeWithTimeout(
        resource: string,
        inputData: unknown,
        parameters?: Record<string, unknown>,
        timeoutSeconds?: number,
        context?: Record<string, unknown>,
    ): Promise<unknown>;

    canHandle(resource: string): boolean;
}

export interface ExecutionContext {
    getTaskHandler(
        resource: string,
    ):
        | TaskHandler
        | ((
        resource: string,
        inputData: unknown,
        parameters?: Record<string, unknown>,
    ) => Promise<unknown>)
        | null;
}

export class DefaultTaskHandler implements TaskHandler {
    async execute(
        resource: string,
        inputData: unknown,
        _parameters?: Record<string, unknown>,
        context?: Record<string, unknown>,
    ): Promise<unknown> {
        if (!context) context = {};
        const execCtx = context[EXECUTION_CONTEXT_KEY] as
            | ExecutionContext
            | undefined;

        if (execCtx) {
            const handler = execCtx.getTaskHandler(resource);
            if (handler) {
                return typeof handler === "function"
                    ? await handler(resource, inputData, _parameters)
                    : await handler.execute(resource, inputData, _parameters);
            }
        }
        return inputData; // Fallback
    }

    async executeWithTimeout(
        resource: string,
        inputData: unknown,
        parameters?: Record<string, unknown>,
        timeoutSeconds?: number,
        context?: Record<string, unknown>,
    ): Promise<unknown> {
        if (!timeoutSeconds || timeoutSeconds <= 0) {
            return this.execute(resource, inputData, parameters, context);
        }

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
                () =>
                    reject(
                        new Error(
                            `Task execution timed out after ${timeoutSeconds} seconds`,
                        ),
                    ),
                timeoutSeconds * 1000,
            );
        });

        try {
            return await Promise.race([
                this.execute(resource, inputData, parameters, context),
                timeoutPromise,
            ]);
        } catch (error) {
            if (error instanceof Error && error.message.includes("timed out")) {
                throw new StateError(
                    `Task execution timed out after ${timeoutSeconds} seconds`,
                    "UnknownState",
                    "States.Timeout",
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId!);
        }
    }

    canHandle(_resource: string): boolean {
        return true;
    }
}
