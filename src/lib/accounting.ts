import { Customer, Supplier, Transaction, CustomerSummary, SupplierSummary, OverallSummary, DailySummary } from "@/types/database";

/**
 * Calculates a customer's total purchases, total payments, and current running balance.
 *
 * Balance convention for customers:
 * - positive (> 0): Customer owes money to business ("Lene hain" / Receivable)
 * - negative (< 0): Business owes money to customer / Advance credit ("Dene hain" / Advance)
 * - zero (= 0): Fully settled ("Hisaab Barabar")
 */
export function calculateCustomerSummary(
  customer: Customer,
  transactions: Transaction[]
): CustomerSummary {
  // Only consider active transactions for this customer
  const customerTxns = transactions.filter(
    (t) => !t.is_deleted && t.customer_id === customer.id
  );

  let totalPurchases = 0;
  let totalPayments = 0;
  let lastTransactionDate: string | null = null;

  // Initial balance from opening balance
  const openingReceivable =
    customer.opening_balance_type === "receivable"
      ? Number(customer.opening_balance) || 0
      : -(Number(customer.opening_balance) || 0);

  // Sort chronologically to track last transaction date
  for (const txn of customerTxns) {
    const amount = Number(txn.amount) || 0;

    if (txn.transaction_type === "sale") {
      // Credit sale increases customer dues
      totalPurchases += amount;
    } else if (txn.transaction_type === "customer_payment") {
      // Payment clears dues
      totalPayments += amount;
    } else if (txn.transaction_type === "income") {
      // Direct cash sale tagged to customer
      totalPurchases += amount;
      totalPayments += amount;
    }

    if (!lastTransactionDate || new Date(txn.transaction_date) > new Date(lastTransactionDate)) {
      lastTransactionDate = txn.transaction_date;
    }
  }

  const currentBalance = openingReceivable + totalPurchases - totalPayments;

  return {
    ...customer,
    total_purchases: totalPurchases,
    total_payments: totalPayments,
    current_balance: currentBalance,
    last_transaction_date: lastTransactionDate,
  };
}

/**
 * Calculates a supplier's total purchases, total payments, and current running balance.
 *
 * Balance convention for suppliers:
 * - positive (> 0): Business owes money to supplier ("Dene hain" / Payable)
 * - negative (< 0): Supplier owes refund / Advance paid ("Lene hain" / Advance)
 * - zero (= 0): Fully settled ("Hisaab Barabar")
 */
export function calculateSupplierSummary(
  supplier: Supplier,
  transactions: Transaction[]
): SupplierSummary {
  const supplierTxns = transactions.filter(
    (t) => !t.is_deleted && t.supplier_id === supplier.id
  );

  let totalPurchases = 0;
  let totalPayments = 0;
  let lastTransactionDate: string | null = null;

  // Initial balance from opening balance
  const openingPayable =
    supplier.opening_balance_type === "payable"
      ? Number(supplier.opening_balance) || 0
      : -(Number(supplier.opening_balance) || 0);

  for (const txn of supplierTxns) {
    const amount = Number(txn.amount) || 0;

    if (txn.transaction_type === "purchase") {
      // Credit purchase increases what we owe supplier
      totalPurchases += amount;
    } else if (txn.transaction_type === "supplier_payment") {
      // Payment clears our payable
      totalPayments += amount;
    } else if (txn.transaction_type === "expense") {
      // Direct paid expense tagged to supplier
      totalPurchases += amount;
      totalPayments += amount;
    }

    if (!lastTransactionDate || new Date(txn.transaction_date) > new Date(lastTransactionDate)) {
      lastTransactionDate = txn.transaction_date;
    }
  }

  const currentBalance = openingPayable + totalPurchases - totalPayments;

  return {
    ...supplier,
    total_purchases: totalPurchases,
    total_payments: totalPayments,
    current_balance: currentBalance,
    last_transaction_date: lastTransactionDate,
  };
}

/**
 * Calculates customer ledger with chronological running balances.
 */
export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  type: string;
  debit: number;   // Amount that increases customer dues (Sale)
  credit: number;  // Amount that clears customer dues (Payment)
  balance: number; // Running balance after this transaction
  payment_method?: string;
}

