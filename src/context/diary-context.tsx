"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth-context";
import { dataService, SyncItem } from "@/lib/data-service";
import {
  Customer,
  Supplier,
  Transaction,
  Category,
  CustomerSummary,
  SupplierSummary,
  DailySummary,
  OverallSummary,
  TransactionType,
  PaymentMethod,
} from "@/types/database";
import {
  calculateCustomerSummary,
  calculateSupplierSummary,
  calculateTodaySummary,
  calculateOverallSummary,
} from "@/lib/accounting";

interface DiaryContextType {
  customers: CustomerSummary[];
  suppliers: SupplierSummary[];
  transactions: Transaction[];
  categories: Category[];
  todaySummary: DailySummary;
  overallSummary: OverallSummary;
  isLoading: boolean;
  isOffline: boolean;
  pendingSyncCount: number;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  error: string | null;

  // Actions
  refreshAll: () => Promise<void>;
  addTransaction: (data: {
    transaction_type: TransactionType;
    amount: number;
    transaction_date?: string;
    customer_id?: string | null;
    supplier_id?: string | null;
    category_id?: string | null;
    category_name?: string | null;
    payment_method: PaymentMethod;
    description?: string | null;
  }) => Promise<{ success: boolean; error?: string; isLocalOnly?: boolean }>;
  updateTransaction: (
    id: string,
    data: Partial<Transaction>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>;

  addCustomer: (data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    opening_balance?: number;
    opening_balance_type?: "receivable" | "payable";
  }) => Promise<{ success: boolean; customer?: Customer; error?: string }>;
  updateCustomer: (
    id: string,
    data: Partial<Customer>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteCustomer: (id: string) => Promise<{ success: boolean; error?: string }>;

  addSupplier: (data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    opening_balance?: number;
    opening_balance_type?: "payable" | "receivable";
  }) => Promise<{ success: boolean; supplier?: Supplier; error?: string }>;
  updateSupplier: (
    id: string,
    data: Partial<Supplier>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSupplier: (id: string) => Promise<{ success: boolean; error?: string }>;

  triggerSync: () => Promise<void>;
}

const DiaryContext = createContext<DiaryContextType | undefined>(undefined);

export function DiaryProvider({ children }: { children: React.ReactNode }) {
  const { business } = useAuth();

  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [rawSuppliers, setRawSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailySummary>({ income: 0, expense: 0, net: 0 });
  const [overallSummary, setOverallSummary] = useState<OverallSummary>({
    total_receivable: 0,
    total_payable: 0,
    total_sales: 0,
    total_expenses: 0,
    net_profit: 0,
    cash_in_hand: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  // Recalculate derived accounting state whenever raw data changes
  const recompute = useCallback(
    (cList: Customer[], sList: Supplier[], tList: Transaction[]) => {
      const activeTransactions = tList.filter((t) => !t.is_deleted);

      // 1. Customer Summaries
      const cSummaries = cList.map((c) => calculateCustomerSummary(c, activeTransactions));
      setCustomers(cSummaries);

      // 2. Supplier Summaries
      const sSummaries = sList.map((s) => calculateSupplierSummary(s, activeTransactions));
      setSuppliers(sSummaries);

      // 3. Today's Summary
      const today = calculateTodaySummary(activeTransactions);
      setTodaySummary(today);

      // 4. Overall Summary
      const overall = calculateOverallSummary(cSummaries, sSummaries, activeTransactions);
      setOverallSummary(overall);

      // 5. Update pending sync queue count
      const pending = dataService.getPendingSyncQueue().filter((q) => q.status === "pending").length;
      setPendingSyncCount(pending);
    },
    []
  );

  const refreshAll = useCallback(async () => {
    if (!business?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [cData, sData, tData, catData] = await Promise.all([
        dataService.getCustomers(business.id),
        dataService.getSuppliers(business.id),
        dataService.getTransactions(business.id),
        dataService.getCategories(business.id),
      ]);

      setRawCustomers(cData);
      setRawSuppliers(sData);
      setTransactions(tData);
      setCategories(catData);

      recompute(cData, sData, tData);
    } catch (err: any) {
      console.error("Error loading hisaab data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [business?.id, recompute]);

  useEffect(() => {
    if (business?.id) {
      refreshAll();
    }
  }, [business?.id, refreshAll]);

  // Sync pending items
  const triggerSync = async () => {
    setSyncStatus("syncing");
    try {
      const res = await dataService.syncPendingQueue();
      if (res.synced > 0) {
        setSyncStatus("synced");
        setTimeout(() => setSyncStatus("idle"), 3000);
        await refreshAll();
      } else {
        setSyncStatus("idle");
      }
    } catch {
      setSyncStatus("error");
    }
  };

  // --- TRANSACTION OPERATIONS ---
  const addTransaction = async (data: {
    transaction_type: TransactionType;
    amount: number;
    transaction_date?: string;
    customer_id?: string | null;
    supplier_id?: string | null;
    category_id?: string | null;
    category_name?: string | null;
    payment_method: PaymentMethod;
    description?: string | null;
  }) => {
    if (!business?.id) return { success: false, error: "Business not selected" };
    if (!data.amount || data.amount <= 0) return { success: false, error: "Valid amount is required" };

    try {
      const newTxn = await dataService.createTransaction({
        business_id: business.id,
        transaction_type: data.transaction_type,
        amount: data.amount,
        payment_method: data.payment_method,
        customer_id: data.customer_id || null,
        supplier_id: data.supplier_id || null,
        category_id: data.category_id || null,
        category_name: data.category_name || null,
        description: data.description || null,
        transaction_date: data.transaction_date || new Date().toISOString(),
        attachment_url: null,
      });

      const updatedTransactions = [newTxn, ...transactions];
      setTransactions(updatedTransactions);
      recompute(rawCustomers, rawSuppliers, updatedTransactions);

      const isLocalOnly = !dataService.isCloudConnected() || isOffline;
      return { success: true, isLocalOnly };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to record transaction" };
    }
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    try {
      const updated = await dataService.updateTransaction(id, data);
      const updatedList = transactions.map((t) => (t.id === id ? updated : t));
      setTransactions(updatedList);
      recompute(rawCustomers, rawSuppliers, updatedList);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update transaction" };
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await dataService.softDeleteTransaction(id);
      const updatedList = transactions.map((t) =>
        t.id === id ? { ...t, is_deleted: true } : t
      );
      setTransactions(updatedList);
      recompute(rawCustomers, rawSuppliers, updatedList);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete transaction" };
    }
  };

  // --- CUSTOMER OPERATIONS ---
  const addCustomer = async (data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    opening_balance?: number;
    opening_balance_type?: "receivable" | "payable";
  }) => {
    if (!business?.id) return { success: false, error: "Business not selected" };
    if (!data.name.trim()) return { success: false, error: "Customer name is required" };

    try {
      const newCust = await dataService.createCustomer({
        business_id: business.id,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
        opening_balance: Number(data.opening_balance) || 0,
        opening_balance_type: data.opening_balance_type || "receivable",
      });

      const updated = [...rawCustomers, newCust];
      setRawCustomers(updated);
      recompute(updated, rawSuppliers, transactions);
      return { success: true, customer: newCust };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to add customer" };
    }
  };

  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    try {
      const updated = await dataService.updateCustomer(id, data);
      const updatedList = rawCustomers.map((c) => (c.id === id ? updated : c));
      setRawCustomers(updatedList);
      recompute(updatedList, rawSuppliers, transactions);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update customer" };
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await dataService.softDeleteCustomer(id);
      const updatedList = rawCustomers.filter((c) => c.id !== id);
      setRawCustomers(updatedList);
      recompute(updatedList, rawSuppliers, transactions);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete customer" };
    }
  };

  // --- SUPPLIER OPERATIONS ---
  const addSupplier = async (data: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    opening_balance?: number;
    opening_balance_type?: "payable" | "receivable";
  }) => {
    if (!business?.id) return { success: false, error: "Business not selected" };
    if (!data.name.trim()) return { success: false, error: "Supplier name is required" };

    try {
      const newSupp = await dataService.createSupplier({
        business_id: business.id,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
        opening_balance: Number(data.opening_balance) || 0,
        opening_balance_type: data.opening_balance_type || "payable",
      });

      const updated = [...rawSuppliers, newSupp];
      setRawSuppliers(updated);
      recompute(rawCustomers, updated, transactions);
      return { success: true, supplier: newSupp };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to add supplier" };
    }
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    try {
      const updated = await dataService.updateSupplier(id, data);
      const updatedList = rawSuppliers.map((s) => (s.id === id ? updated : s));
      setRawSuppliers(updatedList);
      recompute(rawCustomers, updatedList, transactions);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update supplier" };
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      await dataService.softDeleteSupplier(id);
      const updatedList = rawSuppliers.filter((s) => s.id !== id);
      setRawSuppliers(updatedList);
      recompute(rawCustomers, updatedList, transactions);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete supplier" };
    }
  };

  return (
    <DiaryContext.Provider
      value={{
        customers,
        suppliers,
        transactions,
        categories,
        todaySummary,
        overallSummary,
        isLoading,
        isOffline,
        pendingSyncCount,
        syncStatus,
        error,
        refreshAll,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        triggerSync,
      }}
    >
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary() {
  const context = useContext(DiaryContext);
  if (!context) {
    throw new Error("useDiary must be used within a DiaryProvider");
  }
  return context;
}
