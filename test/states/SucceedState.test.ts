/**
 * Tests for the SucceedState implementation.
 */

import {
  SucceedState,
  SucceedStateConfig,
} from "./../../src/states/SucceedState";
import { StateError, PathProcessor } from "./../../src/states/base";

describe("SucceedState", () => {
  const sampleInputData = {
    data: "input data",
    metadata: { source: "test", timestamp: "2024-01-15" },
    count: 42,
  };

  beforeEach(() => {
    // Ensure we always start with the real JSONPathProcessor
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Test initialization and basic properties
  // ==========================================

  it("should create a basic SucceedState", () => {
    const state = new SucceedState({
      name: "TestSucceedState",
      inputPath: "$.data",
      outputPath: "$.result",
      comment: "Test comment",
    });

    expect(state.name).toBe("TestSucceedState");
    expect(state.type).toBe("Succeed");
    expect(state.inputPath).toBe("$.data");
    expect(state.outputPath).toBe("$.result");
    expect(state.comment).toBe("Test comment");
    expect(state.nextState).toBeUndefined();
    expect(state.end).toBe(false);
    expect(state.resultPath).toBeUndefined();
  });

  it("should create a SucceedState with default values", () => {
    const state = new SucceedState({ name: "SimpleSucceed" });

    expect(state.name).toBe("SimpleSucceed");
    expect(state.type).toBe("Succeed");
    expect(state.nextState).toBeUndefined();
    expect(state.end).toBe(false);
    expect(state.inputPath).toBeUndefined();
    expect(state.outputPath).toBeUndefined();
    expect(state.resultPath).toBeUndefined();
    expect(state.comment).toBeUndefined();
  });

  // ==========================================
  // Test validation
  // ==========================================

  it.each([
    { name: "ValidSucceed" },
    { name: "ValidSucceed", inputPath: "$.data" },
    { name: "ValidSucceed", outputPath: "$.result" },
    { name: "ValidSucceed", inputPath: "$.data", outputPath: "$.result" },
    { name: "ValidSucceed", comment: "Test" },
  ])("should validate valid SucceedState configurations: %p", (config) => {
    expect(() => new SucceedState(config as SucceedStateConfig)).not.toThrow();
  });

  it("should throw validation error with empty name", () => {
    expect(() => new SucceedState({ name: "" })).toThrow(
      "State name cannot be empty",
    );
  });

  it("should throw validation error with wrong type", () => {
    const state = new SucceedState({ name: "WrongType" });
    (state as any).type = "Pass"; // Bypass TS checks to simulate mutation

    expect(() => state.validate()).toThrow("must have Type 'Succeed'");
  });

  it("should throw validation error with Next field", () => {
    expect(
      () =>
        new SucceedState({ name: "InvalidSucceed", nextState: "NextState" }),
    ).toThrow("cannot have Next field");
  });

  it("should throw validation error with End field", () => {
    expect(
      () => new SucceedState({ name: "InvalidSucceed", end: true }),
    ).toThrow("cannot have End field");
  });

  it("should throw validation error with ResultPath", () => {
    expect(
      () =>
        new SucceedState({ name: "InvalidSucceed", resultPath: "$.result" }),
    ).toThrow("cannot have ResultPath");
  });

  // ==========================================
  // Test execute method (Real JSONPathProcessor Integration)
  // ==========================================

  it("should execute simple SucceedState (pass-through)", async () => {
    const state = new SucceedState({ name: "SimpleSucceed" });
    const [output, nextState] = await state.execute(sampleInputData);

    expect(output).toEqual(sampleInputData);
    expect(nextState).toBeUndefined(); // Succeed always returns undefined
  });

  it("should execute SucceedState with input path", async () => {
    const state = new SucceedState({
      name: "InputPathSucceed",
      inputPath: "$.data",
    });

    const [output, nextState] = await state.execute(sampleInputData);

    expect(output).toBe("input data");
    expect(nextState).toBeUndefined();
  });

  it("should execute SucceedState with output path", async () => {
    const state = new SucceedState({
      name: "OutputPathSucceed",
      outputPath: "$.metadata.source",
    });

    const [output, nextState] = await state.execute(sampleInputData);

    expect(output).toBe("test");
    expect(nextState).toBeUndefined();
  });

  it("should execute SucceedState with both input and output paths", async () => {
    const state = new SucceedState({
      name: "BothPathsSucceed",
      inputPath: "$.metadata",
      outputPath: "$.source",
    });

    const [output, nextState] = await state.execute(sampleInputData);

    expect(output).toBe("test");
    expect(nextState).toBeUndefined();
  });

  it("should execute SucceedState with context", async () => {
    const state = new SucceedState({ name: "ContextSucceed" });
    const context = { execution_id: "test-123", timestamp: "2024-01-15" };

    const [output, nextState] = await state.execute(sampleInputData, context);

    expect(output).toEqual(sampleInputData);
    expect(nextState).toBeUndefined();
  });

  it("should throw StateError when path processing fails", async () => {
    const badProcessor: PathProcessor = {
      applyInputPath: () => {
        throw new Error("Invalid path");
      },
      applyResultPath: () => {
        throw new Error("Invalid path");
      },
      applyOutputPath: () => {
        throw new Error("Invalid path");
      },
    };

    const state = new SucceedState({ name: "ErrorSucceed" });
    state.setPathProcessor(badProcessor);

    await expect(state.execute(sampleInputData)).rejects.toThrow(StateError);
    await expect(state.execute(sampleInputData)).rejects.toThrow(
      "Failed to execute succeed state 'ErrorSucceed'",
    );
  });

  it("should execute SucceedState with null input", async () => {
    const state = new SucceedState({ name: "NilSucceed" });
    const [output, nextState] = await state.execute(null);

    expect(output).toBeNull();
    expect(nextState).toBeUndefined();
  });

  it("should use default path processor when none is set", async () => {
    const state = new SucceedState({ name: "DefaultSucceed" });
    const [output, nextState] = await state.execute(sampleInputData);

    expect(output).toEqual(sampleInputData);
    expect(nextState).toBeUndefined();
  });

  // ==========================================
  // Test toDict method
  // ==========================================

  it("should convert simple SucceedState to dict", () => {
    const state = new SucceedState({ name: "SimpleSucceed" });
    expect(state.toDict()).toEqual({ Type: "Succeed" });
  });

  it("should convert state with input path to dict", () => {
    const state = new SucceedState({
      name: "InputSucceed",
      inputPath: "$.input",
    });
    expect(state.toDict()).toEqual({ Type: "Succeed", InputPath: "$.input" });
  });

  it("should convert state with output path to dict", () => {
    const state = new SucceedState({
      name: "OutputSucceed",
      outputPath: "$.output",
    });
    expect(state.toDict()).toEqual({ Type: "Succeed", OutputPath: "$.output" });
  });

  it("should convert complete state to dict", () => {
    const state = new SucceedState({
      name: "CompleteSucceed",
      inputPath: "$.input",
      outputPath: "$.output",
      comment: "Complete succeed state",
    });

    expect(state.toDict()).toEqual({
      Type: "Succeed",
      InputPath: "$.input",
      OutputPath: "$.output",
      Comment: "Complete succeed state",
    });
  });

  it("should NOT include Next, End, or ResultPath in dict", () => {
    const state = new SucceedState({
      name: "StrictSucceed",
      inputPath: "$.input",
      outputPath: "$.output",
    });

    const dict = state.toDict();

    expect(dict.Next).toBeUndefined();
    expect(dict.End).toBeUndefined();
    expect(dict.ResultPath).toBeUndefined();
    expect(dict.Result).toBeUndefined();
    expect(dict.Parameters).toBeUndefined();
  });

  // ==========================================
  // Test toJson method
  // ==========================================

  it("should convert state to JSON string", () => {
    const state = new SucceedState({
      name: "JsonSucceed",
      inputPath: "$.input",
    });

    const jsonStr = state.toJson();
    const result = JSON.parse(jsonStr);

    expect(result).toEqual({ Type: "Succeed", InputPath: "$.input" });
  });

  it("should convert state to indented JSON string", () => {
    const state = new SucceedState({
      name: "IndentedSucceed",
      inputPath: "$.input",
    });
    const jsonStr = state.toJson(2);
    expect(jsonStr).toContain("\n  ");
  });

  // ==========================================
  // Test getNextStates method
  // ==========================================

  it("should return empty array for getNextStates (always terminal)", () => {
    const state = new SucceedState({ name: "TerminalSucceed" });
    expect(state.getNextStates()).toEqual([]);
  });

  it("should return empty array even with paths configured", () => {
    const state = new SucceedState({
      name: "TerminalSucceedWithPaths",
      inputPath: "$.input",
      outputPath: "$.output",
    });
    expect(state.getNextStates()).toEqual([]);
  });

  // ==========================================
  // Test string representations
  // ==========================================

  it("should have correct string representation", () => {
    const state = new SucceedState({ name: "TestSucceed" });
    expect(state.toString()).toBe("SucceedState(name=TestSucceed)");
  });

  // ==========================================
  // Test edge cases
  // ==========================================

  it("should execute with empty input", async () => {
    const state = new SucceedState({ name: "EmptySucceed" });
    const emptyInput = {};
    const [output, nextState] = await state.execute(emptyInput);

    expect(output).toEqual({});
    expect(nextState).toBeUndefined();
  });

  it("should execute with different input types", async () => {
    const state = new SucceedState({ name: "TypeTestSucceed" });

    const testCases = [
      { input: "string input", desc: "string" },
      { input: 42, desc: "integer" },
      { input: 3.14, desc: "float" },
      { input: true, desc: "boolean" },
      { input: [1, 2, 3], desc: "list" },
      { input: { key: "value" }, desc: "dict" },
      { input: null, desc: "null" },
      { input: undefined, desc: "undefined" },
    ];

    for (const { input } of testCases) {
      const [output, nextState] = await state.execute(input);
      expect(output).toBe(input); // Pass-through without paths
      expect(nextState).toBeUndefined();
    }
  });

  // ==========================================
  // Test inheritance
  // ==========================================

  it("should properly inherit from BaseState", () => {
    const state = new SucceedState({ name: "InheritanceTest" });

    expect(typeof state.execute).toBe("function");
    expect(typeof state.validate).toBe("function");
    expect(typeof state.toDict).toBe("function");
    expect(typeof state.toJson).toBe("function");
    expect(typeof state.getNextStates).toBe("function");
    expect(typeof state.setPathProcessor).toBe("function");

    expect(state.stateName).toBe("InheritanceTest");
    expect(state.stateTypeAsString).toBe("Succeed");
    expect(state.getNext()).toBeUndefined();
    expect(state.isEnd()).toBe(false);
  });

  it("should behave as terminal state (no next, not end flag)", () => {
    const state = new SucceedState({ name: "TerminalBehavior" });

    // Succeed states are implicitly terminal
    expect(state.getNext()).toBeUndefined();
    expect(state.isEnd()).toBe(false); // end field is not set, but it's implicitly terminal
    expect(state.getNextStates()).toEqual([]); // No next states
  });

  // ==========================================
  // Test concurrency
  // ==========================================

  it("should handle concurrent execution", async () => {
    const state = new SucceedState({ name: "ConcurrentSucceed" });

    const numTasks = 10;
    const tasks = [];

    for (let i = 0; i < numTasks; i++) {
      const inputData = { id: i, data: `task_${i}` };
      tasks.push(state.execute(inputData));
    }

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(numTasks);
    // @ts-ignore
    results.forEach(([output, nextState], i) => {
      expect((output as any).id).toBe(i);
      expect((output as any).data).toBe(`task_${i}`);
      expect(nextState).toBeUndefined(); // All should be terminal
    });
  });

  // ==========================================
  // Test ASL compliance
  // ==========================================

  it("should produce valid ASL JSON (only Type and optional paths)", () => {
    const state = new SucceedState({
      name: "ASLCompliant",
      inputPath: "$.input",
      outputPath: "$.output",
      comment: "Test",
    });

    const dict = state.toDict();

    // Verify ASL spec compliance
    expect(dict.Type).toBe("Succeed");
    expect(dict.InputPath).toBe("$.input");
    expect(dict.OutputPath).toBe("$.output");
    expect(dict.Comment).toBe("Test");

    // Verify no disallowed fields
    expect(Object.keys(dict).sort()).toEqual(
      ["Type", "InputPath", "OutputPath", "Comment"].sort(),
    );
  });
});
