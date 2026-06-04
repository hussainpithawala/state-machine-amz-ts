/**
 * Tests for StateFactory implementation.
 */
import { StateFactory } from "../../src/factory/StateFactory";
import { PassState } from "../../src/states/PassState";
import { FailState } from "../../src/states/FailState";
import { SucceedState } from "../../src/states/SucceedState";
import { TaskState } from "../../src/states/TaskState";
import { ChoiceState } from "../../src/states/ChoiceState";

describe("StateFactory", () => {
  let factory: StateFactory;

  beforeEach(() => {
    factory = new StateFactory();
  });

  it("should initialize with default creators", () => {
    // We can't easily check the private map, but we can verify it creates known types
    expect(() =>
      factory.createState("Test", { Type: "Pass", End: true }),
    ).not.toThrow();
    expect(() =>
      factory.createState("Test", { Type: "Fail", Error: "E" }),
    ).not.toThrow();
    expect(() =>
      factory.createState("Test", { Type: "Succeed" }),
    ).not.toThrow();
    expect(() =>
      factory.createState("Test", { Type: "Task", Resource: "R", End: true }),
    ).not.toThrow();
    expect(() =>
      factory.createState("Test", {
        Type: "Choice",
        Choices: [],
        Default: "D",
      }),
    ).not.toThrow();
  });

  it("should create PassState", () => {
    const data = {
      Type: "Pass",
      Result: { foo: "bar" },
      Next: "NextState",
      Comment: "Test comment",
    };
    const state = factory.createState("MyPass", data);

    expect(state).toBeInstanceOf(PassState);
    expect(state.name).toBe("MyPass");
    expect((state as PassState).result).toEqual({ foo: "bar" });
    expect(state.nextState).toBe("NextState");
    expect(state.comment).toBe("Test comment");
  });

  it("should create FailState", () => {
    const data = {
      Type: "Fail",
      Error: "CustomError",
      Cause: "Something went wrong",
    };
    const state = factory.createState("MyFail", data);

    expect(state).toBeInstanceOf(FailState);
    expect(state.name).toBe("MyFail");
    expect((state as FailState).error).toBe("CustomError");
    expect((state as FailState).cause).toBe("Something went wrong");
  });

  it("should create SucceedState", () => {
    const data = { Type: "Succeed", Comment: "I succeeded" };
    const state = factory.createState("MySucceed", data);

    expect(state).toBeInstanceOf(SucceedState);
    expect(state.name).toBe("MySucceed");
    expect(state.comment).toBe("I succeeded");
  });

  it("should create TaskState", () => {
    const data = {
      Type: "Task",
      Resource: "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
      Next: "FinalState",
      Retry: [
        { ErrorEquals: ["States.Timeout"], IntervalSeconds: 3, MaxAttempts: 2 },
      ],
      Catch: [{ ErrorEquals: ["States.ALL"], Next: "ErrorHandler" }],
    };
    const state = factory.createState("MyTask", data);

    expect(state).toBeInstanceOf(TaskState);
    expect(state.name).toBe("MyTask");
    expect((state as TaskState).resource).toBe(
      "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
    );
    expect((state as TaskState).retry).toHaveLength(1);
    expect((state as TaskState).retry[0].errorEquals).toEqual([
      "States.Timeout",
    ]);
    expect((state as TaskState).catch).toHaveLength(1);
    expect((state as TaskState).catch[0].nextState).toBe("ErrorHandler");
  });

  it("should create ChoiceState", () => {
    const data = {
      Type: "Choice",
      Choices: [
        { Variable: "$.value", NumericEquals: 1, Next: "One" },
        {
          And: [
            { Variable: "$.value", NumericGreaterThan: 1 },
            { Variable: "$.value", NumericLessThan: 10 },
          ],
          Next: "Middle",
        },
        { Not: { Variable: "$.flag", BooleanEquals: true }, Next: "FlagFalse" },
      ],
      Default: "DefaultState",
    };
    const state = factory.createState("MyChoice", data);

    expect(state).toBeInstanceOf(ChoiceState);
    expect(state.name).toBe("MyChoice");

    const choiceState = state as ChoiceState;
    expect(choiceState.choices).toHaveLength(3);
    expect(choiceState.choices[0].variable).toBe("$.value");
    expect(choiceState.choices[0].numericEquals).toBe(1);
    expect(choiceState.choices[0].next).toBe("One");
    expect(choiceState.choices[1].andRules).toHaveLength(2);
    expect(choiceState.choices[2].notRule).toBeDefined();
    expect(choiceState.choices[2].notRule!.variable).toBe("$.flag");
    expect(choiceState.default).toBe("DefaultState");
  });

  it("should throw if Type is missing", () => {
    expect(() => factory.createState("NoType", {})).toThrow(
      "missing Type field",
    );
  });

  it("should throw if Type is unknown", () => {
    expect(() => factory.createState("Unknown", { Type: "Unknown" })).toThrow(
      "Unknown state type: Unknown",
    );
  });

  it("should register custom creator", () => {
    factory.registerCreator("Custom", (name) => {
      // Returning a mock object for testing
      return { name, stateType: "Custom" } as any;
    });

    const state = factory.createState("MyCustom", { Type: "Custom" });
    expect((state as any).name).toBe("MyCustom");
  });
});
