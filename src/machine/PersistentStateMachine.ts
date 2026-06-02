import type { StateMachineDefinition, Execution, ExecutionFilter, StateHistory } from '../types'
import type { Repository } from '../repository/Repository'
import { Executor } from '../executor'
import { StateMachine } from './StateMachine'

export class PersistentStateMachine extends StateMachine {
  constructor(
    definition: StateMachineDefinition,
    private repository: Repository,
    executor?: Executor
  ) {
    super(definition, executor)
  }

  static create(
    definition: StateMachineDefinition,
    repository: Repository,
    executor?: Executor
  ): PersistentStateMachine {
    return new PersistentStateMachine(definition, repository, executor)
  }

  override async execute(input: unknown, name?: string): Promise<Execution> {
    const execution = await super.execute(input, name)
    await this.repository.saveExecution(execution)
    return execution
  }

  async getExecutionHistory(executionId: string): Promise<StateHistory[]> {
    return this.repository.getStateHistory(executionId)
  }

  async listExecutions(filter?: ExecutionFilter): Promise<Execution[]> {
    return this.repository.listExecutions(filter)
  }
}
