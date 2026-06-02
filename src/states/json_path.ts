/**
 * JSON Path Processor implementation for Amazon States Language.
 * Leverages jsonpath-plus for standard JSONPath evaluation.
 */
import { JSONPath } from 'jsonpath-plus';
import { PathProcessor } from './base';

class JSONPathProcessor implements PathProcessor {
    applyInputPath(inputData: unknown, path?: string): unknown {
        if (!path) return inputData;
        // wrap: false returns the value directly if single match, undefined if no match, or array if multiple
        return JSONPath({ path, json: inputData as Record<string, unknown>, wrap: false });
    }

    applyResultPath(inputData: unknown, result: unknown, path?: string): unknown {
        if (!path) {
            // ASL default: if ResultPath is omitted, the result replaces the input entirely
            return result;
        }

        // ASL Spec: If input is not a JSON object (e.g., primitive or array) and ResultPath is specified, it's a runtime error.
        if (typeof inputData !== 'object' || inputData === null || Array.isArray(inputData)) {
            throw new Error(`Cannot apply ResultPath '${path}' to non-object input.`);
        }

        // For ASL, ResultPath is typically a simple path like "$.result" or "$.data.field"
        if (path.startsWith('$.')) {
            const keys: string[] = path.slice(2).split('.');
            // Deep clone to avoid mutating the original input unexpectedly
            const clonedInput = JSON.parse(JSON.stringify(inputData)) as Record<string, unknown>;
            let current = clonedInput;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i]!;
                if (current[key] === undefined || current[key] === null) {
                    // Check if next key is a number to decide between array and object
                    const nextKey = keys[i + 1]!;
                    current[key] = /^\d+$/.test(nextKey) ? [] : {};
                }
                current = current[key] as Record<string, unknown>;
            }

            const lastKey = keys[keys.length - 1]!;
            current[lastKey] = result;
            return clonedInput;
        }

        throw new Error(`Complex ResultPath '${path}' is not supported in this basic processor.`);
    }

    applyOutputPath(output: unknown, path?: string): unknown {
        if (!path) return output;
        return JSONPath({ path, json: output as Record<string, unknown>, wrap: false });
    }
}

export default JSONPathProcessor