export function buildCustomerLedger(
  customer: Customer,
  transactions: Transaction[]
): { entries: LedgerEntry[]; totalDebit: number; totalCredit: number; finalBalance: number } {
  const customerTxns = transactions
    .filter((t) => !t.is_deleted && t.customer_id === customer.id)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  let runningBalance =
    customer.opening_balance_type === "receivable"
      ? Number(customer.opening_balance) || 0
      : -(Number(customer.opening_balance) || 0);

  const entries: LedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  // Opening balance row if non-zero
  if (Number(customer.opening_balance) > 0) {
    if (customer.opening_balance_type === "receivable") {
      totalDebit += Number(customer.opening_balance);
      entries.push({
        id: "opening-balance",
        date: customer.created_at,
        description: "Opening Balance (पुराना बकाया - लेना है)",
        type: "Opening Balance",
        debit: Number(customer.opening_balance),
        credit: 0,
        balance: runningBalance,
      });
    } else {
      totalCredit += Number(customer.opening_balance);
      entries.push({
        id: "opening-balance",
        date: customer.created_at,
        description: "Opening Advance (पुराना जमा - एडवांस)",
        type: "Opening Balance",
        debit: 0,
        credit: Number(customer.opening_balance),
        balance: runningBalance,
      });
    }
  }

  for (const txn of customerTxns) {
    const amt = Number(txn.amount) || 0;
    let debit = 0;
    let credit = 0;
    let desc = txn.description || "";

    if (txn.transaction_type === "sale") {
      debit = amt;
      runningBalance += amt;
      totalDebit += amt;
      desc = desc || "Maal Bikri (Credit Sale)";
    } else if (txn.transaction_type === "customer_payment") {
      credit = amt;
      runningBalance -= amt;
      totalCredit += amt;
      desc = desc || "Jama / Payment Received";
    } else if (txn.transaction_type === "income") {
      debit = amt;
      credit = amt;
      totalDebit += amt;
      totalCredit += amt;
      desc = desc || "Cash Sale / Income";
    }

    entries.push({
      id: txn.id,
      date: txn.transaction_date,
      description: desc,
      type: txn.transaction_type,
      debit,
      credit,
      balance: runningBalance,
      payment_method: txn.payment_method,
    });
  }

  return {
    entries,
    totalDebit,
    totalCredit,
    finalBalance: runningBalance,
  };
}

/**
 * Calculates supplier ledger with chronological running balances.
 */
export function buildSupplierLedger(
  supplier: Supplier,
  transactions: Transaction[]
): { entries: LedgerEntry[]; totalDebit: number; totalCredit: number; finalBalance: number } {
  const supplierTxns = transactions
    .filter((t) => !t.is_deleted && t.supplier_id === supplier.id)
    .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

  let runningBalance =
    supplier.opening_balance_type === "payable"
      ? Number(supplier.opening_balance) || 0
      : -(Number(supplier.opening_balance) || 0);

  const entries: LedgerEntry[] = [];
  let totalDebit = 0; // Payments made to supplier (decreases payable)
  let totalCredit = 0; // Purchases from supplier (increases payable)

  if (Number(supplier.opening_balance) > 0) {
    if (supplier.opening_balance_type === "payable") {
      totalCredit += Number(supplier.opening_balance);
      entries.push({
        id: "opening-balance",
        date: supplier.created_at,
        description: "Opening Balance (पुराना बकाया - देना है)",
        type: "Opening Balance",
        debit: 0,
        credit: Number(supplier.opening_balance),
        balance: runningBalance,
      });
    } else {
      totalDebit += Number(supplier.opening_balance);
      entries.push({
        id: "opening-balance",
        date: supplier.created_at,
        description: "Opening Advance (एडवांस दिया हुआ)",
        type: "Opening Balance",
        debit: Number(supplier.opening_balance),
        credit: 0,
        balance: runningBalance,
      });
    }
  }

  for (const txn of supplierTxns) {
    const amt = Number(txn.amount) || 0;
    let debit = 0;
    let credit = 0;
    let desc = txn.description || "";

    if (txn.transaction_type === "purchase") {
      credit = amt;
      runningBalance += amt;
      totalCredit += amt;
      desc = desc || "Maal Kharid (Credit Purchase)";
    } else if (txn.transaction_type === "supplier_payment") {
      debit = amt;
      runningBalance -= amt;
      totalDebit += amt;
      desc = desc || "Bhugtan / Payment Paid";
    } else if (txn.transaction_type === "expense") {
      credit = amt;
      debit = amt;
      totalCredit += amt;
      totalDebit += amt;
      desc = desc || "Direct Paid Purchase";
    }

    entries.push({
      id: txn.id,
      date: txn.transaction_date,
      description: desc,
      type: txn.transaction_type,
      debit,
      credit,
      balance: runningBalance,
      payment_method: txn.payment_method,
    });
  }

  return {
    entries,
    totalDebit,
    totalCredit,
    finalBalance: runningBalance,
  };
}

