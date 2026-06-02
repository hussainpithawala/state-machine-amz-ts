import { randomUUID } from 'crypto'
import type { StateMachineDefinition, Execution } from '../types'
import { Executor } from '../executor'
import { InvalidDefinitionError } from '../errors'

export class StateMachine {
  private definition: StateMachineDefinition
  private executor: Executor

  constructor(definition: StateMachineDefinition, executor?: Executor) {
    this.definition = definition
    this.executor = executor ?? new Executor()
    this.validate()
  }

  static fromDict(definition: StateMachineDefinition, executor?: Executor): StateMachine {
    return new StateMachine(definition, executor)
  }

  static fromJson(json: string, executor?: Executor): StateMachine {
    return new StateMachine(JSON.parse(json) as StateMachineDefinition, executor)
  }

  private validate(): void {
    if (!this.definition.StartAt) {
      throw new InvalidDefinitionError('Missing StartAt')
    }
    if (!this.definition.States || Object.keys(this.definition.States).length === 0) {
      throw new InvalidDefinitionError('No states defined')
    }
    if (!this.definition.States[this.definition.StartAt]) {
      throw new InvalidDefinitionError(`StartAt state '${this.definition.StartAt}' not found`)
    }
  }

  async execute(input: unknown, name?: string): Promise<Execution> {
    const execution: Execution = {
      id: randomUUID(),
      name: name ?? randomUUID(),
      stateMachineId: this.definition.Comment ?? 'default',
      status: 'RUNNING',
      input,
      startTime: new Date(),
    }

    // TODO: full state machine execution engine
    execution.status = 'SUCCEEDED'
    execution.stopTime = new Date()

    return execution
  }
}
