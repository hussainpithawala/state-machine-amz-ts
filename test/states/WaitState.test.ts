/**
 * Tests for WaitState implementation.
 */
import { WaitState } from "../../src/states/WaitState";
import { StateError } from "../../src/states/base";

describe("WaitState", () => {
  it("should wait for a specified number of seconds", async () => {
    const start = Date.now();
    const state = new WaitState({
      name: "TestWait",
      seconds: 1, // 1 second (ASL requires non-negative integers)
      end: true,
    });

    const [output, nextState] = await state.execute({ data: "test" });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(900); // Allow slight timing variance
    expect(output).toEqual({ data: "test" });
    expect(nextState).toBeUndefined();
  });

  it("should wait using SecondsPath", async () => {
    const start = Date.now();
    const state = new WaitState({
      name: "TestWait",
      secondsPath: "$.delay",
      end: true,
    });

    // Provide an integer value for the delay
    const [output] = await state.execute({ delay: 1, data: "test" });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(900);
    expect(output).toEqual({ delay: 1, data: "test" });
  });

  it("should wait until a specific Timestamp", async () => {
    const futureTime = new Date(Date.now() + 500).toISOString();
    const start = Date.now();

    const state = new WaitState({
      name: "TestWait",
      timestamp: futureTime,
      end: true,
    });

    const [output] = await state.execute({ data: "test" });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(400);
    expect(output).toEqual({ data: "test" });
  });

  it("should wait using TimestampPath", async () => {
    const futureTime = new Date(Date.now() + 500).toISOString();
    const start = Date.now();

    const state = new WaitState({
      name: "TestWait",
      timestampPath: "$.targetTime",
      end: true,
    });

    const [output] = await state.execute({ targetTime: futureTime, data: "test" });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(400);
    expect(output).toEqual({ targetTime: futureTime, data: "test" });
  });

  it("should apply InputPath and OutputPath", async () => {
    const state = new WaitState({
      name: "TestWait",
      seconds: 0, // 0 seconds is a valid non-negative integer for instant testing
      inputPath: "$.payload",
      outputPath: "$.value",
      end: true,
    });

    const [output] = await state.execute({ payload: { value: "extracted" }, other: "ignored" });
    expect(output).toBe("extracted");
  });

  it("should throw if multiple time fields are provided", () => {
    expect(() => new WaitState({
      name: "InvalidWait",
      seconds: 10,
      timestamp: "2024-01-01T00:00:00Z",
      end: true,
    })).toThrow("must contain exactly one of Seconds, SecondsPath, Timestamp, or TimestampPath");
  });

  it("should throw if no time field is provided", () => {
    expect(() => new WaitState({
      name: "InvalidWait",
      end: true,
    })).toThrow("must contain exactly one of Seconds, SecondsPath, Timestamp, or TimestampPath");
  });

  it("should throw if Seconds is negative", () => {
    expect(() => new WaitState({
      name: "InvalidWait",
      seconds: -5,
      end: true,
    })).toThrow("Seconds must be a non-negative integer");
  });

  it("should throw if Seconds is not an integer", () => {
    expect(() => new WaitState({
      name: "InvalidWait",
      seconds: 0.5,
      end: true,
    })).toThrow("Seconds must be a non-negative integer");
  });

  it("should throw if SecondsPath does not resolve to a non-negative integer", async () => {
    const state = new WaitState({
      name: "InvalidWait",
      secondsPath: "$.delay",
      end: true,
    });

    await expect(state.execute({ delay: -5 })).rejects.toThrow(StateError);
    await expect(state.execute({ delay: 0.5 })).rejects.toThrow(StateError);
    await expect(state.execute({ delay: "not a number" })).rejects.toThrow(StateError);
  });

  it("should throw if Timestamp is invalid", async () => {
    const state = new WaitState({
      name: "InvalidWait",
      timestamp: "not-a-valid-timestamp",
      end: true,
    });

    await expect(state.execute({})).rejects.toThrow(StateError);
  });

  it("should throw if TimestampPath does not resolve to a valid string", async () => {
    const state = new WaitState({
      name: "InvalidWait",
      timestampPath: "$.time",
      end: true,
    });

    await expect(state.execute({ time: 12345 })).rejects.toThrow(StateError);
    await expect(state.execute({ time: "invalid-date" })).rejects.toThrow(StateError);
  });

  it("should serialize to dict correctly", () => {
    const state = new WaitState({
      name: "TestWait",
      seconds: 10,
      nextState: "NextState",
      comment: "Wait 10 seconds",
    });

    const dict = state.toDict();
    expect(dict.Type).toBe("Wait");
    expect(dict.Seconds).toBe(10);
    expect(dict.Next).toBe("NextState");
    expect(dict.Comment).toBe("Wait 10 seconds");
  });
});
