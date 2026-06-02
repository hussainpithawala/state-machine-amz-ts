import type { TaskHandler } from '../types'
import { TaskHandlerNotFoundError } from '../errors'

export class Executor {
  private handlers = new Map<string, TaskHandler>()

  registerHandler(resource: string, handler: TaskHandler): this {
    this.handlers.set(resource, handler)
    return this
  }

  async execute(resource: string, input: unknown, parameters?: Record<string, unknown>): Promise<unknown> {
    const handler = this.handlers.get(resource)
    if (!handler) {
      throw new TaskHandlerNotFoundError(resource)
    }
    return handler(resource, input, parameters)
  }

  hasHandler(resource: string): boolean {
    return this.handlers.has(resource)
  }
}
