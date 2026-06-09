/**
 * Wait state implementation for Amazon States Language.
 *
 * Causes the interpreter to delay the machine from continuing for a specified time.
 */
import {
  BaseState,
  StateError,
  getPathProcessor,
  ValidateOptions,
} from "./base";

export interface WaitStateConfig {
  name: string;
  seconds?: number | undefined;
  secondsPath?: string | undefined;
  timestamp?: string | undefined;
  timestampPath?: string | undefined;
  nextState?: string | undefined;
  end?: boolean | undefined;
  inputPath?: string | undefined;
  outputPath?: string | undefined;
  comment?: string | undefined;
}

export class WaitState extends BaseState {
  seconds?: number | undefined;
  secondsPath?: string | undefined;
  timestamp?: string | undefined;
  timestampPath?: string | undefined
  ;

  constructor(config: WaitStateConfig) {
    super();
    this.name = config.name;
    this.type = "Wait";
    this.seconds = config.seconds;
    this.secondsPath = config.secondsPath;
    this.timestamp = config.timestamp;
    this.timestampPath = config.timestampPath;
    this.nextState = config.nextState;
    this.end = config.end ?? false;
    this.inputPath = config.inputPath;
    this.outputPath = config.outputPath;
    this.comment = config.comment;

    this.validate();
  }

  override validate(options?: ValidateOptions): void {
    super.validate({ ...options, skipType: true });

    const hasSeconds = this.seconds !== undefined;
    const hasSecondsPath = this.secondsPath !== undefined;
    const hasTimestamp = this.timestamp !== undefined;
    const hasTimestampPath = this.timestampPath !== undefined;

    const count = [
      hasSeconds,
      hasSecondsPath,
      hasTimestamp,
      hasTimestampPath,
    ].filter(Boolean).length;
    if (count !== 1) {
      throw new Error(
        `Wait state '${this.name}' must contain exactly one of Seconds, SecondsPath, Timestamp, or TimestampPath`,
      );
    }

    if (hasSeconds && (this.seconds! < 0 || !Number.isInteger(this.seconds!))) {
      throw new Error(
        `Wait state '${this.name}' Seconds must be a non-negative integer`,
      );
    }
  }

  async execute(
    inputData: unknown,
    context?: Record<string, unknown>,
  ): Promise<[unknown, string | undefined]> {
    if (!context) context = {};
    const processor = this._pathProcessor || getPathProcessor();

    try {
      // 1. Apply InputPath
      const processedInput = processor.applyInputPath(
        inputData,
        this.inputPath,
      );

      // 2. Determine wait duration
      let waitMs = 0;
      const now = Date.now();

      if (this.seconds !== undefined) {
        waitMs = this.seconds * 1000;
      } else if (this.secondsPath !== undefined) {
        const secondsVal = processor.applyInputPath(
          processedInput,
          this.secondsPath,
        );
        if (
          typeof secondsVal !== "number" ||
          secondsVal < 0 ||
          !Number.isInteger(secondsVal)
        ) {
          throw new StateError(
            `SecondsPath '${this.secondsPath}' did not resolve to a non-negative integer`,
            this.name,
            "States.Runtime",
          );
        }
        waitMs = secondsVal * 1000;
      } else if (this.timestamp !== undefined) {
        const targetTime = new Date(this.timestamp).getTime();
        if (isNaN(targetTime)) {
          throw new StateError(
            `Timestamp '${this.timestamp}' is not a valid ISO 8601 string`,
            this.name,
            "States.Runtime",
          );
        }
        waitMs = Math.max(0, targetTime - now);
      } else if (this.timestampPath !== undefined) {
        const timestampVal = processor.applyInputPath(
          processedInput,
          this.timestampPath,
        );
        if (typeof timestampVal !== "string") {
          throw new StateError(
            `TimestampPath '${this.timestampPath}' did not resolve to a string`,
            this.name,
            "States.Runtime",
          );
        }
        const targetTime = new Date(timestampVal).getTime();
        if (isNaN(targetTime)) {
          throw new StateError(
            `Timestamp resolved from '${this.timestampPath}' ('${timestampVal}') is not a valid ISO 8601 string`,
            this.name,
            "States.Runtime",
          );
        }
        waitMs = Math.max(0, targetTime - now);
      }

      // 3. Wait
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      // 4. Apply OutputPath (Wait state copies its input through to its output)
      const finalOutput = processor.applyOutputPath(
        processedInput,
        this.outputPath,
      );

      return [finalOutput, this.nextState];
    } catch (e) {
      if (e instanceof StateError) throw e;
      throw new StateError(
        `Wait state execution failed: ${e instanceof Error ? e.message : String(e)}`,
        this.name,
        "States.Runtime",
      );
    }
  }

  override toDict(): Record<string, unknown> {
    const result = super.toDict() as Record<string, unknown>;

    if (this.seconds !== undefined) result.Seconds = this.seconds;
    if (this.secondsPath !== undefined) result.SecondsPath = this.secondsPath;
    if (this.timestamp !== undefined) result.Timestamp = this.timestamp;
    if (this.timestampPath !== undefined)
      result.TimestampPath = this.timestampPath;

    return result;
  }
}
