/**
 * Validator for state machine definitions.
 *
 * Validates state machine structure, state transitions, and configurations.
 */
import { BaseState } from '../states/base';

// Lightweight interfaces for safe property access without circular imports
interface ChoiceStateShape extends BaseState {
    default?: string;
    choices?: Array<{ next?: string }>;
}

interface TaskStateShape extends BaseState {
    catch?: Array<{ nextState: string }>;
}

export class StateMachineValidator {
    /**
     * Validate a state machine definition.
     *
     * @param startAt - Starting state name
     * @param states - Dictionary of states
     * @param timeoutSeconds - Optional timeout in seconds
     * @throws Error if validation fails
     */
    public validate(
        startAt: string,
        states: Record<string, BaseState>,
        timeoutSeconds?: number
    ): void {
        // Validate basic requirements
        if (!startAt) {
            throw new Error("StartAt is required");
        }

        if (!states || Object.keys(states).length === 0) {
            throw new Error("States cannot be empty");
        }

        // Validate StartAt references existing state
        if (!(startAt in states)) {
            throw new Error(`StartAt state '${startAt}' not found in States`);
        }

        // Validate timeout
        if (timeoutSeconds !== undefined && timeoutSeconds <= 0) {
            throw new Error("TimeoutSeconds must be positive");
        }

        // Validate each state
        for (const [stateName, state] of Object.entries(states)) {
            this.validateState(stateName, state, states);
        }

        // Validate state machine has at least one terminal state
        this.validateTerminalStates(states);

        // Validate all referenced states exist
        this.validateStateReferences(states);

        // Check for unreachable states
        this.validateReachability(startAt, states);
    }

    /**
     * Validate a single state.
     */
    private validateState(
        stateName: string,
        state: BaseState,
        _allStates: Record<string, BaseState>
    ): void {
        const terminalTypes = new Set(["Fail", "Succeed"]);

        if (!terminalTypes.has(state.stateType)) {
            if (!state.isEnd() && state.getNext() === undefined) {
                throw new Error(`State '${stateName}' must have either Next or End set`);
            }

            // Cannot have both End and Next
            if (state.isEnd() && state.getNext() !== undefined) {
                throw new Error(`State '${stateName}' cannot have both Next and End set`);
            }
        }
    }

    /**
     * Validate that state machine has at least one terminal state.
     */
    private validateTerminalStates(states: Record<string, BaseState>): void {
        const terminalTypes = new Set(["Fail", "Succeed"]);

        const hasTerminal = Object.values(states).some(
            (state) => state.isEnd() || terminalTypes.has(state.stateType)
        );

        if (!hasTerminal) {
            throw new Error("State machine must have at least one terminal state");
        }
    }

    /**
     * Validate all state references point to existing states.
     */
    private validateStateReferences(states: Record<string, BaseState>): void {
        for (const [stateName, state] of Object.entries(states)) {
            // Check Next reference
            const nextState = state.getNext();
            if (nextState !== undefined && !(nextState in states)) {
                throw new Error(`State '${stateName}' references non-existent state '${nextState}'`);
            }

            // Check state-specific references
            this.validateStateSpecificReferences(stateName, state, states);
        }
    }

    /**
     * Validate state-specific references (e.g., Choice, Task).
     */
    private validateStateSpecificReferences(
        stateName: string,
        state: BaseState,
        allStates: Record<string, BaseState>
    ): void {
        // Validate Choice state
        if (state.stateType === "Choice") {
            const choiceState = state as ChoiceStateShape;

            if (choiceState.default !== undefined && choiceState.default !== null) {
                if (!(choiceState.default in allStates)) {
                    throw new Error(`Choice state '${stateName}' default '${choiceState.default}' not found`);
                }
            }

            if (choiceState.choices && Array.isArray(choiceState.choices)) {
                for (let i = 0; i < choiceState.choices.length; i++) {
                    const choice = choiceState.choices[i];
                    if (choice.next !== undefined && !(choice.next in allStates)) {
                        throw new Error(
                            `Choice state '${stateName}' choice ${i} references non-existent state '${choice.next}'`
                        );
                    }
                }
            }
        }

        // Validate Task state Catch
        if (state.stateType === "Task") {
            const taskState = state as TaskStateShape;

            if (taskState.catch && Array.isArray(taskState.catch)) {
                for (let i = 0; i < taskState.catch.length; i++) {
                    const catchRule = taskState.catch[i];
                    if (!(catchRule.nextState in allStates)) {
                        throw new Error(
                            `Task state '${stateName}' catch ${i} references non-existent state '${catchRule.nextState}'`
                        );
                    }
                }
            }
        }
    }

    /**
     * Validate all states are reachable from StartAt.
     * Note: This is an informational validation. Unreachable states are allowed
     * but may indicate a configuration error.
     */
    private validateReachability(startAt: string, states: Record<string, BaseState>): void {
        const reachable = new Set<string>();
        const toVisit: string[] = [startAt];

        while (toVisit.length > 0) {
            const current = toVisit.pop()!;

            if (reachable.has(current)) {
                continue;
            }

            reachable.add(current);

            if (!(current in states)) {
                continue;
            }

            const state = states[current];
            const nextStates = this.getNextStates(state);
            toVisit.push(...nextStates);
        }

        // Check for unreachable states
        const allStateNames = Object.keys(states);
        const unreachable = allStateNames.filter((name) => !reachable.has(name));

        if (unreachable.length > 0) {
            // As per the Python implementation, this is informational.
            // In a production system, you might want to log this as a warning:
            // console.warn(`Warning: Unreachable states detected: ${unreachable.join(', ')}`);
        }
    }

    /**
     * Get all possible next states from a state.
     */
    private getNextStates(state: BaseState): string[] {
        const nextStates: string[] = [];

        // BaseState already implements getNextStates(), but we keep the fallback
        // logic from the Python version for maximum safety.
        if (typeof (state as any).getNextStates === "function") {
            nextStates.push(...state.getNextStates());
        } else if (state.getNext() !== undefined) {
            nextStates.push(state.getNext()!);
        }

        return nextStates;
    }
}