/**
 * Calculates Today's Business Summary:
 * Today's Income: Direct income + customer payments received today
 * Today's Expense: Direct expense + supplier payments made today
 * Today's Net: Income - Expense
 */
export function calculateTodaySummary(
  transactions: Transaction[],
  referenceDate: Date = new Date()
): DailySummary {
  const startOfDay = new Date(referenceDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(referenceDate);
  endOfDay.setHours(23, 59, 59, 999);

  let todayIncome = 0;
  let todayExpense = 0;

  for (const txn of transactions) {
    if (txn.is_deleted) continue;

    const txnDate = new Date(txn.transaction_date);
    if (txnDate >= startOfDay && txnDate <= endOfDay) {
      const amt = Number(txn.amount) || 0;

      if (txn.transaction_type === "sale" || txn.transaction_type === "customer_payment" || txn.transaction_type === "income") {
        todayIncome += amt;
      } else if (txn.transaction_type === "purchase" || txn.transaction_type === "supplier_payment" || txn.transaction_type === "expense") {
        todayExpense += amt;
      }
    }
  }

  return {
    income: todayIncome,
    expense: todayExpense,
    net: todayIncome - todayExpense,
  };
}

/**
 * Calculates overall business accounting metrics:
 *
 * Section 16 & Section 40:
 * - Total Sales (Revenue): Credit Sales ('sale') + Cash Sales / Income ('income')
 * - Total Expenses (Cost): Supplier Purchases ('purchase') + Business Expenses ('expense')
 * - Net Profit: Total Sales - Total Expenses
 * - Total Receivable: Sum of all positive customer balances (lene hain)
 * - Total Payable: Sum of all positive supplier balances (dene hain)
 * - Cash in Hand / Flow: (Customer Payments + Direct Income) - (Supplier Payments + Direct Expenses)
 */
export function calculateOverallSummary(
  customers: CustomerSummary[],
  suppliers: SupplierSummary[],
  transactions: Transaction[]
): OverallSummary {
  // Outstanding Receivable (only positive balances where customer owes money)
  const totalReceivable = customers.reduce((sum, c) => {
    return sum + (c.current_balance > 0 ? c.current_balance : 0);
  }, 0);

  // Outstanding Payable (only positive balances where business owes supplier)
  const totalPayable = suppliers.reduce((sum, s) => {
    return sum + (s.current_balance > 0 ? s.current_balance : 0);
  }, 0);

  let totalSales = 0;
  let totalExpenses = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  for (const txn of transactions) {
    if (txn.is_deleted) continue;
    const amt = Number(txn.amount) || 0;

    switch (txn.transaction_type) {
      case "sale":
        totalSales += amt;
        break;
      case "income":
        totalSales += amt;
        cashInflow += amt;
        break;
      case "customer_payment":
        cashInflow += amt;
        // Not sales revenue again!
        break;
      case "purchase":
        totalExpenses += amt;
        break;
      case "expense":
        totalExpenses += amt;
        cashOutflow += amt;
        break;
      case "supplier_payment":
        cashOutflow += amt;
        // Not expense again!
        break;
    }
  }

  // Include customer opening receivables in baseline sales if unassigned, or keep pure from transactions
  const netProfit = totalSales - totalExpenses;
  const cashInHand = cashInflow - cashOutflow;

  return {
    total_receivable: totalReceivable,
    total_payable: totalPayable,
    total_sales: totalSales,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    cash_in_hand: cashInHand,
  };
}
