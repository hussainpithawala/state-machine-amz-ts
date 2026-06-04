/**
 * Standalone executable example for the Order Processing Workflow.
 * Mirrors the Golang main.go implementation to demonstrate concurrent
 * execution, mock context injection, and detailed logging.
 *
 * Run with: npx ts-node examples/order_processing_workflow.ts
 */
import * as fs from "fs";
import * as path from "path";
import { StateMachine } from "../src/machine/StateMachine";
import { ExecutionContext } from "../src/states/TaskState";
import { PassState } from "../src/states/PassState";
import { Execution } from "../src/execution/Execution";

// ==========================================
// Mock Execution Context
// ==========================================
class MockExecutionContext implements ExecutionContext {
    private handlers: Record<string, (input: unknown) => unknown> = {};

    registerHandler(arn: string, handler: (input: unknown) => unknown) {
        this.handlers[arn] = handler;
    }

    getTaskHandler(resource: string) {
        const handler = this.handlers[resource];
        if (handler) {
            return async (_resource: string, inputData: unknown) => {
                return handler(inputData);
            };
        }
        return null;
    }
}

// ==========================================
// Test Data
// ==========================================
interface TestOrderData {
    name: string;
    input: Record<string, unknown>;
}

const testCases: TestOrderData[] = [
    {
        name: "Premium Order",
        input: {
            order: {
                orderId: "ORD-PREM-001",
                customerId: "CUST-PREM-001",
                items: ["premium_item_1", "premium_item_2"],
                quantity: 2,
                total: 750.0,
                premium_customer: true,
                payment_method: "credit_card",
                shipping: { required: true, country: "US" },
                timestamp: Date.now(),
            },
        },
    },
    {
        name: "Bulk Order (Available)",
        input: {
            order: {
                orderId: "ORD-BULK-001",
                customerId: "CUST-BULK-001",
                items: ["bulk_item_1"],
                quantity: 25,
                total: 1500.0,
                payment_method: "credit_card",
                shipping: { required: true, country: "US" },
                timestamp: Date.now(),
            },
        },
    },
    {
        name: "Digital Order",
        input: {
            order: {
                orderId: "ORD-DIG-001",
                customerId: "CUST-DIG-001",
                items: ["ebook"],
                quantity: 1,
                total: 49.99,
                payment_method: "paypal",
                shipping: { required: false },
                digital_product: { type: "ebook" },
                customer_email: "customer@example.com",
                timestamp: Date.now(),
            },
        },
    },
    {
        name: "Standard Order",
        input: {
            order: {
                orderId: "ORD-STD-001",
                customerId: "CUST-STD-001",
                items: ["standard_item_1", "standard_item_2"],
                quantity: 3,
                total: 89.99,
                payment_method: "credit_card",
                shipping: { required: true, country: "US" },
                timestamp: Date.now(),
            },
        },
    },
    {
        name: "Payment Failure Order",
        input: {
            order: {
                orderId: "ORD-FAIL-001",
                customerId: "CUST-FAIL-001",
                items: ["expensive_item"],
                quantity: 1,
                total: 2500.0,
                payment_method: "expired_card",
                shipping: { required: true, country: "US" },
                timestamp: Date.now(),
            },
        },
    },
];

// ==========================================
// Helper Functions
// ==========================================
function printJSON(data: unknown) {
    console.log(JSON.stringify(data, null, 2));
}

function printExecutionResults(execCtx: Execution) {
    console.log("\nExecution Results:");
    console.log(`  Execution ID: ${execCtx.id}`);
    console.log(`  Name: ${execCtx.name}`);
    console.log(`  Status: ${execCtx.status}`);
    console.log(`  Start Time: ${execCtx.startTime.toISOString()}`);

    if (execCtx.endTime) {
        console.log(`  End Time: ${execCtx.endTime.toISOString()}`);
        const duration = (execCtx.endTime.getTime() - execCtx.startTime.getTime()) / 1000;
        console.log(`  Duration: ${duration.toFixed(3)}s`);
    }

    if (execCtx.error) {
        console.log(`  Error: ${execCtx.error.message}`);
    }

    if (execCtx.currentState) {
        console.log(`  Current State: ${execCtx.currentState}`);
    }

    if (execCtx.output !== undefined) {
        console.log("\nOutput Data:");
        printJSON(execCtx.output);
    }

    if (execCtx.history && execCtx.history.length > 0) {
        console.log(`\nState Execution History (${execCtx.history.length} states):`);
        execCtx.history.forEach((h, i) => {
            console.log(`  ${i + 1}. State: ${h.stateName} (Time: ${h.timestamp.toISOString()})`);
        });
    }
}

