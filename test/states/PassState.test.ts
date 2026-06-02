/**
 * Tests for the PassState implementation.
 * Equivalent to test_pass_state.py using Jest.
 */

import {
    PassState,
    PassStateConfig
} from "./../../src/states/PassState";
import {
    StateError,
    setPathProcessor,
    PathProcessor
} from "./../../src/states/base";

import JSONPathProcessor from "./../../src/states/json_path";

describe("PassState", () => {
    const sampleInputData = {
        data: "input data",
        metadata: {source: "test", timestamp: "2024-01-15"},
        count: 42,
    };

    beforeEach(() => {
        // Ensure we always start with the real JSONPathProcessor
        setPathProcessor(new JSONPathProcessor());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // Test initialization and basic properties
    // ==========================================

    it("should create a basic PassState", () => {
        const state = new PassState({
            name: "TestPassState",
            nextState: "NextState",
            inputPath: "$.data",
            outputPath: "$.result",
            comment: "Test comment",
        });

        expect(state.name).toBe("TestPassState");
        expect(state.type).toBe("Pass");
        expect(state.nextState).toBe("NextState");
        expect(state.inputPath).toBe("$.data");
        expect(state.outputPath).toBe("$.result");
        expect(state.comment).toBe("Test comment");
        expect(state.end).toBe(false);
        expect(state.result).toBeUndefined();
        expect(state.parameters).toBeUndefined();
    });

    it("should create a PassState with end=true", () => {
        const state = new PassState({name: "EndPass", end: true});

        expect(state.name).toBe("EndPass");
        expect(state.type).toBe("Pass");
        expect(state.end).toBe(true);
        expect(state.nextState).toBeUndefined();
    });

    it("should create a PassState with static result", () => {
        const resultData = {status: "success", value: 100};
        const state = new PassState({
            name: "ResultPass",
            nextState: "NextState",
            result: resultData,
        });

        expect(state.result).toEqual(resultData);
        expect(state.parameters).toBeUndefined();
    });

    it("should create a PassState with parameters", () => {
        const params = {"key.$": "$.data", static: "value"};
        const state = new PassState({
            name: "ParamsPass",
            nextState: "NextState",
            parameters: params,
        });

        expect(state.parameters).toEqual(params);
        expect(state.result).toBeUndefined();
    });

    // ==========================================
    // Test validation
    // ==========================================

    it.each([
        {name: "ValidPass", nextState: "NextState"},
        {name: "ValidPass", end: true},
        {name: "ValidPass", nextState: "Next", inputPath: "$.data", outputPath: "$.out"},
        {name: "ValidPass", nextState: "Next", result: {key: "value"}},
        {name: "ValidPass", nextState: "Next", parameters: {key: "value"}},
        {name: "ValidPass", nextState: "Next", resultPath: "$.result"},
    ])("should validate valid PassState configurations: %p", (config) => {
        expect(() => new PassState(config as PassStateConfig)).not.toThrow();
    });

    it("should throw validation error with empty name", () => {
        expect(() => new PassState({name: "", nextState: "Next"} as any)).toThrow(
            "State name cannot be empty"
        );
    });

    it("should throw validation error with wrong type", () => {
        const state = new PassState({name: "WrongType", nextState: "Next"});
        (state as any).type = "Succeed"; // Bypass TS checks to simulate mutation

        expect(() => state.validate()).toThrow("must have Type 'Pass'");
    });

    it("should throw validation error without Next or End", () => {
        expect(() => new PassState({name: "InvalidPass", end: false} as any)).toThrow(
            "State must have either Next or End"
        );
    });

    it("should throw validation error with both Next and End", () => {
        expect(() =>
            new PassState({name: "InvalidPass", nextState: "NextState", end: true})
        ).toThrow("State cannot have both Next and End");
    });

    it("should throw validation error with both Result and Parameters", () => {
        expect(() =>
            new PassState({
                name: "InvalidPass",
                nextState: "Next",
                result: {key: "value"},
                parameters: {param: "value"},
            })
        ).toThrow("cannot have both Result and Parameters");
    });

    // ==========================================
    // Test execute method (Real JSONPathProcessor Integration)
    // ==========================================

    it("should execute simple PassState without result (pass-through)", async () => {
        const state = new PassState({name: "SimplePass", nextState: "NextState"});
        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual(sampleInputData);
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with static result (replaces input)", async () => {
        const resultData = {status: "processed", value: 123};
        const state = new PassState({
            name: "ResultPass",
            nextState: "NextState",
            result: resultData,
        });

        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual(resultData);
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with parameters", async () => {
        const params = {key: "value", number: 42};
        const state = new PassState({
            name: "ParamsPass",
            nextState: "NextState",
            parameters: params,
        });

        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual(params);
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with input path", async () => {
        const state = new PassState({
            name: "InputPathPass",
            nextState: "NextState",
            inputPath: "$.data",
        });

        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toBe("input data"); // sampleInputData.data
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with output path", async () => {
        const state = new PassState({
            name: "OutputPathPass",
            nextState: "NextState",
            outputPath: "$.metadata.source",
        });

        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toBe("test");
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with result path", async () => {
        const resultData = {new: "data"};
        const state = new PassState({
            name: "ResultPathPass",
            nextState: "NextState",
            result: resultData,
            resultPath: "$.output",
        });

        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual({...sampleInputData, output: resultData});
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with all paths", async () => {
        const input = {data: {value: 1}, other: "keep"};
        const resultData = {injected: "value"};

        const state = new PassState({
            name: "CompletePass",
            nextState: "NextState",
            inputPath: "$.data",
            resultPath: "$.result",
            outputPath: "$.result",
            result: resultData,
        });

        const [output, nextState] = await state.execute(input);

        // inputPath extracts $.data -> { value: 1 }
        // resultPath merges result -> { value: 1, result: { injected: "value" } }
        // outputPath extracts $.result -> { injected: "value" }
        expect(output).toEqual(resultData);
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState with context", async () => {
        const state = new PassState({name: "ContextPass", nextState: "NextState"});
        const context = {execution_id: "test-123", timestamp: "2024-01-15"};

        const [output, nextState] = await state.execute(sampleInputData, context);

        expect(output).toEqual(sampleInputData);
        expect(nextState).toBe("NextState");
    });

    it("should execute PassState as end state", async () => {
        const state = new PassState({name: "EndPass", end: true});
        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual(sampleInputData);
        expect(nextState).toBeUndefined(); // End state has no next
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

        const state = new PassState({name: "ErrorPass", nextState: "NextState"});
        state.setPathProcessor(badProcessor);

        await expect(state.execute(sampleInputData)).rejects.toThrow(StateError);
        await expect(state.execute(sampleInputData)).rejects.toThrow(
            "Failed to execute pass state 'ErrorPass'"
        );
    });

    it("should execute PassState with null input", async () => {
        const state = new PassState({name: "NilPass", nextState: "NextState"});
        const [output, nextState] = await state.execute(null);

        expect(output).toBeNull();
        expect(nextState).toBe("NextState");
    });

    it("should use default path processor when none is set", async () => {
        // Temporarily clear to force lazy initialization
        setPathProcessor(undefined as any);

        const state = new PassState({name: "DefaultPass", nextState: "NextState"});
        const [output, nextState] = await state.execute(sampleInputData);

        expect(output).toEqual(sampleInputData);
        expect(nextState).toBe("NextState");

        // Restore
        setPathProcessor(new JSONPathProcessor());
    });

    // ==========================================
    // Test toDict method
    // ==========================================

    it("should convert simple PassState to dict", () => {
        const state = new PassState({name: "SimplePass", nextState: "NextState"});
        expect(state.toDict()).toEqual({Type: "Pass", Next: "NextState"});
    });

    it("should convert end state to dict", () => {
        const state = new PassState({name: "EndPass", end: true});
        expect(state.toDict()).toEqual({Type: "Pass", End: true});
    });

    it("should convert state with result to dict", () => {
        const resultData = {status: "success", value: 100};
        const state = new PassState({
            name: "ResultPass",
            nextState: "NextState",
            result: resultData,
        });
        expect(state.toDict()).toEqual({Type: "Pass", Next: "NextState", Result: resultData});
    });

    it("should convert state with parameters to dict", () => {
        const params = {"key.$": "$.data", static: "value"};
        const state = new PassState({
            name: "ParamsPass",
            nextState: "NextState",
            parameters: params,
        });
        expect(state.toDict()).toEqual({Type: "Pass", Next: "NextState", Parameters: params});
    });

    it("should convert complete state to dict", () => {
        const state = new PassState({
            name: "CompletePass",
            nextState: "NextState",
            inputPath: "$.input",
            resultPath: "$.result",
            outputPath: "$.output",
            result: {key: "value"},
            comment: "Complete pass state",
        });

        expect(state.toDict()).toEqual({
            Type: "Pass",
            Next: "NextState",
            InputPath: "$.input",
            ResultPath: "$.result",
            OutputPath: "$.output",
            Result: {key: "value"},
            Comment: "Complete pass state",
        });
    });

    // ==========================================
    // Test toJson method
    // ==========================================

    it("should convert state to JSON string", () => {
        const state = new PassState({
            name: "JsonPass",
            nextState: "NextState",
            result: {status: "ok"},
        });

        const jsonStr = state.toJson();
        const result = JSON.parse(jsonStr);

        expect(result).toEqual({Type: "Pass", Next: "NextState", Result: {status: "ok"}});
    });

    it("should convert state to indented JSON string", () => {
        const state = new PassState({name: "IndentedPass", nextState: "Next"});
        const jsonStr = state.toJson(2);
        expect(jsonStr).toContain("\n  ");
    });

    // ==========================================
    // Test getNextStates method
    // ==========================================

    it("should get next states", () => {
        const state = new PassState({name: "TestPass", nextState: "NextState"});
        expect(state.getNextStates()).toEqual(["NextState"]);
    });

    it("should return empty array for end state", () => {
        const state = new PassState({name: "EndPass", end: true});
        expect(state.getNextStates()).toEqual([]);
    });

    // ==========================================
    // Test string representations
    // ==========================================

    it("should have correct string representation", () => {
        const state = new PassState({name: "TestPass", nextState: "NextState"});
        expect(state.toString()).toBe("PassState(name=TestPass)");
    });

    // ==========================================
    // Test edge cases
    // ==========================================

    it("should execute with empty input", async () => {
        const state = new PassState({name: "EmptyPass", nextState: "NextState"});
        const emptyInput = {};
        const [output, nextState] = await state.execute(emptyInput);

        expect(output).toEqual({});
        expect(nextState).toBe("NextState");
    });

    it("should execute with different input types", async () => {
        const state = new PassState({name: "TypeTestPass", nextState: "NextState"});

        const testCases = [
            {input: "string input", desc: "string"},
            {input: 42, desc: "integer"},
            {input: 3.14, desc: "float"},
            {input: true, desc: "boolean"},
            {input: [1, 2, 3], desc: "list"},
            {input: {key: "value"}, desc: "dict"},
            {input: null, desc: "null"},
            {input: undefined, desc: "undefined"},
        ];

        for (const {input, desc} of testCases) {
            const [output, nextState] = await state.execute(input);
            expect(output).toBe(input); // Pass-through without paths
            expect(nextState).toBe("NextState");
        }
    });

    // ==========================================
    // Test inheritance
    // ==========================================

    it("should properly inherit from BaseState", () => {
        const state = new PassState({name: "InheritanceTest", nextState: "NextState"});

        expect(typeof state.execute).toBe("function");
        expect(typeof state.validate).toBe("function");
        expect(typeof state.toDict).toBe("function");
        expect(typeof state.toJson).toBe("function");
        expect(typeof state.getNextStates).toBe("function");
        expect(typeof state.setPathProcessor).toBe("function");

        expect(state.stateName).toBe("InheritanceTest");
        expect(state.stateType).toBe("Pass");
        expect(state.getNext()).toBe("NextState");
        expect(state.isEnd()).toBe(false);
    });

    // ==========================================
    // Test concurrency
    // ==========================================

    it("should handle concurrent execution", async () => {
        const state = new PassState({name: "ConcurrentPass", nextState: "NextState"});

        const numTasks = 10;
        const tasks = [];

        for (let i = 0; i < numTasks; i++) {
            const inputData = {id: i, data: `task_${i}`};
            tasks.push(state.execute(inputData));
        }

        const results = await Promise.all(tasks);

        expect(results).toHaveLength(numTasks);
        results.forEach(([output, nextState], i) => {
            expect((output as any).id).toBe(i);
            expect((output as any).data).toBe(`task_${i}`);
            expect(nextState).toBe("NextState");
        });
    });
});
