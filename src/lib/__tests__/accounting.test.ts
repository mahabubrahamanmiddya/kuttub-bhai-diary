import { describe, it, expect } from "vitest";
import {
  calculateCustomerSummary,
  calculateSupplierSummary,
  buildCustomerLedger,
  buildSupplierLedger,
  calculateOverallSummary,
  calculateTodaySummary,
} from "../accounting";
import { Customer, Supplier, Transaction } from "@/types/database";

describe("Business Hisab-Kitab Accounting Logic", () => {
  const dummyCustomer: Customer = {
    id: "cust-1",
    business_id: "biz-1",
    name: "Rahul Sharma",
    phone: "9876543210",
    address: "Shop 12, Main Market",
    notes: "Old trusted client",
    opening_balance: 0,
    opening_balance_type: "receivable",
    is_deleted: false,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };

  const dummySupplier: Supplier = {
    id: "supp-1",
    business_id: "biz-1",
    name: "ABC Suppliers",
    phone: "9123456780",
    address: "Wholesale Hub",
    notes: "Primary raw material vendor",
    opening_balance: 0,
    opening_balance_type: "payable",
    is_deleted: false,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };

  // Test 1: Customer buys on credit
  it("Scenario 1: Customer buys on credit increases receivable and total purchases", () => {
    const txn: Transaction = {
      id: "t1",
      business_id: "biz-1",
      transaction_type: "sale",
      amount: 15000,
      transaction_date: "2026-11-10T11:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: "General Sales",
      payment_method: "Other",
      description: "Credit sale of 10 items",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-10T11:00:00Z",
      updated_at: "2026-11-10T11:00:00Z",
    };

    const summary = calculateCustomerSummary(dummyCustomer, [txn]);
    expect(summary.total_purchases).toBe(15000);
    expect(summary.total_payments).toBe(0);
    expect(summary.current_balance).toBe(15000); // Lene hain: 15,000
  });

  // Test 2: Customer pays later
  it("Scenario 2: Customer payment reduces receivable without increasing revenue again", () => {
    const saleTxn: Transaction = {
      id: "t1",
      business_id: "biz-1",
      transaction_type: "sale",
      amount: 15000,
      transaction_date: "2026-11-10T11:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: null,
      payment_method: "Other",
      description: "Credit sale",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-10T11:00:00Z",
      updated_at: "2026-11-10T11:00:00Z",
    };

    const paymentTxn: Transaction = {
      id: "t2",
      business_id: "biz-1",
      transaction_type: "customer_payment",
      amount: 10000,
      transaction_date: "2026-11-12T15:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: null,
      payment_method: "UPI",
      description: "UPI payment received",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-12T15:00:00Z",
      updated_at: "2026-11-12T15:00:00Z",
    };

    const summary = calculateCustomerSummary(dummyCustomer, [saleTxn, paymentTxn]);
    expect(summary.total_purchases).toBe(15000);
    expect(summary.total_payments).toBe(10000);
    expect(summary.current_balance).toBe(5000); // Remaining: 5,000

    const overall = calculateOverallSummary([summary], [], [saleTxn, paymentTxn]);
    // Revenue should ONLY be 15,000 (from sale), NOT 15,000 + 10,000 = 25,000!
    expect(overall.total_sales).toBe(15000);
    expect(overall.cash_in_hand).toBe(10000); // 10,000 received in cash/bank
  });

  // Test 3 & 4: Supplier purchase on credit and payment later
  it("Scenario 3 & 4: Supplier purchase on credit increases payable, payment reduces payable", () => {
    const purchaseTxn: Transaction = {
      id: "p1",
      business_id: "biz-1",
      transaction_type: "purchase",
      amount: 25000,
      transaction_date: "2026-11-05T09:00:00Z",
      customer_id: null,
      supplier_id: "supp-1",
      category_id: null,
      category_name: "Raw Material",
      payment_method: "Other",
      description: "Bulk raw material purchase",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-05T09:00:00Z",
      updated_at: "2026-11-05T09:00:00Z",
    };

    const paymentTxn: Transaction = {
      id: "p2",
      business_id: "biz-1",
      transaction_type: "supplier_payment",
      amount: 15000,
      transaction_date: "2026-11-08T14:00:00Z",
      customer_id: null,
      supplier_id: "supp-1",
      category_id: null,
      category_name: null,
      payment_method: "Bank Transfer",
      description: "NEFT Payment to ABC Suppliers",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-08T14:00:00Z",
      updated_at: "2026-11-08T14:00:00Z",
    };

    const summary = calculateSupplierSummary(dummySupplier, [purchaseTxn, paymentTxn]);
    expect(summary.total_purchases).toBe(25000);
    expect(summary.total_payments).toBe(15000);
    expect(summary.current_balance).toBe(10000); // We still owe 10,000

    const overall = calculateOverallSummary([], [summary], [purchaseTxn, paymentTxn]);
    // Cost must be 25,000, NOT 25,000 + 15,000 = 40,000!
    expect(overall.total_expenses).toBe(25000);
    expect(overall.cash_in_hand).toBe(-15000); // 15,000 paid out
  });

  // Test 5 & 6: Cash sale and direct business expense
  it("Scenario 5 & 6: Direct cash income and business expense recognized correctly", () => {
    const cashIncomeTxn: Transaction = {
      id: "inc1",
      business_id: "biz-1",
      transaction_type: "income",
      amount: 18500,
      transaction_date: "2026-11-17T10:00:00Z",
      customer_id: null,
      supplier_id: null,
      category_id: null,
      category_name: "Direct Cash Sales",
      payment_method: "Cash",
      description: "Counter sales",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-17T10:00:00Z",
      updated_at: "2026-11-17T10:00:00Z",
    };

    const expenseTxn: Transaction = {
      id: "exp1",
      business_id: "biz-1",
      transaction_type: "expense",
      amount: 4200,
      transaction_date: "2026-11-17T11:00:00Z",
      customer_id: null,
      supplier_id: null,
      category_id: null,
      category_name: "Rent (किराया)",
      payment_method: "Cash",
      description: "Monthly shop rent contribution",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-17T11:00:00Z",
      updated_at: "2026-11-17T11:00:00Z",
    };

    const overall = calculateOverallSummary([], [], [cashIncomeTxn, expenseTxn]);
    expect(overall.total_sales).toBe(18500);
    expect(overall.total_expenses).toBe(4200);
    expect(overall.net_profit).toBe(14300); // 18,500 - 4,200 = 14,300

    const today = calculateTodaySummary([cashIncomeTxn, expenseTxn], new Date("2026-11-17T12:00:00Z"));
    expect(today.income).toBe(18500);
    expect(today.expense).toBe(4200);
    expect(today.net).toBe(14300);
  });

  // Test 7: Multiple transactions on same customer
  it("Scenario 7: Multiple transactions on customer produce exact running ledger", () => {
    const txns: Transaction[] = [
      {
        id: "t1",
        business_id: "biz-1",
        transaction_type: "sale",
        amount: 8000,
        transaction_date: "2026-11-12T10:00:00Z",
        customer_id: "cust-1",
        supplier_id: null,
        category_id: null,
        category_name: null,
        payment_method: "Other",
        description: "Purchase 1",
        attachment_url: null,
        is_deleted: false,
        created_at: "2026-11-12T10:00:00Z",
        updated_at: "2026-11-12T10:00:00Z",
      },
      {
        id: "t2",
        business_id: "biz-1",
        transaction_type: "customer_payment",
        amount: 5000,
        transaction_date: "2026-11-15T10:00:00Z",
        customer_id: "cust-1",
        supplier_id: null,
        category_id: null,
        category_name: null,
        payment_method: "Cash",
        description: "Payment received",
        attachment_url: null,
        is_deleted: false,
        created_at: "2026-11-15T10:00:00Z",
        updated_at: "2026-11-15T10:00:00Z",
      },
      {
        id: "t3",
        business_id: "biz-1",
        transaction_type: "sale",
        amount: 7000,
        transaction_date: "2026-11-17T10:00:00Z",
        customer_id: "cust-1",
        supplier_id: null,
        category_id: null,
        category_name: null,
        payment_method: "Other",
        description: "Purchase 2",
        attachment_url: null,
        is_deleted: false,
        created_at: "2026-11-17T10:00:00Z",
        updated_at: "2026-11-17T10:00:00Z",
      },
    ];

    const ledger = buildCustomerLedger(dummyCustomer, txns);
    expect(ledger.entries.length).toBe(3);
    expect(ledger.entries[0].balance).toBe(8000);  // After +8000
    expect(ledger.entries[1].balance).toBe(3000);  // After -5000
    expect(ledger.entries[2].balance).toBe(10000); // After +7000
    expect(ledger.totalDebit).toBe(15000);
    expect(ledger.totalCredit).toBe(5000);
    expect(ledger.finalBalance).toBe(10000);
  });

  // Test 8: Opening balance handling
  it("Scenario 8: Opening balance initializes ledger properly", () => {
    const custWithOpening: Customer = {
      ...dummyCustomer,
      opening_balance: 5000,
      opening_balance_type: "receivable",
    };

    const paymentTxn: Transaction = {
      id: "t1",
      business_id: "biz-1",
      transaction_type: "customer_payment",
      amount: 2000,
      transaction_date: "2026-11-10T10:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: null,
      payment_method: "Cash",
      description: "Payment",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    };

    const summary = calculateCustomerSummary(custWithOpening, [paymentTxn]);
    expect(summary.current_balance).toBe(3000); // 5000 - 2000 = 3000

    const ledger = buildCustomerLedger(custWithOpening, [paymentTxn]);
    expect(ledger.entries[0].description).toContain("Opening Balance");
    expect(ledger.entries[0].balance).toBe(5000);
    expect(ledger.entries[1].balance).toBe(3000);
  });

  // Test 9 & 10: Deleting / Reversing transaction
  it("Scenario 9 & 10: Soft-deleted transactions are completely ignored from ledger and summaries", () => {
    const activeTxn: Transaction = {
      id: "t1",
      business_id: "biz-1",
      transaction_type: "sale",
      amount: 10000,
      transaction_date: "2026-11-10T10:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: null,
      payment_method: "Other",
      description: "Valid Sale",
      attachment_url: null,
      is_deleted: false,
      created_at: "2026-11-10T10:00:00Z",
      updated_at: "2026-11-10T10:00:00Z",
    };

    const deletedTxn: Transaction = {
      id: "t2",
      business_id: "biz-1",
      transaction_type: "customer_payment",
      amount: 5000,
      transaction_date: "2026-11-11T10:00:00Z",
      customer_id: "cust-1",
      supplier_id: null,
      category_id: null,
      category_name: null,
      payment_method: "Other",
      description: "Mistaken payment",
      attachment_url: null,
      is_deleted: true, // Marked as soft-deleted!
      created_at: "2026-11-11T10:00:00Z",
      updated_at: "2026-11-11T10:00:00Z",
    };

    const summary = calculateCustomerSummary(dummyCustomer, [activeTxn, deletedTxn]);
    expect(summary.total_purchases).toBe(10000);
    expect(summary.total_payments).toBe(0); // Deleted txn ignored
    expect(summary.current_balance).toBe(10000);
  });
});
