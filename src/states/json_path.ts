/**
 * JSON Path Processor implementation for Amazon States Language.
 * Leverages jsonpath-plus for standard JSONPath evaluation.
 */
import { JSONPath } from "jsonpath-plus";
import type { PathProcessor } from "./base"; // 'import type' erases this at runtime, preventing circular dependencies

export class JSONPathProcessor implements PathProcessor {
  applyInputPath(inputData: unknown, path?: string): unknown {
    if (!path) return inputData;
    return JSONPath({ path, json: inputData, wrap: false });
  }

  applyResultPath(inputData: unknown, result: unknown, path?: string): unknown {
    if (!path) {
      return result;
    }

    if (
      typeof inputData !== "object" ||
      inputData === null ||
      Array.isArray(inputData)
    ) {
      throw new Error(`Cannot apply ResultPath '${path}' to non-object input.`);
    }

    if (path.startsWith("$.")) {
      const keys = path.slice(2).split(".");
      const clonedInput = JSON.parse(JSON.stringify(inputData));
      let current: any = clonedInput;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || current[key] === null) {
          const nextKey = keys[i + 1];
          current[key] = /^\d+$/.test(nextKey) ? [] : {};
        }
        current = current[key];
      }

      current[keys[keys.length - 1]] = result;
      return clonedInput;
    }

    throw new Error(
      `Complex ResultPath '${path}' is not supported in this basic processor.`,
    );
  }

  applyOutputPath(output: unknown, path?: string): unknown {
    if (!path) return output;
    return JSONPath({ path, json: output, wrap: false });
  }
}
