import { StateMachine } from '../src'

describe('StateMachine', () => {
  const validDefinition = {
    StartAt: 'Hello',
    States: {
      Hello: {
        Type: 'Pass' as const,
        End: true,
      },
    },
  }

  it('creates from dict', () => {
    const sm = StateMachine.fromDict(validDefinition)
    expect(sm).toBeDefined()
  })

  it('creates from JSON', () => {
    const sm = StateMachine.fromJson(JSON.stringify(validDefinition))
    expect(sm).toBeDefined()
  })

  it('throws on missing StartAt', () => {
    expect(() =>
      StateMachine.fromDict({ StartAt: '', States: { A: { Type: 'Pass', End: true } } })
    ).toThrow()
  })

  it('throws when StartAt state does not exist', () => {
    expect(() =>
      StateMachine.fromDict({ StartAt: 'Missing', States: { A: { Type: 'Pass', End: true } } })
    ).toThrow()
  })

  it('executes and returns SUCCEEDED', async () => {
    const sm = StateMachine.fromDict(validDefinition)
    const exec = await sm.execute({ test: true })
    expect(exec.status).toBe('SUCCEEDED')
  })
})
