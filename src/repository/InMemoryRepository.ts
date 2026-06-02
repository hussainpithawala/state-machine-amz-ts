import type { Execution, StateHistory, ExecutionFilter } from '../types'
import type { Repository } from './Repository'

export class InMemoryRepository implements Repository {
  private executions = new Map<string, Execution>()
  private histories = new Map<string, StateHistory[]>()

  async saveExecution(execution: Execution): Promise<void> {
    this.executions.set(execution.id, { ...execution })
  }

  async getExecution(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null
  }

  async updateExecution(partial: Partial<Execution> & { id: string }): Promise<void> {
    const existing = this.executions.get(partial.id)
    if (!existing) return
    this.executions.set(partial.id, { ...existing, ...partial })
  }

  async listExecutions(filter?: ExecutionFilter): Promise<Execution[]> {
    let results = Array.from(this.executions.values())
    if (filter?.status) results = results.filter(e => e.status === filter.status)
    if (filter?.stateMachineId) results = results.filter(e => e.stateMachineId === filter.stateMachineId)
    if (filter?.startAfter) results = results.filter(e => e.startTime >= filter.startAfter!)
    if (filter?.startBefore) results = results.filter(e => e.startTime <= filter.startBefore!)
    const offset = filter?.offset ?? 0
    const limit = filter?.limit ?? results.length
    return results.slice(offset, offset + limit)
  }

  async saveStateHistory(history: StateHistory): Promise<void> {
    const existing = this.histories.get(history.executionId) ?? []
    existing.push({ ...history })
    this.histories.set(history.executionId, existing)
  }

  async getStateHistory(executionId: string): Promise<StateHistory[]> {
    return this.histories.get(executionId) ?? []
  }
}
