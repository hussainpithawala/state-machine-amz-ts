import { InMemoryRepository } from '../src'
import type { Execution } from '../src'

const makeExecution = (id: string): Execution => ({
  id,
  name: `exec-${id}`,
  stateMachineId: 'test-sm',
  status: 'SUCCEEDED',
  input: {},
  startTime: new Date(),
})

describe('InMemoryRepository', () => {
  let repo: InMemoryRepository

  beforeEach(() => {
    repo = new InMemoryRepository()
  })

  it('saves and retrieves an execution', async () => {
    const exec = makeExecution('1')
    await repo.saveExecution(exec)
    const retrieved = await repo.getExecution('1')
    expect(retrieved?.id).toBe('1')
  })

  it('returns null for unknown id', async () => {
    const result = await repo.getExecution('nonexistent')
    expect(result).toBeNull()
  })

  it('updates execution status', async () => {
    await repo.saveExecution(makeExecution('2'))
    await repo.updateExecution({ id: '2', status: 'FAILED' })
    const updated = await repo.getExecution('2')
    expect(updated?.status).toBe('FAILED')
  })

  it('lists executions with filter', async () => {
    await repo.saveExecution(makeExecution('3'))
    await repo.saveExecution({ ...makeExecution('4'), status: 'FAILED' })
    const succeeded = await repo.listExecutions({ status: 'SUCCEEDED' })
    expect(succeeded.length).toBe(1)
  })
})
