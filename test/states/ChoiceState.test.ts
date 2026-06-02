/**
 * Tests for the Choice state implementation.
 */

import { ChoiceState, ChoiceRule, ChoiceStateConfig } from "./../../src/states/ChoiceState";
import {
    StateError,
    setPathProcessor,
} from "./../../src/states/base";
import {JSONPathProcessor} from "./../../src/states";

describe("ChoiceRule", () => {
    it("should create a basic ChoiceRule", () => {
        const rule = new ChoiceRule({
            variable: "$.value",
            numericEquals: 10,
            next: "Path1",
        });

        expect(rule.variable).toBe("$.value");
        expect(rule.numericEquals).toBe(10);
        expect(rule.next).toBe("Path1");
    });

    it("should convert ChoiceRule to dict", () => {
        const rule = new ChoiceRule({
            variable: "$.status",
            stringEquals: "active",
            next: "ActivePath",
            comment: "Check if active",
        });

        const result = rule.toDict();

        expect(result.Variable).toBe("$.status");
        expect(result.StringEquals).toBe("active");
        expect(result.Next).toBe("ActivePath");
        expect(result.Comment).toBe("Check if active");
    });

    it("should convert ChoiceRule to dict with AND operator", () => {
        const rule = new ChoiceRule({
            variable: "$.user",
            andRules: [
                new ChoiceRule({
                    variable: "$.age",
                    numericGreaterThan: 18,
                }),
                new ChoiceRule({
                    variable: "$.country",
                    stringEquals: "US",
                }),
            ],
            next: "AdultInUS",
        });

        const result = rule.toDict();

        expect(result.Variable).toBe("$.user");
        expect(result.Next).toBe("AdultInUS");
        expect(result.And).toBeDefined();
        expect(result.And).toHaveLength(2);
    });
});

