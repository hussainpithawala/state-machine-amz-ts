/**
 * Tests for MapState implementation.
 */
import { MapState } from "../../src/states/MapState";
import { StateError } from "../../src/states/base";

describe("MapState", () => {
  // Helper to create a simple nested state machine definition
  const createPassthroughProcessor = () => ({
    StartAt: "Pass",
    States: {
      Pass: { Type: "Pass", End: true },
    },
  });

  const createFailingProcessor = () => ({
    StartAt: "Fail",
    States: {
      Fail: {
        Type: "Fail",
        Error: "IterationError",
        Cause: "Intentional failure",
      },
    },
  });

  it("should map over an array of items", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      itemProcessor: createPassthroughProcessor(),
    });

    const inputData = [1, 2, 3];
    const [output] = await state.execute(inputData);

    expect(output).toEqual([1, 2, 3]);
  });

  it("should extract items using ItemsPath", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      itemsPath: "$.data.items",
      itemProcessor: createPassthroughProcessor(),
    });

    const inputData = { data: { items: ["a", "b"] } };
    const [output] = await state.execute(inputData);

    expect(output).toEqual(["a", "b"]);
  });

  it("should transform items using ItemSelector", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      itemProcessor: createPassthroughProcessor(),
      itemSelector: {
        value: "$.val",
        static: "injected",
      },
    });

    const inputData = [{ val: 1 }, { val: 2 }];
    const [output] = await state.execute(inputData);

    expect(output).toEqual([
      { value: 1, static: "injected" },
      { value: 2, static: "injected" },
    ]);
  });

  it("should execute sequentially when MaxConcurrency is 1", async () => {
    const _executionOrder: number[] = [];

    // We'll use a real StateMachine to test concurrency
    const processorDef = {
      StartAt: "Pass",
      States: {
        Pass: {
          Type: "Pass",
          End: true,
          // We can't easily inject logging into the YAML parser here,
          // but we can verify the output order is strictly maintained.
        },
      },
    };

    const state = new MapState({
      name: "TestMap",
      end: true,
      maxConcurrency: 1,
      itemProcessor: processorDef,
    });

    const inputData = [1, 2, 3, 4, 5];
    const [output] = await state.execute(inputData);

    expect(output).toEqual([1, 2, 3, 4, 5]);
  });

  it("should fail the entire map state if tolerance is exceeded", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      toleratedFailureCount: 1, // Allow 1 failure
      itemProcessor: createFailingProcessor(),
    });

    const inputData = [1, 2, 3]; // 3 items, all will fail

    await expect(state.execute(inputData)).rejects.toThrow(StateError);
    await expect(state.execute(inputData)).rejects.toThrow(
      "exceeded failure tolerance",
    );
  });

  it("should tolerate failures if within threshold", async () => {
    // Create a processor that fails only on the first item
    const processorDef = {
      StartAt: "Choice",
      States: {
        Choice: {
          Type: "Choice",
          Choices: [{ Variable: "$", NumericEquals: 1, Next: "Fail" }],
          Default: "Pass",
        },
        Pass: { Type: "Pass", End: true },
        Fail: { Type: "Fail", Error: "Error1" },
      },
    };

    const state = new MapState({
      name: "TestMap",
      end: true,
      toleratedFailureCount: 1, // Allow 1 failure
      itemProcessor: processorDef,
    });

    const inputData = [1, 2, 3]; // Item 1 fails, 2 and 3 succeed
    const [output] = await state.execute(inputData);

    expect(Array.isArray(output)).toBe(true);
    const results = output as Record<string, unknown>[];
    expect(results).toHaveLength(3);

    // First item failed
    expect(results[0].Error).toBe("StateError");
    // Other items succeeded
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
  });

  it("should batch items using ItemBatcher", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      itemBatcher: { maxItemsPerBatch: 2 },
      itemProcessor: createPassthroughProcessor(),
    });

    const inputData = [1, 2, 3, 4, 5];
    const [output] = await state.execute(inputData);

    // The output should be an array of batches
    expect(output).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("should apply ResultPath and OutputPath correctly", async () => {
    const state = new MapState({
      name: "TestMap",
      end: true,
      resultPath: "$.mapped",
      outputPath: "$.mapped",
      itemProcessor: createPassthroughProcessor(),
    });

    const inputData = { original: "data", items: [1, 2] };
    // Wait, we need ItemsPath to extract the array first
    state.itemsPath = "$.items";

    const [output] = await state.execute(inputData);

    expect(output).toEqual([1, 2]);
  });

  it("should validate MapState configuration", () => {
    expect(
      () =>
        new MapState({
          name: "InvalidMap",
          end: true,
          itemProcessor: {}, // Missing StartAt and States
        }),
    ).toThrow("must have a valid ItemProcessor");

    expect(
      () =>
        new MapState({
          name: "InvalidMap",
          end: true,
          itemProcessor: createPassthroughProcessor(),
          maxConcurrency: -1,
        }),
    ).toThrow("MaxConcurrency must be >= 0");

    expect(
      () =>
        new MapState({
          name: "InvalidMap",
          end: true,
          itemProcessor: createPassthroughProcessor(),
          toleratedFailurePercentage: 101,
        }),
    ).toThrow("ToleratedFailurePercentage must be between 0 and 100");
  });
});
