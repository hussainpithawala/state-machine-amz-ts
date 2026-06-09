import type { Execution, StateHistoryInterface, ExecutionFilter } from "../types";

export interface Repository {
  saveExecution(execution: Execution): Promise<void>;
  getExecution(id: string): Promise<Execution | null>;
  updateExecution(
    execution: Partial<Execution> & { id: string },
  ): Promise<void>;
  listExecutions(filter?: ExecutionFilter): Promise<Execution[]>;
  saveStateHistory(history: StateHistoryInterface): Promise<void>;
  getStateHistory(executionId: string): Promise<StateHistoryInterface[]>;
}
