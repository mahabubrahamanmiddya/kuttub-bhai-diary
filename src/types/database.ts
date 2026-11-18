export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TransactionType =
  | "sale"              // Credit sale to customer (Receivable increases, Revenue recognized)
  | "customer_payment" // Customer pays dues (Receivable decreases, Cash/Bank increases)
  | "purchase"          // Credit purchase from supplier (Payable increases, Purchase cost recognized)
  | "supplier_payment" // Payment to supplier (Payable decreases, Cash/Bank decreases)
  | "income"            // Direct cash income / Cash sale (Revenue increases, Cash/Bank increases)
  | "expense";          // Direct business expense (Expense increases, Cash/Bank decreases)

export type PaymentMethod = "Cash" | "UPI" | "Bank Transfer" | "Card" | "Other";

export type BalanceType = "receivable" | "payable";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  opening_balance: number;
  opening_balance_type: BalanceType; // 'receivable' (lene hain) or 'payable' (advance diya)
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  opening_balance: number;
  opening_balance_type: BalanceType; // 'payable' (dene hain) or 'receivable' (advance diya)
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  type: "expense" | "income" | "both";
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: string;
  customer_id: string | null;
  supplier_id: string | null;
  category_id: string | null;
  category_name: string | null;
  payment_method: PaymentMethod;
  description: string | null;
  attachment_url: string | null;
  is_deleted: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer?: Customer | null;
  supplier?: Supplier | null;
  category?: Category | null;
}

export interface CustomerSummary extends Customer {
  total_purchases: number;
  total_payments: number;
  current_balance: number; // positive = customer owes us (lene hain), negative = customer gave advance (dene hain)
  last_transaction_date?: string | null;
}

export interface SupplierSummary extends Supplier {
  total_purchases: number;
  total_payments: number;
  current_balance: number; // positive = we owe supplier (dene hain), negative = we gave advance (lene hain)
  last_transaction_date?: string | null;
}

export interface DailySummary {
  income: number;
  expense: number;
  net: number;
}

export interface OverallSummary {
  total_receivable: number; // Total customer dues (lene hain)
  total_payable: number;    // Total supplier dues (dene hain)
  total_sales: number;      // All revenue (sales + income)
  total_expenses: number;   // All costs (purchases + direct expenses)
  net_profit: number;       // total_sales - total_expenses
  cash_in_hand: number;     // estimated net cash/bank flow
}
