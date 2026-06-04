/**
 * Tests for the FailState implementation.
 */

import { FailState, FailStateConfig } from "./../../src/states/FailState";
import { StateError } from "./../../src/states/base";

describe("FailState", () => {
  const sampleInputData = {
    data: "input data",
    metadata: { source: "test", timestamp: "2024-01-15" },
    count: 42,
  };

  // ==========================================
  // Test initialization and basic properties
  // ==========================================

  it("should create a basic FailState", () => {
    const state = new FailState({
      name: "TestFailState",
      error: "States.Timeout",
      cause: "Request timed out after 30 seconds",
      comment: "Test fail state",
    });

    expect(state.name).toBe("TestFailState");
    expect(state.type).toBe("Fail");
    expect(state.error).toBe("States.Timeout");
    expect(state.cause).toBe("Request timed out after 30 seconds");
    expect(state.comment).toBe("Test fail state");
    expect(state.nextState).toBeUndefined();
    expect(state.end).toBe(false);
    expect(state.inputPath).toBeUndefined();
    expect(state.outputPath).toBeUndefined();
    expect(state.resultPath).toBeUndefined();
  });

  it("should create a FailState with minimal fields", () => {
    const state = new FailState({
      name: "MinimalFail",
      error: "States.TaskFailed",
    });

    expect(state.name).toBe("MinimalFail");
    expect(state.type).toBe("Fail");
    expect(state.error).toBe("States.TaskFailed");
    expect(state.cause).toBeUndefined();
    expect(state.comment).toBeUndefined();
  });

  it("should create a FailState with cause", () => {
    const state = new FailState({
      name: "CauseFail",
      error: "CustomError",
      cause: "Something went wrong in the process",
    });

    expect(state.error).toBe("CustomError");
    expect(state.cause).toBe("Something went wrong in the process");
  });

  it("should enforce terminal state properties", () => {
    const state = new FailState({
      name: "DefaultFail",
      error: "States.Failed",
    });

    // These should all be undefined/false for terminal state
    expect(state.nextState).toBeUndefined();
    expect(state.end).toBe(false);
    expect(state.inputPath).toBeUndefined();
    expect(state.outputPath).toBeUndefined();
    expect(state.resultPath).toBeUndefined();
  });

  // ==========================================
  // Test validation
  // ==========================================

  it.each([
    { name: "ValidFail", error: "States.Failed" },
    { name: "ValidFail", error: "States.Timeout", cause: "Timed out" },
    { name: "ValidFail", error: "CustomError", comment: "Test comment" },
    {
      name: "ValidFail",
      error: "States.TaskFailed",
      cause: "Task error",
      comment: "Complete",
    },
  ])("should validate valid FailState configurations: %p", (config) => {
    expect(() => new FailState(config as FailStateConfig)).not.toThrow();
  });

  it("should throw validation error with empty name", () => {
    expect(() => new FailState({ name: "", error: "TestError" })).toThrow(
      "State name cannot be empty",
    );
  });

  it("should throw validation error with wrong type", () => {
    const state = new FailState({ name: "WrongType", error: "TestError" });
    (state as any).type = "Pass"; // Bypass TS checks to simulate mutation

    expect(() => state.validate()).toThrow("must have Type 'Fail'");
  });

  it("should throw validation error without Error field", () => {
    expect(() => new FailState({ name: "InvalidFail", error: "" })).toThrow(
      "must have Error field",
    );
  });

  it("should throw validation error with Next field", () => {
    expect(
      () =>
        new FailState({
          name: "InvalidFail",
          error: "TestError",
          nextState: "NextState",
        }),
    ).toThrow("cannot have Next field");
  });

  it("should throw validation error with End field", () => {
    expect(
      () =>
        new FailState({ name: "InvalidFail", error: "TestError", end: true }),
    ).toThrow("cannot have End field");
  });

  it("should throw validation error with InputPath", () => {
    expect(
      () =>
        new FailState({
          name: "InvalidFail",
          error: "TestError",
          inputPath: "$.data",
        }),
    ).toThrow("cannot have InputPath");
  });

  it("should throw validation error with OutputPath", () => {
    expect(
      () =>
        new FailState({
          name: "InvalidFail",
          error: "TestError",
          outputPath: "$.output",
        }),
    ).toThrow("cannot have OutputPath");
  });

  it("should throw validation error with ResultPath", () => {
    expect(
      () =>
        new FailState({
          name: "InvalidFail",
          error: "TestError",
          resultPath: "$.result",
        }),
    ).toThrow("cannot have ResultPath");
  });

  // ==========================================
  // Test execute method
  // ==========================================

  it("should execute simple FailState and throw StateError", async () => {
    const state = new FailState({
      name: "SimpleFail",
      error: "States.TaskFailed",
      cause: "Task execution failed",
    });

    await expect(state.execute(sampleInputData)).rejects.toThrow(StateError);
  });

  it("should throw StateError without cause", async () => {
    const state = new FailState({ name: "NoCauseFail", error: "CustomError" });

    await expect(state.execute(sampleInputData)).rejects.toThrow(StateError);
  });

  it("should throw StateError with context", async () => {
    const state = new FailState({
      name: "ContextFail",
      error: "States.Timeout",
      cause: "Operation timed out",
    });

    const context = { execution_id: "test-123", timestamp: "2024-01-15" };

    await expect(state.execute(sampleInputData, context)).rejects.toThrow(
      StateError,
    );
  });

  it("should throw StateError with null input", async () => {
    const state = new FailState({ name: "NilFail", error: "States.Failed" });

    await expect(state.execute(null)).rejects.toThrow(StateError);
  });

  it("should ignore input data regardless of type", async () => {
    const testInputs = [
      sampleInputData,
      { different: "data" },
      null,
      "string",
      42,
      [],
    ];

    const state = new FailState({
      name: "IgnoreInputFail",
      error: "States.Failed",
      cause: "Failed regardless of input",
    });

    for (const input of testInputs) {
      await expect(state.execute(input)).rejects.toThrow(StateError);
    }
  });

  it("should throw StateError with different error types", async () => {
    const errorTypes = [
      "States.Timeout",
      "States.TaskFailed",
      "States.Permissions",
      "CustomError",
      "ServiceException",
      "ValidationError",
    ];

    for (const errorType of errorTypes) {
      const state = new FailState({
        name: `Fail_${errorType}`,
        error: errorType,
        cause: `Failed with ${errorType}`,
      });

      await expect(state.execute({})).rejects.toThrow(
        new RegExp(`Failed with ${errorType.replace(".", "\\.")}`),
      );
    }
  });

  it("should include correct error details in thrown StateError", async () => {
    const state = new FailState({
      name: "DetailedFail",
      error: "CustomError.SubType",
      cause: "Detailed error message with context",
    });

    try {
      await state.execute({ test: "data" });
      fail("Expected StateError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(StateError);
      const error = e as StateError;
      expect(error.stateName).toBe("DetailedFail");
      expect(error.errorType).toBe("CustomError.SubType");
      expect(error.message).toBe("Detailed error message with context");
    }
  });

  it("should use default cause message when cause is not provided", async () => {
    const state = new FailState({ name: "NoCause", error: "States.Failed" });

    try {
      await state.execute({});
      fail("Expected StateError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(StateError);
      const error = e as StateError;
      expect(error.message).toBe("State 'NoCause' failed");
    }
  });

  // ==========================================
  // Test toDict method
  // ==========================================

  it("should convert minimal FailState to dict", () => {
    const state = new FailState({
      name: "MinimalFail",
      error: "States.Failed",
    });
    const result = state.toDict();

    expect(result).toEqual({ Type: "Fail", Error: "States.Failed" });
    expect(result.Cause).toBeUndefined();
    expect(result.Comment).toBeUndefined();
    expect(result.Next).toBeUndefined();
    expect(result.End).toBeUndefined();
    expect(result.InputPath).toBeUndefined();
    expect(result.OutputPath).toBeUndefined();
    expect(result.ResultPath).toBeUndefined();
  });

  it("should convert FailState with cause to dict", () => {
    const state = new FailState({
      name: "CauseFail",
      error: "States.Timeout",
      cause: "Request timed out",
    });

    expect(state.toDict()).toEqual({
      Type: "Fail",
      Error: "States.Timeout",
      Cause: "Request timed out",
    });
  });

  it("should convert FailState with comment to dict", () => {
    const state = new FailState({
      name: "CommentFail",
      error: "CustomError",
      comment: "This is a test failure",
    });

    expect(state.toDict()).toEqual({
      Type: "Fail",
      Error: "CustomError",
      Comment: "This is a test failure",
    });
  });

  it("should convert complete FailState to dict", () => {
    const state = new FailState({
      name: "CompleteFail",
      error: "States.TaskFailed",
      cause: "Task execution failed",
      comment: "Complete fail state",
    });

    expect(state.toDict()).toEqual({
      Type: "Fail",
      Error: "States.TaskFailed",
      Cause: "Task execution failed",
      Comment: "Complete fail state",
    });
  });

  it("should NOT include disallowed fields in dict", () => {
    const state = new FailState({ name: "StrictFail", error: "States.Failed" });
    const dict = state.toDict();

    expect(dict.Next).toBeUndefined();
    expect(dict.End).toBeUndefined();
    expect(dict.InputPath).toBeUndefined();
    expect(dict.OutputPath).toBeUndefined();
    expect(dict.ResultPath).toBeUndefined();
    expect(dict.Result).toBeUndefined();
    expect(dict.Parameters).toBeUndefined();
  });

  // ==========================================
  // Test toJson method
  // ==========================================

  it("should convert FailState to JSON string", () => {
    const state = new FailState({
      name: "JsonFail",
      error: "States.Failed",
      cause: "JSON test",
    });

    const jsonStr = state.toJson();
    const result = JSON.parse(jsonStr);

    expect(result).toEqual({
      Type: "Fail",
      Error: "States.Failed",
      Cause: "JSON test",
    });
  });

  it("should convert FailState to indented JSON string", () => {
    const state = new FailState({
      name: "IndentedFail",
      error: "TestError",
      comment: "Indented",
    });

    const jsonStr = state.toJson(2);
    expect(jsonStr).toContain("\n  ");
  });

  // ==========================================
  // Test getNextStates method
  // ==========================================

  it("should return empty array for getNextStates (always terminal)", () => {
    const state = new FailState({ name: "NoNextFail", error: "States.Failed" });
    expect(state.getNextStates()).toEqual([]);
  });

  // ==========================================
  // Test string representations
  // ==========================================

  it("should have correct string representation", () => {
    const state = new FailState({ name: "TestFail", error: "States.Failed" });

    const strRepr = state.toString();
    expect(strRepr).toContain("FailState");
    expect(strRepr).toContain("TestFail");
    expect(strRepr).toContain("States.Failed");
  });

  // ==========================================
  // Test edge cases
  // ==========================================

  it("should throw StateError with empty input", async () => {
    const state = new FailState({ name: "EmptyFail", error: "States.Failed" });

    try {
      await state.execute({});
      fail("Expected StateError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(StateError);
      const error = e as StateError;
      expect(error.toString()).toContain("EmptyFail");
      expect(error.toString()).toContain("States.Failed");
    }
  });

  it("should throw StateError with different input types", async () => {
    const testCases = [
      { input: "string input", desc: "string" },
      { input: 42, desc: "integer" },
      { input: 3.14, desc: "float" },
      { input: true, desc: "boolean" },
      { input: [1, 2, 3], desc: "list" },
      { input: { key: "value" }, desc: "dict" },
      { input: null, desc: "null" },
    ];

    const state = new FailState({
      name: "TypeTestFail",
      error: "States.Failed",
    });

    for (const { input } of testCases) {
      await expect(state.execute(input)).rejects.toThrow(StateError);
    }
  });

  it("should preserve error consistency across multiple executions", async () => {
    const state = new FailState({
      name: "ConsistentFail",
      error: "CustomError",
      cause: "Consistent error message",
    });

    for (let index = 0; index < 2; index++) {
      try {
        await state.execute({ test: index + 1 });
        fail("Expected StateError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(StateError);
        const error = e as StateError;
        expect(error.errorType).toBe(state.error);
        expect(error.stateName).toBe(state.name);
        expect(error.message).toBe(state.cause);
      }
    }
  });

  // ==========================================
  // Test inheritance
  // ==========================================

  it("should properly inherit from BaseState", () => {
    const state = new FailState({
      name: "InheritanceTest",
      error: "TestError",
    });

    expect(typeof state.execute).toBe("function");
    expect(typeof state.validate).toBe("function");
    expect(typeof state.toDict).toBe("function");
    expect(typeof state.toJson).toBe("function");
    expect(typeof state.getNextStates).toBe("function");

    expect(state.stateName).toBe("InheritanceTest");
    expect(state.stateType).toBe("Fail");
    expect(state.getNext()).toBeUndefined();
    expect(state.isEnd()).toBe(false);
  });

  // ==========================================
  // Test concurrency
  // ==========================================

  it("should handle concurrent execution", async () => {
    const state = new FailState({
      name: "ConcurrentFail",
      error: "States.Failed",
      cause: "Concurrent test failure",
    });

    const numTasks = 10;
    const tasks = [];

    for (let i = 0; i < numTasks; i++) {
      const inputData = { id: i, data: `task_${i}` };
      tasks.push(state.execute(inputData).catch((e) => e));
    }

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(numTasks);
    for (const error of results) {
      expect(error).toBeInstanceOf(StateError);
      expect((error as StateError).errorType).toBe("States.Failed");
    }
  });

  // ==========================================
  // Test AWS standard error codes
  // ==========================================

  it("should handle AWS standard error codes", async () => {
    const awsErrors = [
      { code: "States.ALL", cause: "Wildcard error" },
      { code: "States.Timeout", cause: "Execution timeout" },
      { code: "States.TaskFailed", cause: "Task execution failed" },
      { code: "States.Permissions", cause: "Permission denied" },
      {
        code: "States.ResultPathMatchFailure",
        cause: "Result path match failed",
      },
      { code: "States.ParameterPathFailure", cause: "Parameter path failed" },
      { code: "States.BranchFailed", cause: "Parallel branch failed" },
      { code: "States.NoChoiceMatched", cause: "No choice matched" },
    ];

    for (const { code, cause } of awsErrors) {
      const state = new FailState({
        name: `Fail_${code}`,
        error: code,
        cause,
      });

      try {
        await state.execute({});
        fail(`Expected StateError for ${code}`);
      } catch (e) {
        expect(e).toBeInstanceOf(StateError);
        expect((e as StateError).errorType).toBe(code);
      }
    }
  });

  it("should be executable multiple times", async () => {
    const state = new FailState({
      name: "MultiExecFail",
      error: "States.Failed",
      cause: "Multiple execution test",
    });

    for (let i = 0; i < 5; i++) {
      await expect(state.execute({ iteration: i })).rejects.toThrow(StateError);
    }
  });

  // ==========================================
  // Test ASL compliance
  // ==========================================

  it("should produce valid ASL JSON (only Type, Error, and optional Cause/Comment)", () => {
    const state = new FailState({
      name: "ASLCompliant",
      error: "States.TaskFailed",
      cause: "Test cause",
      comment: "Test",
    });

    const dict = state.toDict();

    expect(dict.Type).toBe("Fail");
    expect(dict.Error).toBe("States.TaskFailed");
    expect(dict.Cause).toBe("Test cause");
    expect(dict.Comment).toBe("Test");

    expect(Object.keys(dict).sort()).toEqual(
      ["Type", "Error", "Cause", "Comment"].sort(),
    );
  });
});
