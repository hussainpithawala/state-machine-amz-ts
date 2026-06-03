/**
 * Tests for ParallelState implementation.
 */

import { ParallelState, Branch, createBranch } from "../../src/states/ParallelState";
import { PassState, PassStateConfig } from "../../src/states/PassState";
import { FailState } from "../../src/states/FailState";
import { ChoiceState } from "../../src/states/ChoiceState";
import { StateError } from "../../src/states/base";

describe("ParallelState", () => {
    it("should execute multiple branches concurrently", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            nextState: "NextState",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: {
                        Pass1: new PassState({ name: "Pass1", result: "branch1-result", end: true }),
                    },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: {
                        Pass2: new PassState({ name: "Pass2", result: "branch2-result", end: true }),
                    },
                }),
            ],
        });

        const inputData = { original: "data" };
        const [output, nextState] = await state.execute(inputData);

        expect(output).toBeDefined();
        expect(nextState).toBe("NextState");

        // Verify output is an array of results
        expect(Array.isArray(output)).toBe(true);
        const results = output as unknown[];
        expect(results).toHaveLength(2);
        expect(results[0]).toBe("branch1-result");
        expect(results[1]).toBe("branch2-result");
    });

    it("should execute with input path", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            inputPath: "$.data",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", end: true }) },
                }),
            ],
        });

        const inputData = { data: { value: "test" }, other: "ignored" };
        const [output] = await state.execute(inputData);

        expect(Array.isArray(output)).toBe(true);
        const results = output as unknown[];
        expect(results).toHaveLength(2);

        // Each branch should receive the extracted input
        expect(results[0]).toEqual({ value: "test" });
        expect(results[1]).toEqual({ value: "test" });
    });

    it("should execute multi-state branch", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: {
                        Pass1: new PassState({ name: "Pass1", result: "step1", nextState: "Pass2" }),
                        Pass2: new PassState({ name: "Pass2", result: "final", end: true }),
                    },
                }),
            ],
        });

        const inputData = "initial";
        const [output] = await state.execute(inputData);

        expect(Array.isArray(output)).toBe(true);
        const results = output as unknown[];
        expect(results).toHaveLength(1);
        expect(results[0]).toBe("final");
    });

    it("should execute with result path", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            nextState: "NextState",
            resultPath: "$.results",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "value1", end: true }) },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", result: "value2", end: true }) },
                }),
            ],
        });

        const inputData = { original: "data" };
        const [output] = await state.execute(inputData);

        expect(typeof output).toBe("object");
        expect(output).not.toBeNull();
        const outObj = output as Record<string, unknown>;
        expect(outObj.original).toBe("data");

        const results = outObj.results as unknown[];
        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(2);
    });

    it("should execute with output path", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            outputPath: "$[0]",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "extracted", end: true }) },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", result: "ignored", end: true }) },
                }),
            ],
        });

        const inputData = "initial";
        const [output] = await state.execute(inputData);

        expect(output).toBe("extracted");
    });

    it("should fail when one branch fails", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "success", end: true }) },
                }),
                new Branch({
                    startAt: "Fail1",
                    states: {
                        Fail1: new FailState({
                            name: "Fail1",
                            error: "BranchError",
                            cause: "Branch failed intentionally",
                        }),
                    },
                }),
            ],
        });

        const inputData = "initial";
        await expect(state.execute(inputData)).rejects.toThrow(StateError);
    });

    it("should execute with result selector", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            resultSelector: { first: "$[0]", second: "$[1]", count: 2 },
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "value1", end: true }) },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", result: "value2", end: true }) },
                }),
            ],
        });

        const inputData = "initial";
        const [output] = await state.execute(inputData);

        expect(typeof output).toBe("object");
        expect(output).not.toBeNull();
        const outObj = output as Record<string, unknown>;
        expect(outObj.first).toBe("value1");
        expect(outObj.second).toBe("value2");
        expect(outObj.count).toBe(2);
    });

    it("should execute branches concurrently", async () => {
        const executionLog: string[] = [];

        class LoggingPassState extends PassState {
            private delay: number;

            constructor(name: string, delay: number, config: Partial<PassStateConfig>) {
                super({ name, ...config });
                this.delay = delay;
            }

            override async execute(
                inputData: unknown,
                context?: Record<string, unknown>
            ): Promise<[unknown, string | undefined]> {
                executionLog.push(`${this.name}_start`);
                await new Promise((resolve) => setTimeout(resolve, this.delay));
                executionLog.push(`${this.name}_end`);
                return super.execute(inputData, context);
            }
        }

        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: {
                        Pass1: new LoggingPassState("Pass1", 100, { result: "result1", end: true }),
                    },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: {
                        Pass2: new LoggingPassState("Pass2", 100, { result: "result2", end: true }),
                    },
                }),
            ],
        });

        await state.execute("test");

        // Both should start before either ends (concurrent execution)
        expect(executionLog).toContain("Pass1_start");
        expect(executionLog).toContain("Pass2_start");

        const pass1StartIdx = executionLog.indexOf("Pass1_start");
        const pass2StartIdx = executionLog.indexOf("Pass2_start");
        const pass1EndIdx = executionLog.indexOf("Pass1_end");
        const pass2EndIdx = executionLog.indexOf("Pass2_end");

        expect(pass1StartIdx).toBeLessThan(pass1EndIdx);
        expect(pass2StartIdx).toBeLessThan(pass2EndIdx);

        // Verify interleaving (concurrency)
        expect(Math.min(pass1StartIdx, pass2StartIdx)).toBeLessThan(Math.max(pass1EndIdx, pass2EndIdx));
    });

    it("should validate parallel state configuration", () => {
        // Valid parallel state
        const validState = new ParallelState({
            name: "ValidParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                }),
            ],
        });
        expect(() => validState.validate()).not.toThrow();

        // No branches
        expect(() => new ParallelState({ name: "NoBranches", branches: [] })).toThrow(
            "must have at least one branch"
        );

        // Branch missing StartAt
        expect(
            () =>
                new Branch({
                    startAt: "",
                    states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                })
        ).toThrow("StartAt is required");

        // StartAt state not found
        expect(
            () =>
                new ParallelState({
                    name: "MissingStartAt",
                    branches: [
                        new Branch({
                            startAt: "NonExistent",
                            states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                        }),
                    ],
                })
        ).toThrow("StartAt state 'NonExistent' not found");

        // State without End or Next
        expect(
            () =>
                new ParallelState({
                    name: "InvalidStateConfig",
                    branches: [
                        new Branch({
                            startAt: "Pass1",
                            states: { Pass1: new PassState({ name: "Pass1", end: false }) },
                        }),
                    ],
                })
        ).toThrow("State must have either Next or End");

        // Multiple valid branches
        expect(() =>
            new ParallelState({
                name: "MultiBranch",
                branches: [
                    new Branch({ startAt: "Pass1", states: { Pass1: new PassState({ name: "Pass1", end: true }) } }),
                    new Branch({ startAt: "Pass2", states: { Pass2: new PassState({ name: "Pass2", end: true }) } }),
                ],
            })
        ).not.toThrow();
    });

    it("should have correct getters", () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({ startAt: "Pass1", states: { Pass1: new PassState({ name: "Pass1", end: true }) } }),
            ],
        });

        expect(state.stateType).toBe("Parallel");
        expect(state.isEnd()).toBe(true);
    });

    it("should get next states correctly", () => {
        const stateWithNext = new ParallelState({
            name: "TestParallel",
            nextState: "NextState",
            branches: [
                new Branch({ startAt: "Pass1", states: { Pass1: new PassState({ name: "Pass1", end: true }) } }),
            ],
        });
        expect(stateWithNext.getNextStates()).toEqual(["NextState"]);

        const stateWithEnd = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({ startAt: "Pass1", states: { Pass1: new PassState({ name: "Pass1", end: true }) } }),
            ],
        });
        expect(stateWithEnd.getNextStates()).toEqual([]);
    });

    it("should serialize to dict correctly", () => {
        const state = new ParallelState({
            name: "TestParallel",
            nextState: "NextState",
            resultPath: "$.results",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "value1", end: true }) },
                    comment: "First branch",
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", result: "value2", end: true }) },
                }),
            ],
        });

        const stateDict = state.toDict();

        expect(stateDict.Type).toBe("Parallel");
        expect(stateDict.Next).toBe("NextState");
        expect(stateDict.ResultPath).toBe("$.results");
        expect(Array.isArray(stateDict.Branches)).toBe(true);
        expect((stateDict.Branches as unknown[]).length).toBe(2);

        const branches = stateDict.Branches as Record<string, unknown>[];
        expect(branches[0].StartAt).toBe("Pass1");
        expect(branches[0].Comment).toBe("First branch");
    });

    it("should create branch using helper function", () => {
        const branch = createBranch("Pass1", {
            Pass1: new PassState({ name: "Pass1", end: true }),
        }, "Test branch");

        expect(branch.startAt).toBe("Pass1");
        expect("Pass1" in branch.states).toBe(true);
        expect(branch.comment).toBe("Test branch");
    });

    it("should validate branch configuration", () => {
        // Valid branch
        const validBranch = new Branch({
            startAt: "Pass1",
            states: { Pass1: new PassState({ name: "Pass1", end: true }) },
        });
        expect(validBranch.startAt).toBe("Pass1");

        // Empty StartAt
        expect(
            () =>
                new Branch({
                    startAt: "",
                    states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                })
        ).toThrow("StartAt is required");

        // Empty states
        expect(() => new Branch({ startAt: "Pass1", states: {} })).toThrow(
            "Branch must have at least one state"
        );
    });

    it("should execute branch with choice state", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Choice1",
                    states: {
                        Choice1: new ChoiceState({
                            name: "Choice1",
                            choices: [],
                            default: "Pass1",
                        }),
                        Pass1: new PassState({ name: "Pass1", result: "choice-result", end: true }),
                    },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", result: "direct-result", end: true }) },
                }),
            ],
        });

        const [output] = await state.execute({ test: "data" });

        expect(Array.isArray(output)).toBe(true);
        const results = output as unknown[];
        expect(results).toHaveLength(2);
        expect(results[0]).toBe("choice-result");
        expect(results[1]).toBe("direct-result");
    });

    it("should propagate errors in branches correctly", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Error1",
                    states: { Error1: new FailState({ name: "Error1", error: "Error1" }) },
                }),
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", result: "success", end: true }) },
                }),
            ],
        });

        await expect(state.execute("test")).rejects.toThrow(StateError);
    });

    it("should handle branches that return undefined/null", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: { Pass1: new PassState({ name: "Pass1", end: true }) },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: { Pass2: new PassState({ name: "Pass2", end: true }) },
                }),
            ],
        });

        const [output] = await state.execute("test");

        expect(Array.isArray(output)).toBe(true);
        const results = output as unknown[];
        expect(results).toHaveLength(2);
        // PassState without result returns the input data
        expect(results[0]).toBe("test");
        expect(results[1]).toBe("test");
    });

    it("should handle complex data flow with paths", async () => {
        const state = new ParallelState({
            name: "TestParallel",
            end: true,
            inputPath: "$.payload",
            resultPath: "$.parallel_results",
            outputPath: "$.parallel_results",
            branches: [
                new Branch({
                    startAt: "Pass1",
                    states: {
                        Pass1: new PassState({
                            name: "Pass1",
                            result: { branch: "first", status: "complete" },
                            end: true,
                        }),
                    },
                }),
                new Branch({
                    startAt: "Pass2",
                    states: {
                        Pass2: new PassState({
                            name: "Pass2",
                            result: { branch: "second", status: "complete" },
                            end: true,
                        }),
                    },
                }),
            ],
        });

        const inputData = { payload: { data: "test" }, metadata: "ignored" };
        const [output] = await state.execute(inputData);

        expect(Array.isArray(output)).toBe(true);
        const results = output as Record<string, unknown>[];
        expect(results).toHaveLength(2);
        expect((results[0] as Record<string, unknown>).branch).toBe("first");
        expect((results[1] as Record<string, unknown>).branch).toBe("second");
    });
});
