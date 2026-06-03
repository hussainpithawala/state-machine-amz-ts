/**
 * Tests for Execution implementation.
 */
import { Execution, StateHistory } from "../../src/execution/Execution";

describe("Execution", () => {
    it("should create new execution context", () => {
        const execCtx = Execution.newContext("test-exec", "StartState", { key: "value" });

        expect(execCtx).toBeDefined();
        expect(execCtx.name).toBe("test-exec");
        expect(execCtx.currentState).toBe("StartState");
        expect(execCtx.input).toEqual({ key: "value" });
        expect(execCtx.status).toBe("RUNNING");
        expect(execCtx.id.startsWith("exec-")).toBe(true);
        expect(execCtx.history).toHaveLength(0);
    });

    it("should create execution with custom ID", () => {
        const execCtx = Execution.create("custom-id", "test", null);
        expect(execCtx.id).toBe("custom-id");
        expect(execCtx.name).toBe("test");
    });

    it("should generate ID if not provided", () => {
        const execCtx = Execution.create(undefined, "test", null);
        expect(execCtx.id).toBeDefined();
        expect(execCtx.id.startsWith("exec-")).toBe(true);
    });

    it("should add state history", () => {
        const execCtx = Execution.newContext("test", "Start", null);

        execCtx.addStateHistory("State1", { in: "data" }, { out: "result" });
        execCtx.addStateHistory("State2", { in2: "data2" }, { out2: "result2" });

        expect(execCtx.history).toHaveLength(2);
        expect(execCtx.history[0].stateName).toBe("State1");
        expect(execCtx.history[0].input).toEqual({ in: "data" });
        expect(execCtx.history[0].output).toEqual({ out: "result" });
        expect(execCtx.history[0].status).toBe("SUCCEEDED");
        expect(execCtx.history[0].sequenceNumber).toBe(0);

        expect(execCtx.history[1].stateName).toBe("State2");
        expect(execCtx.history[1].sequenceNumber).toBe(1);
    });

    it("should get last executed state", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        execCtx.addStateHistory("State1", null, "result1");
        execCtx.addStateHistory("State2", null, "result2");

        const last = execCtx.getLastState();
        expect(last).toBeDefined();
        expect(last.stateName).toBe("State2");
        expect(last.output).toBe("result2");
    });

    it("should throw when getting last state with no history", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        expect(() => execCtx.getLastState()).toThrow("No history available");
    });

    it("should get history for specific state", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        execCtx.addStateHistory("State1", null, "result1");
        execCtx.addStateHistory("State2", null, "result2");
        execCtx.addStateHistory("State1", null, "result3");

        const history = execCtx.getStateHistory("State1");
        expect(history).toHaveLength(2);
        expect(history[0].output).toBe("result1");
        expect(history[1].output).toBe("result3");
    });

    it("should return empty array for non-existent state history", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        execCtx.addStateHistory("State1", null, "result1");
        expect(execCtx.getStateHistory("NonExistent")).toHaveLength(0);
    });

    it("should calculate execution duration", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        expect(execCtx.getDuration()).toBeGreaterThanOrEqual(0);

        // Simulate completion 5 seconds later
        execCtx.endTime = new Date(execCtx.startTime.getTime() + 5000);
        expect(execCtx.getDuration()).toBeCloseTo(5.0, 1);
    });

    it("should check if execution is complete", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        expect(execCtx.isComplete()).toBe(false);

        execCtx.status = "SUCCEEDED";
        expect(execCtx.isComplete()).toBe(true);

        execCtx.status = "FAILED";
        expect(execCtx.isComplete()).toBe(true);

        execCtx.status = "TIMED_OUT";
        expect(execCtx.isComplete()).toBe(true);

        execCtx.status = "ABORTED";
        expect(execCtx.isComplete()).toBe(true);

        execCtx.status = "RUNNING";
        expect(execCtx.isComplete()).toBe(false);
    });

    it("should convert to dictionary", () => {
        const execCtx = Execution.newContext("test-exec", "Start", { input: "data" });
        execCtx.addStateHistory("State1", { input: "data" }, { output: "result" });
        execCtx.status = "SUCCEEDED";
        execCtx.endTime = new Date();
        execCtx.output = { final: "output" };

        const result = execCtx.toDict();

        expect(result.id).toBe(execCtx.id);
        expect(result.name).toBe("test-exec");
        expect(result.status).toBe("SUCCEEDED");
        expect(result.startTime).toBeDefined();
        expect(result.endTime).toBeDefined();
        expect(result.input).toEqual({ input: "data" });
        expect(result.output).toEqual({ final: "output" });
        expect(result.history).toBeDefined();
        expect((result.history as any[]).length).toBe(1);
    });

    it("should convert to dictionary with error", () => {
        const execCtx = Execution.newContext("test", "Start", null);
        execCtx.error = new Error("Test error");
        execCtx.status = "FAILED";

        const result = execCtx.toDict();
        expect(result.error).toBeDefined();
        expect((result.error as string).includes("Test error")).toBe(true);
    });

    it("should convert state history to dictionary", () => {
        const history = new StateHistory({
            stateName: "TestState",
            stateType: "Pass",
            status: "SUCCEEDED",
            input: { in: "data" },
            output: { out: "result" },
            retryCount: 2,
        });

        const result = history.toDict();
        expect(result.stateName).toBe("TestState");
        expect(result.stateType).toBe("Pass");
        expect(result.status).toBe("SUCCEEDED");
        expect(result.input).toEqual({ in: "data" });
        expect(result.output).toEqual({ out: "result" });
        expect(result.retryCount).toBe(2);
        expect(result.timestamp).toBeDefined();
    });

    it("should generate unique execution IDs", () => {
        const exec1 = Execution.newContext("test1", "Start", null);
        const exec2 = Execution.newContext("test2", "Start", null);

        expect(exec1.id.startsWith("exec-")).toBe(true);
        expect(exec2.id.startsWith("exec-")).toBe(true);
        expect(exec1.id).not.toBe(exec2.id);
    });

    it("should have correct string representation", () => {
        const execCtx = Execution.newContext("test-name", "Start", null);
        execCtx.addStateHistory("State1", null, null);

        const strRepr = execCtx.toString();
        expect(strRepr.includes("test-name")).toBe(true);
        expect(strRepr.includes(execCtx.id)).toBe(true);
        expect(strRepr.includes("RUNNING")).toBe(true);
    });

    it("should handle state history with error", () => {
        const error = new Error("Task failed");
        const history = new StateHistory({
            stateName: "FailedState",
            status: "FAILED",
            error,
        });

        const result = history.toDict();
        expect(result.status).toBe("FAILED");
        expect(result.error).toBeDefined();
        expect((result.error as string).includes("Task failed")).toBe(true);
    });

    it("should handle complete execution flow", () => {
        const execCtx = Execution.newContext("complete-test", "Start", { initial: "data" });
        expect(execCtx.status).toBe("RUNNING");
        expect(execCtx.isComplete()).toBe(false);

        execCtx.addStateHistory("State1", { initial: "data" }, { step1: "result" });
        execCtx.addStateHistory("State2", { step1: "result" }, { step2: "result" });
        execCtx.addStateHistory("State3", { step2: "result" }, { final: "output" });

        execCtx.status = "SUCCEEDED";
        execCtx.endTime = new Date();
        execCtx.output = { final: "output" };

        expect(execCtx.isComplete()).toBe(true);
        expect(execCtx.history).toHaveLength(3);
        expect(execCtx.getDuration()).toBeGreaterThanOrEqual(0);
        expect(execCtx.getLastState().stateName).toBe("State3");

        const result = execCtx.toDict();
        expect(result.status).toBe("SUCCEEDED");
        expect((result.history as any[]).length).toBe(3);
    });

    it("should handle execution metadata fields", () => {
        const execCtx = Execution.create("test-123", "metadata-test", { test: "data" });
        execCtx.stateMachineId = "sm-456";

        const result = execCtx.toDict();
        expect(result.stateMachineId).toBe("sm-456");
        expect(result.id).toBe("test-123");
        expect(result.name).toBe("metadata-test");
    });
});
