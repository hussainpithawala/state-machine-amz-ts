/**
 * Tests for Execution implementation.
 */
import ExecutionImpl, {StateHistory} from "../../src/execution/ExecutionImpl";
import {StateFactory} from "../../src/factory/StateFactory";
import {BaseState} from "../../src/states/base";

describe("Execution", () => {
    let factory: StateFactory;
    let state1: BaseState, state2: BaseState, state3: BaseState;

    beforeAll(() => {
        factory = new StateFactory();
        state1 = factory.createState("State1", {Type: "Pass", Next: "State2"});
        state2 = factory.createState("State2", {Type: "Pass", Next: "State3"});
        state3 = factory.createState("State3", {Type: "Pass", End: true});
    })
    it("should create new execution context", () => {
        const execCtx = ExecutionImpl.newContext("test-exec", "StartState", {
            key: "value",
        });

        expect(execCtx).toBeDefined();
        expect(execCtx.name).toBe("test-exec");
        expect(execCtx.currentStateName).toBe("StartState");
        expect(execCtx.input).toEqual({key: "value"});
        expect(execCtx.status).toBe("RUNNING");
        expect(execCtx.id.startsWith("exec-")).toBe(true);
        expect(execCtx.history).toHaveLength(0);
    });

    it("should create execution with custom ID", () => {
        const execCtx = ExecutionImpl.create("custom-id", "test", null);
        expect(execCtx.id).toBe("custom-id");
        expect(execCtx.name).toBe("test");
    });

    it("should generate ID if not provided", () => {
        const execCtx = ExecutionImpl.create(undefined, "test", null);
        expect(execCtx.id).toBeDefined();
        expect(execCtx.id.startsWith("exec-")).toBe(true);
    });


    it("should add state history", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        execCtx.addStateHistory(state1, {in: "data"}, {out: "result"});
        execCtx.addStateHistory(state2, {in2: "data2"}, {out2: "result2"});
        expect(execCtx.history).toHaveLength(2);
        expect(execCtx).toBeDefined();
        // @ts-ignore
        expect(execCtx.history[0].stateName).toBe("State1");
        // @ts-ignore
        expect(execCtx.history[0].input).toEqual({in: "data"});
        // @ts-ignore
        expect(execCtx.history[0].output).toEqual({out: "result"});
        // @ts-ignore
        expect(execCtx.history[0].status).toBe("SUCCEEDED");
        // @ts-ignore
        expect(execCtx.history[0].sequenceNumber).toBe(0);
        // @ts-ignore
        expect(execCtx.history[1].stateName).toBe("State2");
        // @ts-ignore
        expect(execCtx.history[1].sequenceNumber).toBe(1);
    });

    it("should get last executed state", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        execCtx.addStateHistory(state1, null, "result1");
        execCtx.addStateHistory(state2, null, "result2");

        const last = execCtx.getLastState();
        expect(last).toBeDefined();
        expect(last.stateName).toBe("State2");
        expect(last.output).toBe("result2");
    });

    it("should throw when getting last state with no history", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        expect(() => execCtx.getLastState()).toThrow("No history available");
    });

    it("should get history for specific state", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        execCtx.addStateHistory(state1, null, "result1");
        execCtx.addStateHistory(state2, null, "result2");
        execCtx.addStateHistory(state1, null, "result3");

        const history = execCtx.getStateHistory("State1");
        expect(history).toHaveLength(2);
        // @ts-ignore
        expect(history[0].output).toBe("result1");
        // @ts-ignore
        expect(history[1].output).toBe("result3");
    });

    it("should return empty array for non-existent state history", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        execCtx.addStateHistory(state1, null, "result1");
        expect(execCtx.getStateHistory("NonExistent")).toHaveLength(0);
    });

    it("should calculate execution duration", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        expect(execCtx.getDuration()).toBeGreaterThanOrEqual(0);

        // Simulate completion 5 seconds later
        execCtx.endTime = new Date(execCtx.startTime.getTime() + 5000);
        expect(execCtx.getDuration()).toBeCloseTo(5.0, 1);
    });

    it("should check if execution is complete", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
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
        const execCtx = ExecutionImpl.newContext("test-exec", "Start", {
            input: "data",
        });
        execCtx.addStateHistory(state1, {input: "data"}, {output: "result"});
        execCtx.status = "SUCCEEDED";
        execCtx.endTime = new Date();
        execCtx.output = {final: "output"};

        const result = execCtx.toDict();

        expect(result.id).toBe(execCtx.id);
        expect(result.name).toBe("test-exec");
        expect(result.status).toBe("SUCCEEDED");
        expect(result.startTime).toBeDefined();
        expect(result.endTime).toBeDefined();
        expect(result.input).toEqual({input: "data"});
        expect(result.output).toEqual({final: "output"});
        expect(result.history).toBeDefined();
        expect((result.history as any[]).length).toBe(1);
    });

    it("should convert to dictionary with error", () => {
        const execCtx = ExecutionImpl.newContext("test", "Start", null);
        execCtx.error = new Error("Test error");
        execCtx.status = "FAILED";

        const result = execCtx.toDict();
        expect(result.error).toBeDefined();
        expect((result.error as string).includes("Test error")).toBe(true);
    });

    it("should convert state history to dictionary", () => {
        const history = new StateHistory({
            endTime: undefined,
            error: undefined,
            executionId: "",
            id: "",
            sequenceNumber: 0,
            startTime: new Date(),
            timestamp: new Date(),
            stateName: "TestState",
            stateType: "Pass",
            status: "SUCCEEDED",
            input: {in: "data"},
            output: {out: "result"},
            retryCount: 2
        });

        const result = history.toDict();
        expect(result.stateName).toBe("TestState");
        expect(result.stateType).toBe("Pass");
        expect(result.status).toBe("SUCCEEDED");
        expect(result.input).toEqual({in: "data"});
        expect(result.output).toEqual({out: "result"});
        expect(result.retryCount).toBe(2);
        expect(result.timestamp).toBeDefined();
    });

    it("should generate unique execution IDs", () => {
        const exec1 = ExecutionImpl.newContext("test1", "Start", null);
        const exec2 = ExecutionImpl.newContext("test2", "Start", null);

        expect(exec1.id.startsWith("exec-")).toBe(true);
        expect(exec2.id.startsWith("exec-")).toBe(true);
        expect(exec1.id).not.toBe(exec2.id);
    });

    it("should have correct string representation", () => {
        const execCtx = ExecutionImpl.newContext("test-name", "Start", null);
        execCtx.addStateHistory(state1, null, null);

        const strRepr = execCtx.toString();
        expect(strRepr.includes("test-name")).toBe(true);
        expect(strRepr.includes(execCtx.id)).toBe(true);
        expect(strRepr.includes("RUNNING")).toBe(true);
    });

    it("should handle state history with error", () => {
        const error = new Error("Task failed");
        const history = new StateHistory({
            endTime: undefined,
            executionId: "",
            id: "",
            input: undefined,
            output: undefined,
            retryCount: 0,
            sequenceNumber: 0,
            startTime: undefined,
            stateType: "Fail",
            timestamp: new Date(),
            stateName: "FailedState",
            status: "FAILED",
            error: error
        });

        const result = history.toDict();
        expect(result.status).toBe("FAILED");
        expect(result.error).toBeDefined();
        expect((result.error as string).includes("Task failed")).toBe(true);
    });

    it("should handle complete execution flow", () => {
        const execCtx = ExecutionImpl.newContext("complete-test", "Start", {
            initial: "data",
        });
        expect(execCtx.status).toBe("RUNNING");
        expect(execCtx.isComplete()).toBe(false);

        execCtx.addStateHistory(state1, {initial: "data"}, {step1: "result"});
        execCtx.addStateHistory(state2, {step1: "result"}, {step2: "result"});
        execCtx.addStateHistory(state3, {step2: "result"}, {final: "output"});

        execCtx.status = "SUCCEEDED";
        execCtx.endTime = new Date();
        execCtx.output = {final: "output"};

        expect(execCtx.isComplete()).toBe(true);
        expect(execCtx.history).toHaveLength(3);
        expect(execCtx.getDuration()).toBeGreaterThanOrEqual(0);
        expect(execCtx.getLastState().stateName).toBe("State3");

        const result = execCtx.toDict();
        expect(result.status).toBe("SUCCEEDED");
        expect((result.history as any[]).length).toBe(3);
    });

    it("should handle execution metadata fields", () => {
        const execCtx = ExecutionImpl.create("test-123", "metadata-test", {
            test: "data",
        });
        execCtx.stateMachineId = "sm-456";

        const result = execCtx.toDict();
        expect(result.stateMachineId).toBe("sm-456");
        expect(result.id).toBe("test-123");
        expect(result.name).toBe("metadata-test");
    });
});
