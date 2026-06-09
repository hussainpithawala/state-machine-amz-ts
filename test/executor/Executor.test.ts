/**
 * Tests for Executor implementation.
 */
import {
  BaseExecutor,
  ExecutionContextAdapter,
  StateRegistry,
  StateMachineInterface,
} from "../../src/executor/Executor";
import ExecutionImpl from "../../src/execution/ExecutionImpl";

describe("StateRegistry", () => {
  it("should register and retrieve task handlers", () => {
    const registry = new StateRegistry();
    let called = false;

    const handler = (inputData: unknown) => {
      called = true;
      return inputData;
    };

    registry.registerTaskHandler("resource://x", handler);

    const got = registry.getTaskHandler("resource://x");
    expect(got).toBeDefined();

    const result = got!("in");
    expect(result).toBe("in");
    expect(called).toBe(true);

    const missing = registry.getTaskHandler("resource://missing");
    expect(missing).toBeUndefined();
  });

  it("should handle multiple handlers and overwrites", () => {
    const registry = new StateRegistry();

    registry.registerTaskHandler("resource://1", () => "handler1");
    registry.registerTaskHandler("resource://2", () => "handler2");

    expect(registry.getTaskHandler("resource://1")!(null)).toBe("handler1");
    expect(registry.getTaskHandler("resource://2")!(null)).toBe("handler2");

    // Test overwrite
    registry.registerTaskHandler("resource://1", () => "overwritten");
    expect(registry.getTaskHandler("resource://1")!(null)).toBe("overwritten");
  });
});

describe("BaseExecutor", () => {
  it("should initialize maps and registry", () => {
    const executor = new BaseExecutor();
    expect(executor).toBeDefined();
    expect(executor.listExecutions()).toEqual([]);
    expect(executor.registry).toBeDefined();
  });

  it("should throw when getting status for non-existent execution", () => {
    const executor = new BaseExecutor();
    expect(() => executor.getStatus("does-not-exist")).toThrow("not found");
  });

  it("should get status for existing execution", () => {
    const executor = new BaseExecutor();
    const execCtx = ExecutionImpl.create("exec-1", "n1", null);
    // Manually inject for testing internal map
    (executor as any).executions.set(execCtx.id, execCtx);

    const got = executor.getStatus("exec-1");
    expect(got).toBe(execCtx);
  });

  it("should throw when stopping with null execution", async () => {
    const executor = new BaseExecutor();
    await expect(
      executor.stop(null as unknown as ExecutionImpl),
    ).rejects.toThrow("cannot be null or undefined");
  });

  it("should set execution to ABORTED when stopped", async () => {
    const executor = new BaseExecutor();
    const execCtx = ExecutionImpl.create("exec-1", "test", null);
    (executor as any).executions.set(execCtx.id, execCtx);

    const before = new Date();
    await executor.stop(execCtx);
    const after = new Date();

    expect(execCtx.status).toBe("ABORTED");
    expect(execCtx.endTime).toBeDefined();
    expect(execCtx.endTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(execCtx.endTime!.getTime()).toBeLessThanOrEqual(after.getTime());

    // Should be removed from active executions
    expect(
      executor.listExecutions().find((e) => e.id === "exec-1"),
    ).toBeUndefined();
  });

  it("should list executions", () => {
    const executor = new BaseExecutor();
    const exec1 = ExecutionImpl.create("exec-1", "e1", null);
    const exec2 = ExecutionImpl.create("exec-2", "e2", null);

    (executor as any).executions.set(exec1.id, exec1);
    (executor as any).executions.set(exec2.id, exec2);

    const executions = executor.listExecutions();
    expect(executions).toHaveLength(2);

    const ids = executions.map((e) => e.id);
    expect(ids).toContain("exec-1");
    expect(ids).toContain("exec-2");
  });

  it("should register a function as a task handler", () => {
    const executor = new BaseExecutor();
    executor.registerGoFunction("MyFn", () => "ok");

    const arn = "arn:aws:states:::lambda:function:MyFn";
    const got = executor.registry.getTaskHandler(arn);
    expect(got).toBeDefined();
    expect(got!(null)).toBe("ok");
  });

  it("should execute a Go/Python task (placeholder)", async () => {
    const executor = new BaseExecutor();
    const result = await executor.executeGoTask(null, { k: "v" });
    expect(result).toEqual({ k: "v" });
  });

  it("should remove completed executions after execute", async () => {
    const executor = new BaseExecutor();

    // Mock StateMachineInterface
    const mockSm: StateMachineInterface = {
      getStartAt: () => "FirstState",
      getState: () => ({}),
      isTimeout: () => false,
      runExecution: async (execCtx: ExecutionImpl) => {
        execCtx.status = "SUCCEEDED";
        execCtx.endTime = new Date();
        return execCtx;
      },
    };

    const execCtx = ExecutionImpl.newContext("test", "FirstState", null);
    const result = await executor.execute(mockSm, execCtx);

    expect(result.isComplete()).toBe(true);
    expect(
      executor.listExecutions().find((e) => e.id === execCtx.id),
    ).toBeUndefined();
  });
});

describe("ExecutionContextAdapter", () => {
  it("should get task handler from executor", () => {
    const executor = new BaseExecutor();
    executor.registry.registerTaskHandler("resource://test", () => "result");

    const adapter = new ExecutionContextAdapter(executor);
    const got = adapter.getTaskHandler("resource://test");

    expect(got).toBeDefined();
    expect(got!(null)).toBe("result");
  });

  it("should return undefined for missing handler", () => {
    const executor = new BaseExecutor();
    const adapter = new ExecutionContextAdapter(executor);
    expect(adapter.getTaskHandler("resource://missing")).toBeUndefined();
  });
});
