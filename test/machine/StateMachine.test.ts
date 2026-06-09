/**
 * Tests for StateMachine implementation.
 */
import { StateMachine } from "../../src/machine/StateMachine";

describe("StateMachine", () => {
  it("should create from valid JSON definition", () => {
    const definition = `{
      "Comment": "A simple state machine",
      "StartAt": "FirstState",
      "States": {
        "FirstState": {
          "Type": "Pass",
          "Result": "Hello World",
          "End": true
        }
      }
    }`;

    const sm = StateMachine.fromJson(definition);
    expect(sm).toBeDefined();
    expect(sm.comment).toBe("A simple state machine");
    expect(sm.startAt).toBe("FirstState");
    expect(Object.keys(sm.states)).toHaveLength(1);
  });

  it("should throw on invalid JSON", () => {
    expect(() => StateMachine.fromJson("{invalid json}")).toThrow(
      "Failed to parse JSON",
    );
  });

  it("should throw on missing StartAt", () => {
    const definition = `{
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    expect(() => StateMachine.fromJson(definition)).toThrow(
      "StartAt is required",
    );
  });

  it("should throw on missing States", () => {
    const definition = `{ "StartAt": "FirstState" }`;
    expect(() => StateMachine.fromJson(definition)).toThrow(
      "States is required",
    );
  });

  it("should set default version to 1.0", () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    expect(sm.version).toBe("1.0");
  });

  it("should get start state name", () => {
    const definition = `{
      "StartAt": "MyStartState",
      "States": { "MyStartState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    expect(sm.getStartAt()).toBe("MyStartState");
  });

  it("should get existing state", () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": {
        "FirstState": { "Type": "Pass", "End": true },
        "SecondState": { "Type": "Pass", "End": true }
      }
    }`;
    const sm = StateMachine.fromJson(definition);
    const state = sm.getState("FirstState");
    expect(state).toBeDefined();
    expect(state.stateName).toBe("FirstState");
  });

  it("should throw when getting non-existent state", () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    expect(() => sm.getState("NonExistentState")).toThrow("not found");
  });

  it("should execute simple pass-through state machine", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute({ key: "value" });

    expect(execCtx.status).toBe("SUCCEEDED");
    expect(execCtx.currentStateName).toBe("FirstState");
    expect(execCtx.output).toBeDefined();
  });

  it("should execute state machine with result", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "Result": "Hello World", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("ignored");

    expect(execCtx.status).toBe("SUCCEEDED");
    expect(execCtx.output).toBe("Hello World");
  });

  it("should execute state machine with multiple states", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": {
        "FirstState": { "Type": "Pass", "Result": "step1", "Next": "SecondState" },
        "SecondState": { "Type": "Pass", "Result": "step2", "End": true }
      }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("initial");

    expect(execCtx.status).toBe("SUCCEEDED");
    expect(execCtx.output).toBe("step2");
    expect(execCtx.history).toHaveLength(2);
  });

  it("should execute state machine that fails", async () => {
    const definition = `{
      "StartAt": "FailState",
      "States": { "FailState": { "Type": "Fail", "Error": "CustomError", "Cause": "Test failure" } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("test");

    expect(execCtx.status).toBe("FAILED");
    expect(execCtx.error).toBeDefined();
  });

  it("should execute with custom execution name", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("test", undefined, "custom-execution");

    expect(execCtx.name).toBe("custom-execution");
  });

  it("should get execution summary", () => {
    const definition = `{
      "Comment": "Test state machine",
      "Version": "1.0",
      "TimeoutSeconds": 300,
      "StartAt": "FirstState",
      "States": {
        "FirstState": { "Type": "Pass", "Next": "SecondState" },
        "SecondState": { "Type": "Pass", "End": true }
      }
    }`;
    const sm = StateMachine.fromJson(definition);
    const summary = sm.getExecutionSummary() as Record<string, any>;

    expect(summary.startAt).toBe("FirstState");
    expect(summary.statesCount).toBe(2);
    expect(summary.version).toBe("1.0");
    expect(summary.stateTypes.Pass).toBe(2);
  });

  it("should check timeout correctly", () => {
    const definition = `{
      "TimeoutSeconds": 1,
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);

    expect(sm.isTimeout(new Date())).toBe(false);

    const pastTime = new Date(Date.now() - 2000);
    expect(sm.isTimeout(pastTime)).toBe(true);
  });

  it("should never timeout if TimeoutSeconds is not set", () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const pastTime = new Date(Date.now() - 10000);
    expect(sm.isTimeout(pastTime)).toBe(false);
  });

  it("should convert to JSON", () => {
    const definition = `{
      "Comment": "Test machine",
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const jsonStr = sm.toJson();
    const result = JSON.parse(jsonStr);

    expect(result.Comment).toBe("Test machine");
    expect(result.StartAt).toBe("FirstState");
    expect(result.States).toBeDefined();
  });

  it("should record state history", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": {
        "FirstState": { "Type": "Pass", "Result": "step1", "Next": "SecondState" },
        "SecondState": { "Type": "Pass", "Result": "step2", "Next": "ThirdState" },
        "ThirdState": { "Type": "Pass", "Result": "step3", "End": true }
      }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("initial");

    expect(execCtx.history).toHaveLength(3);
    // @ts-ignore
    expect(execCtx.history[0].stateName).toBe("FirstState");
    // @ts-ignore
    expect(execCtx.history[1].stateName).toBe("SecondState");
    // @ts-ignore
    expect(execCtx.history[2].stateName).toBe("ThirdState");
  });

  it("should capture execution metadata", async () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const execCtx = await sm.execute("test");

    expect(execCtx.startTime).toBeDefined();
    expect(execCtx.endTime).toBeDefined();
    expect(execCtx.endTime!.getTime()).toBeGreaterThanOrEqual(
      execCtx.startTime.getTime(),
    );
    expect(execCtx.currentStateName).toBe("FirstState");
  });

  // Note: YAML tests require 'js-yaml' to be installed.
  it("should create from YAML definition", () => {
    const definition = `
Comment: A simple state machine
StartAt: FirstState
States:
  FirstState:
    Type: Pass
    Result: Hello World
    End: true
    `;
    const sm = StateMachine.fromYaml(definition);
    expect(sm.comment).toBe("A simple state machine");
    expect(sm.startAt).toBe("FirstState");
  });

  it("should convert to YAML", () => {
    const definition = `{
      "StartAt": "FirstState",
      "States": { "FirstState": { "Type": "Pass", "End": true } }
    }`;
    const sm = StateMachine.fromJson(definition);
    const yamlStr = sm.toYaml();
    expect(yamlStr).toContain("StartAt: FirstState");
    expect(yamlStr).toContain("States:");
  });
});
