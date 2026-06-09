/**
 * State Machine implementation for Amazon States Language.
 *
 * Main state machine class that loads, validates, and executes state machines.
 */
import * as yaml from "js-yaml";
import { BaseState } from "../states/base";
import Execution from "../execution/Execution";
import { StateFactory } from "../factory/StateFactory";
import { StateMachineValidator } from "../validator/StateMachineValidator";

export interface StateMachineConfig {
  comment?: string | undefined;
  startAt: string;
  states: Record<string, BaseState>;
  timeoutSeconds?: number | undefined;
  version?: string | undefined;
}

export class StateMachine {
  public comment?: string | undefined;
  public startAt: string;
  public states: Record<string, BaseState>;
  public timeoutSeconds?: number | undefined;
  public version: string;

  private _validator: StateMachineValidator;
  private _createdAt: Date;

  constructor(config: StateMachineConfig) {
    this.comment = config.comment;
    this.startAt = config.startAt;
    this.states = config.states;
    this.timeoutSeconds = config.timeoutSeconds;
    this.version = config.version ?? "1.0";

    this._validator = new StateMachineValidator();
    this._createdAt = new Date();
  }

  /**
   * Create a state machine from JSON definition.
   */
  public static fromJson(definition: string): StateMachine {
    try {
      const data = JSON.parse(definition) as Record<string, unknown>;
      return this.fromDict(data);
    } catch (e) {
      throw new Error(
        `Failed to parse JSON definition: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Create a state machine from YAML definition.
   */
  public static fromYaml(definition: string): StateMachine {
    try {
      const data = yaml.load(definition) as Record<string, unknown>;
      return this.fromDict(data);
    } catch (e) {
      throw new Error(
        `Failed to parse YAML definition: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Create state machine from dictionary.
   */
  public static fromDict(data: Record<string, unknown>): StateMachine {
    // Safely extract types to satisfy exactOptionalPropertyTypes
    const comment = typeof data.Comment === "string" ? data.Comment : undefined;
    const startAt = typeof data.StartAt === "string" ? data.StartAt : "";
    const timeoutSeconds =
      typeof data.TimeoutSeconds === "number" ? data.TimeoutSeconds : undefined;
    const version = typeof data.Version === "string" ? data.Version : "1.0";

    if (
      !data.States ||
      typeof data.States !== "object" ||
      Object.keys(data.States).length === 0
    ) {
      throw new Error(
        "Failed to unmarshal state machine definition: States is required and cannot be empty",
      );
    }

    const stateFactory = new StateFactory();
    const states: Record<string, BaseState> = {};

    for (const [stateName, stateData] of Object.entries(
      data.States as Record<string, unknown>,
    )) {
      try {
        const state = stateFactory.createState(
          stateName,
          stateData as Record<string, unknown>,
        );
        states[stateName] = state;
      } catch (e) {
        throw new Error(
          `Failed to create state '${stateName}': ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    const sm = new StateMachine({
      comment,
      startAt,
      states,
      timeoutSeconds,
      version,
    });

    try {
      sm.validate();
    } catch (e) {
      throw new Error(
        `State machine validation failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return sm;
  }

  /**
   * Validate the state machine definition.
   */
  public validate(): void {
    this._validator.validate(this.startAt, this.states, this.timeoutSeconds);
  }

  /**
   * Get the start state name.
   */
  public getStartAt(): string {
    return this.startAt;
  }

  /**
   * Get a state by name.
   */
  public getState(name: string): BaseState {
    const state = this.states[name];
    if (state === undefined) {
      throw new Error(`State '${name}' not found`);
    }
    return state;
  }

  /**
   * Execute the state machine with given input.
   */
  public async execute(
    inputData: unknown,
    context?: Record<string, unknown>,
    executionName?: string,
    _executionId?: string,
  ): Promise<Execution> {
    if (!context) {
      context = {};
    }

    if (!executionName) {
      executionName = `execution-${Math.floor(Date.now() / 1000)}`;
    }

    const execCtx = Execution.newContext(
      executionName,
      this.startAt,
      inputData,
    );

    return this.runExecution(execCtx, context);
  }

  /**
   * Run an execution with the given context.
   */
  public async runExecution(
    execCtx: Execution,
    context?: Record<string, unknown>,
  ): Promise<Execution> {
    if (!context) {
      context = {};
    }

    let currentStateName = this.startAt;
    let currentInput = execCtx.input;

    while (true) {
      // Check for timeout
      if (this.timeoutSeconds !== undefined) {
        // @ts-ignore
        const elapsed =
          (new Date().getTime() - execCtx.startTime.getTime()) / 1000;
        if (elapsed > this.timeoutSeconds) {
          execCtx.status = "TIMED_OUT";
          execCtx.endTime = new Date();
          execCtx.error = new Error(
            `State machine timed out after ${this.timeoutSeconds} seconds`,
          );
          return execCtx;
        }
      }

      // Get current state
      let state: BaseState;
      try {
        state = this.getState(currentStateName);
      } catch (e) {
        execCtx.status = "FAILED";
        execCtx.endTime = new Date();
        execCtx.error = e instanceof Error ? e : new Error(String(e));
        return execCtx;
      }

      // Update execution context
      execCtx.currentState = state;

      // Execute the state
      try {
        const [output, nextState] = await state.execute(currentInput, context);

        // Record state history
        execCtx.addStateHistory(state, currentInput, output);

        // Check if this is an end state
        if (state.isEnd() || nextState === undefined) {
          execCtx.status = "SUCCEEDED";
          execCtx.endTime = new Date();
          execCtx.output = output;
          break;
        }

        // Move to next state
        currentStateName = nextState;
        currentInput = output;
      } catch (e) {
        // State execution failed
        execCtx.status = "FAILED";
        execCtx.endTime = new Date();
        execCtx.error = e instanceof Error ? e : new Error(String(e));
        execCtx.output = undefined;

        // Record failed state in history
        execCtx.addStateHistory(state, currentInput, undefined);
        return execCtx;
      }
    }

    return execCtx;
  }

  /**
   * Get a summary of the state machine.
   */
  public getExecutionSummary(): Record<string, unknown> {
    const summary: Record<string, unknown> = {
      startAt: this.startAt,
      statesCount: Object.keys(this.states).length,
      version: this.version,
      createdAt: this._createdAt.toISOString(),
    };

    if (this.timeoutSeconds !== undefined) {
      summary.timeoutSeconds = this.timeoutSeconds;
    }

    if (this.comment !== undefined) {
      summary.comment = this.comment;
    }

    // Count state types
    const stateTypes: Record<string, number> = {};
    for (const state of Object.values(this.states)) {
      const stateType = state.stateTypeAsString;
      stateTypes[stateType] = (stateTypes[stateType] || 0) + 1;
    }

    summary.stateTypes = stateTypes;

    return summary;
  }

  /**
   * Check if execution has timed out.
   */
  public isTimeout(startTime: Date): boolean {
    if (this.timeoutSeconds === undefined) {
      return false;
    }

    const elapsed = (new Date().getTime() - startTime.getTime()) / 1000;
    return elapsed > this.timeoutSeconds;
  }

  /**
   * Convert state machine to dictionary.
   */
  public toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      StartAt: this.startAt,
      States: Object.fromEntries(
        Object.entries(this.states).map(([name, state]) => [
          name,
          state.toDict(),
        ]),
      ),
    };

    if (this.comment !== undefined) {
      result.Comment = this.comment;
    }

    if (this.timeoutSeconds !== undefined) {
      result.TimeoutSeconds = this.timeoutSeconds;
    }

    if (this.version !== "1.0") {
      result.Version = this.version;
    }

    return result;
  }

  /**
   * Convert state machine to JSON string.
   */
  public toJson(indent?: number): string {
    return JSON.stringify(this.toDict(), null, indent);
  }

  /**
   * Convert state machine to YAML string.
   */
  public toYaml(): string {
    return yaml.dump(this.toDict(), { noRefs: true });
  }
}

// ==========================================
// Execution Options
// ==========================================

export class ExecutionOptions {
  public name?: string | undefined;

  constructor(name?: string) {
    this.name = name;
  }
}

export function withExecutionName(
  name: string,
): (opts: ExecutionOptions) => void {
  return (opts: ExecutionOptions) => {
    opts.name = name;
  };
}