describe("ChoiceState", () => {
    beforeEach(() => {
        setPathProcessor(new JSONPathProcessor());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // Test initialization
    // ==========================================

    it("should create a basic ChoiceState", () => {
        const state = new ChoiceState({
            name: "TestChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Path1",
                }),
            ],
            default: "DefaultPath",
        });

        expect(state.name).toBe("TestChoice");
        expect(state.type).toBe("Choice");
        expect(state.choices).toHaveLength(1);
        expect(state.default).toBe("DefaultPath");
        expect(state.getNext()).toBeUndefined();
        expect(state.isEnd()).toBe(false);
    });

    // ==========================================
    // Test validation
    // ==========================================

    it("should validate valid ChoiceState configuration", () => {
        const state = new ChoiceState({
            name: "ValidChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "NextState",
                }),
            ],
        });

        expect(() => state.validate()).not.toThrow();
    });

    it("should validate ChoiceState with default only", () => {
        const state = new ChoiceState({
            name: "ValidChoice",
            default: "DefaultState",
        });

        expect(() => state.validate()).not.toThrow();
    });

    it("should throw validation error without choices or default", () => {
        expect(() => new ChoiceState({ name: "InvalidChoice" })).toThrow(
            "must have either Choices or Default"
        );
    });

    it("should throw validation error with empty name", () => {
        expect(() =>
            new ChoiceState({
                name: "",
                choices: [
                    new ChoiceRule({
                        variable: "$.value",
                        numericEquals: 10,
                        next: "NextState",
                    }),
                ],
            })
        ).toThrow("State name cannot be empty");
    });

    it("should throw validation error with missing variable", () => {
        expect(() =>
            new ChoiceState({
                name: "InvalidChoice",
                choices: [
                    new ChoiceRule({
                        variable: "",
                        numericEquals: 10,
                        next: "NextState",
                    }),
                ],
            })
        ).toThrow("Variable is required");
    });

    it("should throw validation error with no comparison operator", () => {
        expect(() =>
            new ChoiceState({
                name: "InvalidChoice",
                choices: [
                    new ChoiceRule({
                        variable: "$.value",
                        next: "NextState",
                    }),
                ],
            })
        ).toThrow("must have at least one comparison operator");
    });

    it("should throw validation error with missing Next", () => {
        expect(() =>
            new ChoiceState({
                name: "InvalidChoice",
                choices: [
                    new ChoiceRule({
                        variable: "$.value",
                        numericEquals: 10,
                        next: "",
                    }),
                ],
            })
        ).toThrow("Next is required");
    });

    // ==========================================
    // Test execution - String comparisons
    // ==========================================

    it("should execute with StringEquals match", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    stringEquals: "active",
                    next: "ActivePath",
                }),
            ],
        });

        const inputData = { status: "active" };
        const [output, nextState] = await state.execute(inputData);

        expect(nextState).toBe("ActivePath");
        expect(output).toEqual(inputData);
    });

    it("should execute with StringEquals no match", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    stringEquals: "active",
                    next: "ActivePath",
                }),
            ],
            default: "DefaultPath",
        });

        const inputData = { status: "inactive" };
        const [output, nextState] = await state.execute(inputData);

        expect(nextState).toBe("DefaultPath");
        expect(output).toEqual(inputData);
    });

    it("should execute with StringLessThan", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.name",
                    stringLessThan: "M",
                    next: "BeforeM",
                }),
            ],
        });

        const inputData = { name: "Alice" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("BeforeM");
    });

    it("should execute with StringGreaterThan", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.name",
                    stringGreaterThan: "M",
                    next: "AfterM",
                }),
            ],
        });

        const inputData = { name: "Zoe" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("AfterM");
    });

    // ==========================================
    // Test execution - Numeric comparisons
    // ==========================================

    it("should execute with NumericEquals for integer", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.count",
                    numericEquals: 10,
                    next: "Equals10",
                }),
            ],
        });

        const inputData = { count: 10 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Equals10");
    });

    it("should execute with NumericEquals for float", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.price",
                    numericEquals: 99.99,
                    next: "PriceMatch",
                }),
            ],
        });

        const inputData = { price: 99.99 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("PriceMatch");
    });

    it("should execute with NumericLessThan", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.age",
                    numericLessThan: 18,
                    next: "Minor",
                }),
            ],
        });

        const inputData = { age: 16 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Minor");
    });

    it("should execute with NumericGreaterThan", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.score",
                    numericGreaterThan: 90,
                    next: "Excellent",
                }),
            ],
        });

        const inputData = { score: 95 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Excellent");
    });

    it("should execute with string to number conversion", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 42,
                    next: "Answer",
                }),
            ],
        });

        const inputData = { value: "42" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Answer");
    });

    // ==========================================
    // Test execution - Boolean comparisons
    // ==========================================

    it("should execute with BooleanEquals true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.enabled",
                    booleanEquals: true,
                    next: "Enabled",
                }),
            ],
        });

        const inputData = { enabled: true };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Enabled");
    });

    it("should execute with BooleanEquals false", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.active",
                    booleanEquals: false,
                    next: "Inactive",
                }),
            ],
        });

        const inputData = { active: false };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Inactive");
    });

    it("should execute with BooleanEquals for string 'true'", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    booleanEquals: true,
                    next: "TrueStatus",
                }),
            ],
        });

        const inputData = { status: "true" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("TrueStatus");
    });

    // ==========================================
    // Test execution - Timestamp comparisons
    // ==========================================

    it("should execute with TimestampEquals", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.eventTime",
                    timestampEquals: "2024-01-15T10:30:00Z",
                    next: "ExactTime",
                }),
            ],
        });

        const inputData = { eventTime: "2024-01-15T10:30:00Z" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("ExactTime");
    });

    it("should execute with TimestampLessThan", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.deadline",
                    timestampLessThan: "2024-12-31T23:59:59Z",
                    next: "BeforeDeadline",
                }),
            ],
        });

        const inputData = { deadline: "2024-06-15T12:00:00Z" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("BeforeDeadline");
    });

    it("should execute with Unix timestamp", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.timestamp",
                    timestampEquals: "2024-01-01T00:00:00Z",
                    next: "NewYear",
                }),
            ],
        });

        // Unix timestamp for 2024-01-01T00:00:00Z (in seconds)
        const inputData = { timestamp: 1704067200 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("NewYear");
    });

    // ==========================================
    // Test execution - Compound operators
    // ==========================================

    it("should execute with AND operator - both conditions true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.user",
                    andRules: [
                        new ChoiceRule({
                            variable: "$.age",
                            numericGreaterThan: 18,
                        }),
                        new ChoiceRule({
                            variable: "$.country",
                            stringEquals: "US",
                        }),
                    ],
                    next: "AdultInUS",
                }),
            ],
        });

        const inputData = { user: { age: 25, country: "US" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("AdultInUS");
    });

    it("should execute with AND operator - one condition false", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.user",
                    andRules: [
                        new ChoiceRule({
                            variable: "$.age",
                            numericGreaterThan: 18,
                        }),
                        new ChoiceRule({
                            variable: "$.country",
                            stringEquals: "US",
                        }),
                    ],
                    next: "AdultInUS",
                }),
            ],
            default: "DefaultPath",
        });

        const inputData = { user: { age: 16, country: "US" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("DefaultPath");
    });

    it("should execute with OR operator - first condition true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    orRules: [
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "200",
                        }),
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "201",
                        }),
                    ],
                    next: "Success",
                }),
            ],
        });

        const inputData = { status: { code: "200" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Success");
    });

    it("should execute with OR operator - second condition true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    orRules: [
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "200",
                        }),
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "201",
                        }),
                    ],
                    next: "Success",
                }),
            ],
        });

        const inputData = { status: { code: "201" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Success");
    });

    it("should execute with OR operator - no conditions true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    orRules: [
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "200",
                        }),
                        new ChoiceRule({
                            variable: "$.code",
                            stringEquals: "201",
                        }),
                    ],
                    next: "Success",
                }),
            ],
            default: "DefaultPath",
        });

        const inputData = { status: { code: "404" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("DefaultPath");
    });

    it("should execute with NOT operator - negation results in true", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.user",
                    notRule: new ChoiceRule({
                        variable: "$.status",
                        stringEquals: "inactive",
                    }),
                    next: "ActiveUser",
                }),
            ],
        });

        const inputData = { user: { status: "active" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("ActiveUser");
    });

    it("should execute with NOT operator - negation results in false", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.user",
                    notRule: new ChoiceRule({
                        variable: "$.status",
                        stringEquals: "inactive",
                    }),
                    next: "ActiveUser",
                }),
            ],
            default: "DefaultPath",
        });

        const inputData = { user: { status: "inactive" } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("DefaultPath");
    });

    // ==========================================
    // Test execution - Multiple choices
    // ==========================================

    it("should execute with multiple choices - first matches", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericLessThan: 0,
                    next: "Negative",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 0,
                    next: "Zero",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericGreaterThan: 0,
                    next: "Positive",
                }),
            ],
        });

        const inputData = { value: -5 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Negative");
    });

    it("should execute with multiple choices - second matches", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericLessThan: 0,
                    next: "Negative",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 0,
                    next: "Zero",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericGreaterThan: 0,
                    next: "Positive",
                }),
            ],
        });

        const inputData = { value: 0 };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Zero");
    });

    // ==========================================
    // Test execution - Paths
    // ==========================================

    it("should execute with input, result, and output paths", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Path1",
                }),
            ],
            inputPath: "$.data",
            resultPath: "$.result",
            outputPath: "$.output",
        });

        const inputData = { data: { value: 10 }, other: "data" };
        const [output, nextState] = await state.execute(inputData);

        expect(nextState).toBe("Path1");
        expect(output).toBeDefined();
    });

    // ==========================================
    // Test execution - Edge cases
    // ==========================================

    it("should throw StateError with no match and no default", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Path1",
                }),
            ],
        });

        const inputData = { value: 20 };

        await expect(state.execute(inputData)).rejects.toThrow(StateError);
        await expect(state.execute(inputData)).rejects.toThrow(
            "no choice rule matched and no default"
        );
    });

    it("should execute with missing variable", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.missing",
                    stringEquals: "test",
                    next: "Match",
                }),
            ],
            default: "DefaultPath",
        });

        const inputData = { value: "test" };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("DefaultPath");
    });

    it("should execute with deeply nested variable", async () => {
        const state = new ChoiceState({
            name: "ChoiceState",
            choices: [
                new ChoiceRule({
                    variable: "$.user.profile.settings.notifications",
                    booleanEquals: true,
                    next: "NotificationsOn",
                }),
            ],
        });

        const inputData = { user: { profile: { settings: { notifications: true } } } };
        const [, nextState] = await state.execute(inputData);

        expect(nextState).toBe("NotificationsOn");
    });

    // ==========================================
    // Test serialization
    // ==========================================

    it("should convert simple choice state to dict", () => {
        const state = new ChoiceState({
            name: "SimpleChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "NextState",
                }),
            ],
        });

        const result = state.toDict();

        expect(result.Type).toBe("Choice");
        expect(result.Choices).toBeDefined();
        expect(result.Choices).toHaveLength(1);
        expect(result.Choices[0].Variable).toBe("$.value");
        expect(result.Choices[0].NumericEquals).toBe(10);
        expect(result.Choices[0].Next).toBe("NextState");
    });

    it("should convert choice state with default to dict", () => {
        const state = new ChoiceState({
            name: "ChoiceWithDefault",
            choices: [
                new ChoiceRule({
                    variable: "$.status",
                    stringEquals: "active",
                    next: "ActivePath",
                }),
            ],
            default: "DefaultPath",
        });

        const result = state.toDict();

        expect(result.Type).toBe("Choice");
        expect(result.Default).toBe("DefaultPath");
    });

    it("should convert choice state with all fields to dict", () => {
        const state = new ChoiceState({
            name: "CompleteChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Path1",
                    comment: "Value equals 10",
                }),
            ],
            default: "DefaultPath",
            inputPath: "$.input",
            resultPath: "$.result",
            outputPath: "$.output",
            comment: "Choice state example",
        });

        const result = state.toDict();

        expect(result.Type).toBe("Choice");
        expect(result.Default).toBe("DefaultPath");
        expect(result.InputPath).toBe("$.input");
        expect(result.ResultPath).toBe("$.result");
        expect(result.OutputPath).toBe("$.output");
        expect(result.Comment).toBe("Choice state example");
    });

    it("should convert choice state to JSON", () => {
        const state = new ChoiceState({
            name: "TestChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "NextState",
                }),
            ],
        });

        const jsonStr = state.toJson();
        const result = JSON.parse(jsonStr);

        expect(result.Type).toBe("Choice");
        expect(result.Choices).toHaveLength(1);
    });

    // ==========================================
    // Test helper methods
    // ==========================================

    it("should get all next states", () => {
        const state = new ChoiceState({
            name: "TestChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericLessThan: 10,
                    next: "LessThan10",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Equals10",
                }),
                new ChoiceRule({
                    variable: "$.value",
                    numericGreaterThan: 10,
                    next: "GreaterThan10",
                }),
            ],
            default: "DefaultPath",
        });

        const nextStates = state.getNextStates();

        expect(nextStates).toHaveLength(4);
        expect(nextStates).toContain("LessThan10");
        expect(nextStates).toContain("Equals10");
        expect(nextStates).toContain("GreaterThan10");
        expect(nextStates).toContain("DefaultPath");
    });

    it("should get next states without default", () => {
        const state = new ChoiceState({
            name: "TestChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "Path1",
                }),
            ],
        });

        const nextStates = state.getNextStates();

        expect(nextStates).toHaveLength(1);
        expect(nextStates).toContain("Path1");
    });

    it("should have correct string representation", () => {
        const state = new ChoiceState({
            name: "TestChoice",
            choices: [
                new ChoiceRule({
                    variable: "$.value",
                    numericEquals: 10,
                    next: "NextState",
                }),
            ],
        });

        expect(state.toString()).toContain("ChoiceState");
        expect(state.toString()).toContain("TestChoice");
    });
});
