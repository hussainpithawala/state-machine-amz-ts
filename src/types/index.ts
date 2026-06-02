export type ExecutionStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'ABORTED'

export interface StateDefinition {
  Type: StateType
  Next?: string
  End?: boolean
  Comment?: string
}

export type StateType =
  | 'Task'
  | 'Pass'
  | 'Choice'
  | 'Wait'
  | 'Succeed'
  | 'Fail'
  | 'Parallel'
  | 'Map'

export interface StateMachineDefinition {
  StartAt: string
  States: Record<string, StateDefinition>
  Comment?: string
  Version?: string
  TimeoutSeconds?: number
}

export interface Execution {
  id: string
  name: string
  stateMachineId: string
  status: ExecutionStatus
  input: unknown
  output?: unknown
  startTime: Date
  stopTime?: Date
  error?: string
  cause?: string
}

export interface StateHistory {
  id: string
  executionId: string
  stateName: string
  stateType: StateType
  status: ExecutionStatus
  input: unknown
  output?: unknown
  startTime: Date
  endTime?: Date
  retryCount: number
  error?: string
}

export interface ExecutionFilter {
  status?: ExecutionStatus
  stateMachineId?: string
  startAfter?: Date
  startBefore?: Date
  limit?: number
  offset?: number
}

export type TaskHandler = (
  resource: string,
  input: unknown,
  parameters?: Record<string, unknown>
) => Promise<unknown>