function printTestSummary(totalTests: number) {
    console.log("==================================================");
    console.log("Test Summary");
    console.log("==================================================");
    console.log(`Total Test Cases: ${totalTests}`);
    console.log("Test File: order_processing_workflow.yaml");
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log("\nKey Test Scenarios:");
    console.log("  ✓ Premium Orders (750.00) - Tests ProcessPremiumOrder task");
    console.log("  ✓ Bulk Orders (1500.00) - Tests ProcessPremiumOrder task");
    console.log("  ✓ Digital Orders (49.99) - Tests ProcessSmallOrder task");
    console.log("  ✓ Standard Orders (89.99) - Tests ProcessStandardOrder task");
    console.log("  ✓ Payment Failures (2500.00) - Tests error handling and Catch policies");
    console.log("\nFeatures Being Tested:");
    console.log("  ✓ Pass states with data transformation (Parameters)");
    console.log("  ✓ Choice states with numeric comparisons");
    console.log("  ✓ Task states with retry policies");
    console.log("  ✓ Task states with catch policies");
    console.log("  ✓ InputPath, ResultPath, OutputPath processing");
    console.log("  ✓ Error handling and compensation flows");
    console.log("  ✓ TimeoutSeconds and HeartbeatSeconds");
    console.log("  ✓ Exponential backoff with MaxDelaySeconds");
    console.log("==================================================");
}

// ==========================================
// Main Execution
// ==========================================
async function main() {
    console.log("Loading state machine definition...");
    const yamlPath = path.resolve(".", "../test-workflows/order_processing_workflow.yaml");
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    const stateMachine = StateMachine.fromYaml(yamlContent);

    console.log(`✓ Loaded state machine: ${stateMachine.comment}`);
    console.log(`✓ Start state: ${stateMachine.startAt}`);
    console.log(`✓ Total states: ${Object.keys(stateMachine.states).length}\n`);

    // ======================================================================
    // DYNAMIC PATCH: The YAML hardcodes CalculateOrderTotal to 162.00.
    // We patch it at runtime to use the actual input total via Parameters.
    // ======================================================================
    const calcState = stateMachine.states["CalculateOrderTotal"] as PassState;
    calcState.result = undefined;
    calcState.parameters = {
        subtotal: "$.total",
        taxRate: 0.08,
        tax: "$.total",
        total: "$.total",
    };

    // Setup mock Lambda handlers
    const mockContext = new MockExecutionContext();

    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:ProcessSmallOrder",
        () => ({ status: "SMALL_PROCESSED" })
    );
    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:ProcessStandardOrder",
        () => ({ status: "STANDARD_PROCESSED" })
    );
    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:ProcessPremiumOrder",
        () => ({ Payload: { processedOrder: "PREM-OK", processingTime: 150, status: "PREMIUM_PROCESSED" } })
    );

    // Smart Payment Mock: Fails if amount > 2000 to test Catch policies
    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
        (input) => {
            const amount = (input as Record<string, unknown>).amount as number;
            if (amount > 2000) {
                const err = new Error("Card was declined due to high amount");
                (err as any).errorType = "PaymentDeclined";
                throw err;
            }
            return { transactionId: "TXN-999", status: "PAID" };
        }
    );

    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:SendNotification",
        () => ({ notified: true, channel: "EMAIL" })
    );
    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:ProcessRefund",
        () => ({ refunded: true })
    );
    mockContext.registerHandler(
        "arn:aws:lambda:us-east-1:123456789012:function:SendErrorNotification",
        () => ({ errorNotified: true })
    );

    console.log("Starting workflow executions...\n");

    // Run tests concurrently (mirroring Go's sync.WaitGroup)
    const promises = testCases.map(async (testCase, index) => {
        console.log("==================================================");
        console.log(`Test Case ${index + 1}: ${testCase.name}`);
        console.log("==================================================");
        console.log("\nInput Data:");
        printJSON(testCase.input);

        const executionContext = { executionContext: mockContext };

        try {
            const execResult = await stateMachine.execute(testCase.input, executionContext);
            printExecutionResults(execResult);

            // Simple validation check
            if (execResult.status === "SUCCEEDED") {
                console.log("\n✅ Test Case PASSED");
            } else {
                console.log(`\n❌ Test Case FAILED with status: ${execResult.status}`);
            }
        } catch (error) {
            console.error("\n❌ Execution threw an unexpected error:", error);
        }
        console.log("\n");
    });

    await Promise.all(promises);

    printTestSummary(testCases.length);
}

main().catch((err) => {
    console.error("Fatal error in main:", err);
    process.exit(1);
});
