/**
 * Integration test for the Order Processing Workflow.
 * Loads the YAML definition and executes it with mock Lambda handlers.
 */
import * as fs from "fs";
import * as path from "path";
import { StateMachine } from "../../src/machine/StateMachine";
import { ExecutionContext } from "../../src/states/TaskState";

/**
 * Mock Execution Context to intercept Task states and route them
 * to our local mock functions instead of actual AWS Lambdas.
 */
class MockExecutionContext implements ExecutionContext {
    private handlers: Record<string, (input: unknown) => unknown> = {};

    registerHandler(arn: string, handler: (input: unknown) => unknown) {
        this.handlers[arn] = handler;
    }

    getTaskHandler(resource: string) {
        const handler = this.handlers[resource];
        if (handler) {
            // TaskState passes the expanded Parameters as 'inputData' to the handler
            return async (_resource: string, inputData: unknown) => {
                return handler(inputData);
            };
        }
        return null;
    }
}

describe("Order Processing Workflow (YAML)", () => {
    let stateMachine: StateMachine;
    let mockContext: MockExecutionContext;

    beforeAll(() => {
        // 1. Load the YAML definition
        const yamlPath = path.resolve(".","./test-workflows/order_processing_workflow.yaml");
        const yamlContent = fs.readFileSync(yamlPath, "utf-8");
        stateMachine = StateMachine.fromYaml(yamlContent);

        // 2. Setup mock Lambda handlers
        mockContext = new MockExecutionContext();

        mockContext.registerHandler(
            "arn:aws:lambda:us-east-1:123456789012:function:ProcessStandardOrder",
            (input) => ({ status: "PROCESSED", orderId: (input as Record<string, unknown>).orderId })
        );

        mockContext.registerHandler(
            "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
            () => ({ transactionId: "TXN-999", status: "PAID" })
        );

        mockContext.registerHandler(
            "arn:aws:lambda:us-east-1:123456789012:function:SendNotification",
            () => ({ notified: true, channel: "EMAIL" })
        );

        // Register fallbacks for other branches just in case
        mockContext.registerHandler("arn:aws:lambda:us-east-1:123456789012:function:ProcessSmallOrder", () => ({ status: "SMALL_PROCESSED" }));
        mockContext.registerHandler("arn:aws:lambda:us-east-1:123456789012:function:ProcessPremiumOrder", () => ({ status: "PREMIUM_PROCESSED" }));
        mockContext.registerHandler("arn:aws:lambda:us-east-1:123456789012:function:ProcessRefund", () => ({ refunded: true }));
        mockContext.registerHandler("arn:aws:lambda:us-east-1:123456789012:function:SendErrorNotification", () => ({ errorNotified: true }));
    });

    it("should successfully process a standard order (total between 50 and 200)", async () => {
        const inputData = {
            order: {
                orderId: "ORD-123",
                customerId: "CUST-456",
                items: [{ sku: "ITEM-1", qty: 2 }],
                timestamp: "2024-01-01T00:00:00Z"
            }
        };

        // Inject the mock context using the special key expected by TaskState
        const executionContext = {
            executionContext: mockContext
        };

        const execResult = await stateMachine.execute(inputData, executionContext);

        // 1. Verify the execution succeeded
        expect(execResult.status).toBe("SUCCEEDED");
        expect(execResult.output).toBeDefined();

        const output = execResult.output as Record<string, unknown>;

        // 2. Verify the ASL "Gotcha":
        // Because SendSuccessNotification lacks a ResultPath, its output
        // completely overwrites the entire workflow context!
        expect(output.notified).toBe(true);
        expect(output.channel).toBe("EMAIL");

        // Note: If you want to preserve the workflow context (like $.finalization, $.payment, etc.),
        // you must add `ResultPath: $.notification` to the SendSuccessNotification state in your YAML.
    });

    it("should correctly record state history for the happy path", async () => {
        const inputData = { order: { orderId: "ORD-999", customerId: "C1", items: [], timestamp: "now" } };
        const execResult = await stateMachine.execute(inputData, { executionContext: mockContext });

        // Verify the exact path taken through the state machine
        const historyStates = execResult.history.map(h => h.stateName);

        expect(historyStates).toEqual([
            "ValidateOrder",
            "CalculateOrderTotal",
            "CheckOrderAmount",
            "ProcessStandardOrder", // Routed here because total is 162.00
            "ProcessPayment",
            "FinalizeOrder",
            "SendSuccessNotification"
        ]);
    });
});
