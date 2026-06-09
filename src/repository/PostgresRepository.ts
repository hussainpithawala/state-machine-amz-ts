// TODO: PostgreSQL implementation
// Requires: npm install pg @types/pg
// Mirrors the SQLAlchemy implementation in state-machine-amz-py

import type { ExecutionInterface, StateHistoryInterface, ExecutionFilter } from "../types";
import type { Repository } from "./Repository";

export class PostgresRepository implements Repository {
  constructor(private connectionUrl: string) {}

  async saveExecution(_execution: ExecutionInterface): Promise<void> {
    throw new Error("PostgresRepository not yet implemented");
  }

  async getExecution(_id: string): Promise<ExecutionInterface | null> {
    throw new Error("PostgresRepository not yet implemented");
  }

  async updateExecution(
    _partial: Partial<ExecutionInterface> & { id: string },
  ): Promise<void> {
    throw new Error("PostgresRepository not yet implemented");
  }

  async listExecutions(_filter?: ExecutionFilter): Promise<ExecutionInterface[]> {
    throw new Error("PostgresRepository not yet implemented");
  }

  async saveStateHistory(_history: StateHistoryInterface): Promise<void> {
    throw new Error("PostgresRepository not yet implemented");
  }

  async getStateHistory(_executionId: string): Promise<StateHistoryInterface[]> {
    throw new Error("PostgresRepository not yet implemented");
  }
}
