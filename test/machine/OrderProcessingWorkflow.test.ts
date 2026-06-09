/**
 * Integration test for the Order Processing Workflow.
 * Mirrors the Golang test suite (main.go) to test all branching,
 * error handling, and ASL features concurrently.
 */
import * as fs from "fs";
import * as path from "path";
import { StateMachine } from "../../src/machine/StateMachine";
import { PassState } from "../../src/states/PassState";
import {ExecutionContext} from "src/types";

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
// Test Data (Mirroring Go Test Cases)
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
        total: 49.99, // < 50, routes to ProcessSmallOrder
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
        total: 89.99, // >= 50 and < 200, routes to ProcessStandardOrder
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
        total: 2500.0, // > 2000, triggers mock payment failure
        payment_method: "expired_card",
        shipping: { required: true, country: "US" },
        timestamp: Date.now(),
      },
    },
  },
];

// ==========================================
// Test Suite
// ==========================================
describe("Order Processing Workflow (Go Test Equivalence)", () => {
  let stateMachine: StateMachine;
  let mockContext: MockExecutionContext;

  beforeAll(() => {
    const yamlPath = path.resolve(
      ".",
      "./test-workflows/order_processing_workflow.yaml",
    );
    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    stateMachine = StateMachine.fromYaml(yamlContent);

    // Assert structural schema sanity instead of printing state machine info
    expect(stateMachine).toBeDefined();
    expect(stateMachine.comment).toBeDefined();
    expect(stateMachine.startAt).toBeDefined();
    expect(Object.keys(stateMachine.states).length).toBeGreaterThan(0);

    // ======================================================================
    // CRITICAL PATCH: The YAML hardcodes CalculateOrderTotal to 162.00.
    // To test all Choice branches (Small, Standard, Premium), we dynamically
    // patch this state to use the actual input total via Parameters.
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
    mockContext = new MockExecutionContext();

    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:ProcessSmallOrder",
      () => ({ status: "SMALL_PROCESSED" }),
    );
    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:ProcessStandardOrder",
      () => ({ status: "STANDARD_PROCESSED" }),
    );
    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:ProcessPremiumOrder",
      () => ({
        Payload: {
          processedOrder: "PREM-OK",
          processingTime: 150,
          status: "PREMIUM_PROCESSED",
        },
      }),
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
      },
    );

    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:SendNotification",
      () => ({ notified: true, channel: "EMAIL" }),
    );
    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:ProcessRefund",
      () => ({ refunded: true }),
    );
    mockContext.registerHandler(
      "arn:aws:lambda:us-east-1:123456789012:function:SendErrorNotification",
      () => ({ errorNotified: true }),
    );
  });

  // Run all test cases (mirroring Go's concurrent execution)
  it.each(testCases)("should process %s", async (testCase) => {
    const executionContext = { executionContext: mockContext };
    const execResult = await stateMachine.execute(
      testCase.input,
      executionContext,
    );

    // Validate generic execution properties
    expect(execResult.id).toBeDefined();
    expect(execResult.name).toBeDefined();
    expect(execResult.startTime).toBeInstanceOf(Date);
    expect(execResult.output).toBeDefined();
    expect(execResult.history.length).toBeGreaterThan(0);

    if (execResult.endTime) {
      expect(execResult.endTime).toBeInstanceOf(Date);
      expect(execResult.endTime.getTime()).toBeGreaterThanOrEqual(
        execResult.startTime.getTime(),
      );
    }

    // Assertions based on the scenario
    if (testCase.name === "Payment Failure Order") {
      expect(execResult.status).toBe("SUCCEEDED"); // Caught by Catch rule, so machine succeeds
      expect(execResult.error).toBeUndefined(); // Errors caught cleanly shouldn't surface as unhandled executions

      const historyStates = execResult.history.map((h) => h.stateName);
      expect(historyStates).toContain("HandleDeclinedPayment");
      expect(historyStates).toContain("RefundIfNecessary");
      expect(historyStates).toContain("NotifyAndCancel");

      // Negative assertions for paths that should not be evaluated
      expect(historyStates).not.toContain("FinalizeOrder");
    } else {
      expect(execResult.status).toBe("SUCCEEDED");

      const historyStates = execResult.history.map((h) => h.stateName);
      expect(historyStates).toContain("ProcessPayment");
      expect(historyStates).toContain("FinalizeOrder");
      expect(historyStates).not.toContain("HandleDeclinedPayment");

      // Verify Choice state routing
      if (testCase.name === "Digital Order") {
        expect(historyStates).toContain("ProcessSmallOrder");
        expect(historyStates).not.toContain("ProcessStandardOrder");
        expect(historyStates).not.toContain("ProcessPremiumOrder");
      } else if (testCase.name === "Standard Order") {
        expect(historyStates).toContain("ProcessStandardOrder");
        expect(historyStates).not.toContain("ProcessSmallOrder");
        expect(historyStates).not.toContain("ProcessPremiumOrder");
      } else {
        expect(historyStates).toContain("ProcessPremiumOrder");
        expect(historyStates).not.toContain("ProcessSmallOrder");
        expect(historyStates).not.toContain("ProcessStandardOrder");
      }
    }
  });
});
