import type { ExecutionInterface, StateHistoryInterface, ExecutionFilter } from "../types";

export interface Repository {
  saveExecution(execution: ExecutionInterface): Promise<void>;
  getExecution(id: string): Promise<ExecutionInterface | null>;
  updateExecution(
    execution: Partial<ExecutionInterface> & { id: string },
  ): Promise<void>;
  listExecutions(filter?: ExecutionFilter): Promise<ExecutionInterface[]>;
  saveStateHistory(history: StateHistoryInterface): Promise<void>;
  getStateHistory(executionId: string): Promise<StateHistoryInterface[]>;
}
