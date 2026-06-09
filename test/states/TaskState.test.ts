/**
 * Tests for TaskState implementation.
 */
import { TaskState } from "./../../src/states/TaskState";
import { CatchRule, RetryRule } from "./../../src/states/base";
import {TaskHandler} from "src";

const createMockHandler = (
  executeFunc: (
    resource: string,
    inputData: unknown,
    parameters?: Record<string, unknown>,
  ) => Promise<unknown> | unknown,
): TaskHandler => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return {
    execute: async (resource, inputData, parameters) => {
      const result = executeFunc(resource, inputData, parameters);
      return result instanceof Promise ? await result : result;
    },
    executeWithTimeout: async (
      resource,
      inputData,
      parameters,
      timeoutSeconds,
    ) => {
      if (timeoutSeconds && timeoutSeconds > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Task execution timed out after ${timeoutSeconds} seconds`,
              ),
            );
          }, timeoutSeconds * 1000);
        });

        try {
          return await Promise.race([
            executeFunc(resource, inputData, parameters),
            timeoutPromise,
          ]);
        } finally {
          // Crucial: Clear the timer to prevent open handle warnings and fake-timer crashes
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
        }
      }
      const result = executeFunc(resource, inputData, parameters);
      return result instanceof Promise ? await result : result;
    },
    canHandle: () => true,
  };
};

describe("TaskState", () => {
  it("should execute basic task state", async () => {
    const executeFunc = (_resource: string, inputData: unknown) => ({
      result: "success",
      input: inputData,
    });
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      nextState: "NextState",
      taskHandler: createMockHandler(executeFunc),
    });
    const [output, nextState] = await state.execute({ key: "value" });
    expect(output).toBeDefined();
    expect(nextState).toBe("NextState");
    expect((output as Record<string, unknown>).result).toBe("success");
  });

  it("should execute task state with parameters", async () => {
    const executeFunc = (
      _resource: string,
      _inputData: unknown,
      parameters?: Record<string, unknown>,
    ) => ({ params: parameters });
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      parameters: { param1: "value1", param2: 42 },
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute("initial");
    expect(output).toBeDefined();
  });

  it("should execute task state with input path", async () => {
    const executeFunc = (_resource: string, inputData: unknown) => inputData;
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      inputPath: "$.data",
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute({
      data: { value: "test" },
      other: "ignored",
    });
    expect((output as Record<string, unknown>).value).toBe("test");
  });

  it("should execute task state with result path", async () => {
    const executeFunc = () => "task-result";
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      resultPath: "$.taskResult",
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute({ original: "data" });
    expect((output as Record<string, unknown>).original).toBe("data");
    expect((output as Record<string, unknown>).taskResult).toBe("task-result");
  });

  it("should execute task state with output path", async () => {
    const executeFunc = () => ({ result: "success", extra: "data" });
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      outputPath: "$.result",
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute("initial");
    expect(output).toBe("success");
  });

  it("should execute task state with timeout", async () => {
    // Enable fake timers to prevent real open handles
    jest.useFakeTimers();

    const executeFunc = async () => {
      // Simulate a hanging task that never resolves
      await new Promise(() => {});
      return "success";
    };

    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      timeoutSeconds: 1,
      taskHandler: createMockHandler(executeFunc),
    });

    const executionPromise = state.execute("test");

    // Synchronously advance fake time past the 1-second timeout threshold
    jest.advanceTimersByTime(1100);

    // Allow microtasks to flush so the Promise.race rejection propagates
    await Promise.resolve();

    await expect(executionPromise).rejects.toThrow("timed out");

    // Restore real timers cleanly (no pending timers exist thanks to the finally block)
    jest.useRealTimers();
  });

  it("should execute task state with retry that eventually succeeds", async () => {
    let callCount = 0;
    const executeFunc = () => {
      callCount += 1;
      if (callCount === 1) throw new Error("TemporaryError");
      return "success";
    };
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      retry: [
        new RetryRule({
          errorEquals: ["TemporaryError"],
          intervalSeconds: 0,
          maxAttempts: 2,
          backoffRate: 1.0,
        }),
      ],
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute("test");
    expect(output).toBe("success");
    expect(callCount).toBe(2);
  });

  it("should execute task state with retry that exhausts attempts", async () => {
    let callCount = 0;
    const executeFunc = () => {
      callCount += 1;
      throw new Error("PersistentError");
    };
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      retry: [
        new RetryRule({
          errorEquals: ["PersistentError"],
          intervalSeconds: 0,
          maxAttempts: 2,
          backoffRate: 1.0,
        }),
      ],
      taskHandler: createMockHandler(executeFunc),
    });
    await expect(state.execute("test")).rejects.toThrow("PersistentError");
    expect(callCount).toBe(3);
  });

  it("should execute task state with catch policy", async () => {
    const executeFunc = () => {
      throw new Error("CustomError");
    };
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      catch: [
        new CatchRule({
          errorEquals: ["CustomError"],
          nextState: "ErrorHandler",
          resultPath: "$.error",
        }),
      ],
      taskHandler: createMockHandler(executeFunc),
      end: true,
    });
    const [output, nextState] = await state.execute({ original: "data" });
    expect(nextState).toBe("ErrorHandler");
    expect((output as Record<string, unknown>).original).toBe("data");
    expect((output as Record<string, unknown>).error).toBeDefined();
  });

  it("should execute task state with result selector", async () => {
    const executeFunc = () => ({ statusCode: 200, body: "success" });
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
      resultSelector: { message: "$.body", code: "$.statusCode" },
      taskHandler: createMockHandler(executeFunc),
    });
    const [output] = await state.execute("test");
    expect(output).toEqual({ message: "success", code: 200 });
  });

  it("should validate task state", () => {
    expect(
      () =>
        new TaskState({
          name: "TaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          end: true,
        }),
    ).not.toThrow();
    expect(
      () => new TaskState({ name: "TaskState", resource: "", end: true }),
    ).toThrow("Resource is required");
    expect(
      () =>
        new TaskState({
          name: "TaskState2",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          timeoutSeconds: 0,
          end: true,
        }),
    ).toThrow("TimeoutSeconds must be positive");
    expect(
      () =>
        new TaskState({
          name: "TaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          heartbeatSeconds: -1,
          end: true,
        }),
    ).toThrow("HeartbeatSeconds must be positive");
    expect(
      () =>
        new TaskState({
          name: "TaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          timeoutSeconds: 10,
          heartbeatSeconds: 10,
          end: true,
        }),
    ).toThrow("HeartbeatSeconds must be less than TimeoutSeconds");
    expect(
      () =>
        new TaskState({
          name: "TaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          retry: [new RetryRule({ errorEquals: [] })],
          end: true,
        }),
    ).toThrow("ErrorEquals cannot be empty");
    expect(
      () => new RetryRule({ errorEquals: ["Error"], backoffRate: 0.5 }),
    ).toThrow("BackoffRate must be >= 1.0");
    expect(
      () =>
        new TaskState({
          name: "TaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          catch: [new CatchRule({ errorEquals: ["Error"], nextState: "" })],
        }),
    ).toThrow("Next cannot be empty");
  });

  it("should validate task state getters (cannot have both Next and End)", () => {
    expect(
      () =>
        new TaskState({
          name: "MyTaskState",
          resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
          end: true,
          nextState: "NextState",
        }),
    ).toThrow("State cannot have both Next and End");
  });

  it("should match errors correctly", () => {
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      end: true,
    });
    const error1 = new Error("CustomError");
    // @ts-expect-error: Simulating custom errorType property
    error1.errorType = "CustomError";
    expect((state as any).errorMatches(error1, ["CustomError"])).toBe(true);
    expect(
      (state as any).errorMatches(new Error("AnyError"), ["States.ALL"]),
    ).toBe(true);
    expect(
      (state as any).errorMatches(new Error("UnhandledError"), ["CustomError"]),
    ).toBe(false);
  });

  it("should get all possible next states", () => {
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      nextState: "NextState",
      catch: [
        new CatchRule({ errorEquals: ["Error1"], nextState: "ErrorHandler1" }),
        new CatchRule({ errorEquals: ["Error2"], nextState: "ErrorHandler2" }),
      ],
    });
    const nextStates = state.getNextStates();
    expect(nextStates).toContain("NextState");
    expect(nextStates).toContain("ErrorHandler1");
    expect(nextStates).toContain("ErrorHandler2");
  });

  it("should serialize task state to dict", () => {
    const state = new TaskState({
      name: "TaskState",
      resource: "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
      nextState: "NextState",
      parameters: { param1: "value1" },
      timeoutSeconds: 30,
      retry: [new RetryRule({ errorEquals: ["Error"], maxAttempts: 3 })],
      catch: [
        new CatchRule({ errorEquals: ["Error"], nextState: "ErrorHandler" }),
      ],
    });
    const stateDict = state.toDict();
    expect(stateDict.Type).toBe("Task");
    expect(stateDict.Resource).toBe(
      "arn:aws:lambda:us-east-1:123456789012:function:MyFunction",
    );
    expect(stateDict.Next).toBe("NextState");
    expect(stateDict.Parameters).toEqual({ param1: "value1" });
    expect(stateDict.TimeoutSeconds).toBe(30);
    expect((stateDict.Retry as any[]).length).toBe(1);
    expect((stateDict.Catch as any[]).length).toBe(1);
  });
});
