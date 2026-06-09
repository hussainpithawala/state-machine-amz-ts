/**
 * Executor for state machine execution management.
 *
 * Manages state machine executions, task handlers, and execution lifecycle.
 */
import Execution from "../execution/Execution";

// Use 'unknown' to avoid circular dependencies with BaseState while maintaining strict typing
export interface StateMachineInterface {
  getStartAt(): string;
  getState(name: string): unknown;
  isTimeout(startTime: Date): boolean;
  runExecution(
    execCtx: Execution,
    context?: Record<string, unknown>,
  ): Promise<Execution>;
}

export type TaskHandler = (inputData: unknown) => Promise<unknown> | unknown;

export abstract class Executor {
  /**
   * Execute a state machine with the given context.
   *
   * @param sm - State machine to execute
   * @param execCtx - Execution context
   * @param context - Optional additional context
   * @returns Completed execution context
   */
  abstract execute(
    sm: StateMachineInterface,
    execCtx: Execution,
    context?: Record<string, unknown>,
  ): Promise<Execution>;

  /**
   * Get the status of an execution.
   *
   * @param executionId - Execution ID
   * @returns Execution context
   * @throws Error if execution not found
   */
  abstract getStatus(executionId: string): Execution;

  /**
   * Stop an execution.
   *
   * @param execCtx - Execution to stop
   */
  abstract stop(execCtx: Execution): Promise<void>;

  /**
   * List all active executions.
   *
   * @returns List of execution contexts
   */
  abstract listExecutions(): Execution[];
}

/**
 * Registry for managing state task handlers.
 */
export class StateRegistry {
  private taskHandlers: Map<string, TaskHandler>;

  constructor() {
    this.taskHandlers = new Map();
  }

  /**
   * Register a handler for a task state.
   *
   * @param resourceUri - Resource URI (ARN)
   * @param handler - Handler function
   */
  public registerTaskHandler(resourceUri: string, handler: TaskHandler): void {
    this.taskHandlers.set(resourceUri, handler);
  }

  /**
   * Get a task handler by resource URI.
   *
   * @param resourceUri - Resource URI
   * @returns Handler function if found, undefined otherwise
   */
  public getTaskHandler(resourceUri: string): TaskHandler | undefined {
    return this.taskHandlers.get(resourceUri);
  }
}

/**
 * Base implementation of state machine executor.
 *
 * Provides common functionality for managing executions and task handlers.
 */
export class BaseExecutor extends Executor {
  protected executions: Map<string, Execution>;
  public registry: StateRegistry;

  constructor() {
    super();
    this.executions = new Map();
    this.registry = new StateRegistry();
  }

  /**
   * Execute a state machine.
   */
  public async execute(
    sm: StateMachineInterface,
    execCtx: Execution,
    context?: Record<string, unknown>,
  ): Promise<Execution> {
    if (!context) {
      context = {};
    }

    // Store execution
    this.executions.set(execCtx.id, execCtx);

    // Execute the state machine
    const result = await sm.runExecution(execCtx, context);

    // Remove from active executions if complete
    if (result.isComplete()) {
      this.executions.delete(execCtx.id);
    }

    return result;
  }

  /**
   * Get execution status.
   */
  public getStatus(executionId: string): Execution {
    const exec = this.executions.get(executionId);
    if (!exec) {
      throw new Error(`Execution '${executionId}' not found`);
    }
    return exec;
  }

  /**
   * Stop an execution.
   */
  public async stop(execCtx: Execution): Promise<void> {
    if (!execCtx) {
      throw new Error("Execution context cannot be null or undefined");
    }

    execCtx.status = "ABORTED";
    execCtx.endTime = new Date();

    // Remove from active executions
    this.executions.delete(execCtx.id);
  }

  /**
   * List all active executions.
   */
  public listExecutions(): Execution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Register a function as a task handler.
   *
   * @param name - Function name
   * @param fn - Handler function
   */
  public registerGoFunction(name: string, fn: TaskHandler): void {
    const resourceUri = `arn:aws:states:::lambda:function:${name}`;
    this.registry.registerTaskHandler(resourceUri, fn);
  }

  /**
   * Execute a task using registered handler.
   * (Placeholder for future implementation)
   *
   * @param taskState - Task state
   * @param inputData - Input data
   * @returns Task output
   */
  public async executeGoTask(
    taskState: unknown,
    inputData: unknown,
  ): Promise<unknown> {
    // Placeholder - actual implementation would use taskState.resource
    return inputData;
  }
}

/**
 * Adapter to provide ExecutionContext interface for states.
 *
 * Bridges the BaseExecutor with the state execution context.
 */
export class ExecutionContextAdapter {
  private executor: BaseExecutor;

  constructor(executor: BaseExecutor) {
    this.executor = executor;
  }

  /**
   * Get task handler for resource.
   *
   * @param resource - Resource URI
   * @returns Handler function if found
   */
  public getTaskHandler(resource: string): TaskHandler | undefined {
    if (!this.executor || !this.executor.registry) {
      return undefined;
    }
    return this.executor.registry.getTaskHandler(resource);
  }
}
