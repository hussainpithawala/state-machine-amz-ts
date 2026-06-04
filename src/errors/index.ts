export class StateMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateMachineError";
  }
}

export class StateNotFoundError extends StateMachineError {
  constructor(stateName: string) {
    super(`State not found: ${stateName}`);
    this.name = "StateNotFoundError";
  }
}

export class TaskHandlerNotFoundError extends StateMachineError {
  constructor(resource: string) {
    super(`No handler registered for resource: ${resource}`);
    this.name = "TaskHandlerNotFoundError";
  }
}

export class ExecutionTimeoutError extends StateMachineError {
  constructor(executionId: string) {
    super(`Execution timed out: ${executionId}`);
    this.name = "ExecutionTimeoutError";
  }
}

export class InvalidDefinitionError extends StateMachineError {
  constructor(message: string) {
    super(`Invalid state machine definition: ${message}`);
    this.name = "InvalidDefinitionError";
  }
}

export class PersistenceError extends StateMachineError {
  constructor(message: string) {
    super(`Persistence error: ${message}`);
    this.name = "PersistenceError";
  }
}
