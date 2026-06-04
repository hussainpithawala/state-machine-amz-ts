# @hussainpithawala/state-machine-amz-ts

A robust, strictly-typed TypeScript implementation of the **Amazon States Language (ASL)** for building, validating, and executing serverless state machines.

This library mirrors the behavior of AWS Step Functions, providing a powerful engine to orchestrate complex workflows, handle retries, manage parallel/map executions, and route logic conditionally—all locally or in any Node.js environment.

## ✨ Features

- **Full ASL State Support**: `Pass`, `Fail`, `Succeed`, `Wait`, `Choice` (with `And`/`Or`/`Not`), `Task`, `Parallel`, and `Map`.
- **Advanced Task Features**: Native support for `Retry` (with exponential backoff and `MaxDelaySeconds`), `Catch` policies, `TimeoutSeconds`, and `ResultSelector`.
- **Map & Parallel Concurrency**: Execute nested state machines concurrently with configurable `MaxConcurrency`, `ItemBatcher`, and `ToleratedFailure` thresholds.
- **JSONPath Integration**: Powered by `jsonpath-plus` for strict ASL-compliant `InputPath`, `OutputPath`, `ResultPath`, `ItemsPath`, and `ItemSelector` evaluations.
- **Flexible Parsing**: Load state machine definitions directly from JSON strings, YAML files, or native TypeScript objects via `StateFactory`.
- **Strict TypeScript Typing**: Built with `strict: true` and `exactOptionalPropertyTypes`, using `unknown` instead of `any` to guarantee type safety at runtime.
- **Extensible Execution**: Inject custom task handlers (e.g., mocking AWS Lambda) via the `ExecutionContext` interface.

## 🚀 Quick Start
Here is a minimal example of defining and executing a state machine programmatically:
```typescript
import { StateMachine } from '@hussainpithawala/state-machine-amz-ts';
import { PassState } from '@hussainpithawala/state-machine-amz-ts/dist/states/PassState';

// 1. Define the state machine
const sm = new StateMachine({
    name: "HelloWorldMachine",
    startAt: "HelloState",
    states: {
        HelloState: new PassState({
            name: "HelloState",
            result: { message: "Hello, World!" },
            end: true,
        }),
    },
});

// 2. Execute it
async function run() {
    const execution = await sm.execute({ initial: "data" });

    console.log(`Status: ${execution.status}`); // "SUCCEEDED"
    console.log(`Output:`, execution.output);   // { message: "Hello, World!" }
    console.log(`History:`, execution.history.map(h => h.stateName)); // ["HelloState"]
}

run();
```
## 📖 Advanced Examples
### 1. Loading from YAML / JSON
   You can define your workflows in standard ASL JSON or YAML and load them dynamically.
#### workflow.yaml
```yaml
Comment: A simple order processing workflow
StartAt: ValidateOrder
States:
  ValidateOrder:
    Type: Pass
    Result: { "status": "VALIDATED" }
    Next: ProcessOrder
  ProcessOrder:
    Type: Task
    Resource: "arn:aws:lambda:us-east-1:123456789012:function:ProcessOrder"
    End: true
```

### 2. Injecting Custom Task Handlers
   In a real application, you don't want to call actual AWS services during local execution or testing. You can inject custom handlers using an ExecutionContext.
```typescript
import { StateMachine, ExecutionContext } from '@hussainpithawala/state-machine-amz-ts';

// 1. Define a custom execution context
class MockContext implements ExecutionContext {
  getTaskHandler(resource: string) {
    if (resource.includes('ProcessOrder')) {
      return async (_resource: string, inputData: unknown) => {
        console.log('Mock Lambda executing with:', inputData);
        return { orderId: '123', status: 'PROCESSED' };
      };
    }
    return null;
  }
}

// 2. Pass it during execution
const sm = StateMachine.fromYaml(yamlContent);
const execContext = { executionContext: new MockContext() };

const result = await sm.execute({ orderId: 'ORD-999' }, execContext);
console.log(result.output); // { orderId: '123', status: 'PROCESSED' }
```

### 3. Using the Map State
The Map state applies a nested state machine to every element in an array, supporting concurrency and failure tolerance.

```typescript
import { StateMachine } from '@hussainpithawala/state-machine-amz-ts';

const mapWorkflow = {
  StartAt: "ProcessItems",
  States: {
    ProcessItems: {
      Type: "Map",
      ItemsPath: "$.items",
      MaxConcurrency: 2, // Process up to 2 items at a time
      ToleratedFailureCount: 1, // Allow 1 item to fail without failing the whole machine
      ItemProcessor: {
        StartAt: "Validate",
        States: {
          Validate: { Type: "Pass", End: true }
        }
      },
      ResultPath: "$.processedItems",
      Next: "Finish"
    },
    Finish: { Type: "Succeed" }
  }
};

const sm = StateMachine.fromDict(mapWorkflow);
const result = await sm.execute({
  items: [
    { id: 1, valid: true },
    { id: 2, valid: false }, // This one might fail depending on inner logic
    { id: 3, valid: true }
  ]
});
```

## 🏗️ Architecture
### StateMachine: 
The core orchestrator. It validates the state graph (ensuring no orphaned states and valid transitions) and runs the asynchronous while loop that drives execution.
### Execution & StateHistory: 
Immutable-like records that track the lifecycle of a run, including start/end times, status, errors, and a step-by-step history of inputs and outputs.
### StateFactory: 
A registry pattern that dynamically instantiates the correct BaseState subclass based on the "Type" field in the definition.
### JSONPathProcessor: 
A dedicated, isolated class leveraging jsonpath-plus to handle all ASL path evaluations (InputPath, ResultPath, ItemSelector, etc.) without circular dependencies.

## 🛠️ Development & Testing
This project uses a Makefile to streamline development workflows, mirroring standard Go/TS project structures.
```bash
# Install dependencies
make deps

# Run the full test suite
make test

# Run tests with coverage
make test-coverage

# Format, lint, type-check, and test (pre-commit pipeline)
make validate

# Build the library (CJS + ESM via tsup)
make build

# Generate TypeDoc documentation
make docs

```

## 📜 ASL Compliance Notes

### Choice State: 
Multiple comparison operators in a single Choice rule are implicitly ANDed, exactly as specified by AWS.

### Map State Failure Tolerance: 
If ToleratedFailureCount or ToleratedFailurePercentage are explicitly set, they are evaluated independently. If neither is set, the default ASL behavior of 0 tolerated failures is enforced.

### Wait State: 
Strictly enforces that Seconds must be a non-negative integer, and Timestamp must be a valid ISO 8601 string.

## 🤝 Contributing
Contributions are welcome!
Strict TypeScript typing (no any).
Comprehensive Jest test coverage.

## 📄 License  MIT 

© Hussain Pithawala
