/**
 * JSON Path Processor implementation for Amazon States Language.
 * Leverages jsonpath-plus for standard JSONPath evaluation.
 */
import { JSONPath } from 'jsonpath-plus';
import { PathProcessor } from './base';

class JSONPathProcessor implements PathProcessor {
    applyInputPath(inputData: any, path?: string): any {
        if (!path) return inputData;
        // wrap: false returns the value directly if single match, undefined if no match, or array if multiple
        return JSONPath({ path, json: inputData, wrap: false });
    }

    applyResultPath(inputData: any, result: any, path?: string): any {
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
            const clonedInput = JSON.parse(JSON.stringify(inputData));
            let current: any = clonedInput;

            for (let i = 0; i < keys.length - 1; i++) {
                // @ts-ignore
                const key : string = keys[i];
                if (current[key] === undefined || current[key] === null) {
                    // Check if next key is a number to decide between array and object
                    const nextKey = keys[i + 1];
                    // @ts-ignore
                    current[key] = /^\d+$/.test(nextKey) ? [] : {};
                }
                current = current[key];
            }

            // @ts-ignore
            const lastKey:string = keys[keys.length - 1];
            current[lastKey] = result;
            return clonedInput;
        }

        throw new Error(`Complex ResultPath '${path}' is not supported in this basic processor.`);
    }

    applyOutputPath(output: any, path?: string): any {
        if (!path) return output;
        return JSONPath({ path, json: output, wrap: false });
    }
}

export default JSONPathProcessor
