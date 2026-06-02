import { PersistentStateMachine, InMemoryRepository, Executor } from '../src'

const repository = new InMemoryRepository()
const executor = new Executor()

const definition = {
  StartAt: 'Start',
  States: {
    Start: {
      Type: 'Pass' as const,
      End: true,
    },
  },
}

const sm = PersistentStateMachine.create(definition, repository, executor)

async function main() {
  const execution = await sm.execute({ data: 'example' })
  console.log('Execution:', execution.id, execution.status)

  const history = await sm.getExecutionHistory(execution.id)
  console.log('History entries:', history.length)

  const all = await sm.listExecutions()
  console.log('Total executions:', all.length)
}

main()
