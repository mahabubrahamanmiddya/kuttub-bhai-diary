"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/formatters";
import { ExportService } from "@/lib/export-service";
import {
  ArrowLeftRight,
  Search,
  Filter,
  Download,
  Trash2,
  Calendar,
  X,
  Plus,
} from "lucide-react";
import { TransactionType, PaymentMethod } from "@/types/database";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { DeleteConfirmModal } from "@/components/common/DeleteConfirmModal";

export default function TransactionsPage() {
  const { transactions, customers, suppliers, categories, deleteTransaction } = useDiary();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter Transactions
  const filtered = transactions.filter((t) => {
    if (t.is_deleted) return false;

    // Type filter
    if (selectedType !== "all" && t.transaction_type !== selectedType) return false;

    // Customer filter
    if (selectedCustomer !== "all" && t.customer_id !== selectedCustomer) return false;

    // Supplier filter
    if (selectedSupplier !== "all" && t.supplier_id !== selectedSupplier) return false;

    // Payment method filter
    if (selectedMethod !== "all" && t.payment_method !== selectedMethod) return false;

    // Date range filter
    if (startDate) {
      const tDate = new Date(t.transaction_date);
      const sDate = new Date(startDate);
      sDate.setHours(0, 0, 0, 0);
      if (tDate < sDate) return false;
    }
    if (endDate) {
      const tDate = new Date(t.transaction_date);
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      if (tDate > eDate) return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDesc = t.description && t.description.toLowerCase().includes(term);
      const matchCat = t.category_name && t.category_name.toLowerCase().includes(term);
      const matchCust = t.customer?.name && t.customer.name.toLowerCase().includes(term);
      const matchSupp = t.supplier?.name && t.supplier.name.toLowerCase().includes(term);
      if (!matchDesc && !matchCat && !matchCust && !matchSupp) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const timeA = new Date(a.transaction_date).getTime();
    const timeB = new Date(b.transaction_date).getTime();
    return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
  });

  const handleDelete = async () => {
    if (!deleteTxnId) return;
    setIsDeleting(true);
    await deleteTransaction(deleteTxnId);
    setIsDeleting(false);
    setDeleteTxnId(null);
  };

  const getBadge = (type: TransactionType) => {
    switch (type) {
      case "sale":
        return { label: "Sale (Bikri)", color: "text-emerald-700 bg-emerald-50", sign: "+" };
      case "customer_payment":
        return { label: "Customer Paid", color: "text-green-700 bg-green-50", sign: "+" };
      case "purchase":
        return { label: "Purchase", color: "text-slate-700 bg-slate-100", sign: "-" };
      case "supplier_payment":
        return { label: "Supplier Paid", color: "text-rose-700 bg-rose-50", sign: "-" };
      case "expense":
        return { label: "Expense (Kharcha)", color: "text-rose-700 bg-rose-50", sign: "-" };
      case "income":
        return { label: "Direct Income", color: "text-teal-700 bg-teal-50", sign: "+" };
      default:
        return { label: type, color: "text-slate-700 bg-slate-100", sign: "" };
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-emerald-600" />
            <span>Day Book / Transactions (लेन-देन)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Sabhi hisaab aur roznamcha records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => ExportService.exportTransactionsCSV(transactions)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Naya Hisaab</span>
          </button>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search description, note, customer, or category..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="all">All Types</option>
              <option value="sale">Bikri (Sale)</option>
              <option value="customer_payment">Customer Payment</option>
              <option value="purchase">Purchase (Kharid)</option>
              <option value="supplier_payment">Supplier Payment</option>
              <option value="expense">Expense (Kharcha)</option>
              <option value="income">Direct Income</option>
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Method</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash (नकद)</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            />
          </div>
        </div>

        {/* Clear Filters bar if any active */}
        {(selectedType !== "all" ||
          selectedCustomer !== "all" ||
          selectedSupplier !== "all" ||
          selectedMethod !== "all" ||
          startDate ||
          endDate ||
          searchTerm) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Showing {sorted.length} of {transactions.length} transactions
            </span>
            <button
              onClick={() => {
                setSelectedType("all");
                setSelectedCustomer("all");
                setSelectedSupplier("all");
                setSelectedMethod("all");
                setStartDate("");
                setEndDate("");
                setSearchTerm("");
              }}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
        {sorted.length === 0 ? (
          <div className="py-16 text-center px-4">
            <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Koi transaction nahi mila</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Filter badal kar dekhein ya upar se naya transaction jodein.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sorted.map((txn) => {
              const badge = getBadge(txn.transaction_type);
              const partyName =
                txn.customer?.name ||
                txn.supplier?.name ||
                txn.category_name ||
                (txn.transaction_type === "expense" ? "Dukan Kharcha" : "Counter Sale");

              return (
                <div
                  key={txn.id}
                  className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {partyName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                      <span>{formatDate(txn.transaction_date)}</span>
                      <span>•</span>
                      <span>Method: {txn.payment_method}</span>
                      {txn.description && (
                        <>
                          <span>•</span>
                          <span className="italic text-slate-600 truncate max-w-xs">
                            {txn.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-base font-bold ${
                          badge.sign === "+" ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {badge.sign} {formatCurrency(txn.amount)}
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteTxnId(txn.id)}
                      title="Delete Hisaab"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddTransactionModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />

      <DeleteConfirmModal
        isOpen={Boolean(deleteTxnId)}
        onClose={() => setDeleteTxnId(null)}
        onConfirm={handleDelete}
        title="Delete this transaction?"
        description="Yeh hisaab soft-delete hoga aur balances se automatically adjust ho jayega."
        confirmLabel="Yes, Delete Transaction"
        isDeleting={isDeleting}
      />
    </AppShell>
  );
}
