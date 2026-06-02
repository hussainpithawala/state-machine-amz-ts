import type { Execution, StateHistory, ExecutionFilter } from '../types'

export interface Repository {
  saveExecution(execution: Execution): Promise<void>
  getExecution(id: string): Promise<Execution | null>
  updateExecution(execution: Partial<Execution> & { id: string }): Promise<void>
  listExecutions(filter?: ExecutionFilter): Promise<Execution[]>
  saveStateHistory(history: StateHistory): Promise<void>
  getStateHistory(executionId: string): Promise<StateHistory[]>
}
