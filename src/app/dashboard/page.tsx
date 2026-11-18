"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { useAuth } from "@/context/auth-context";
import { formatCurrency, formatRelativeDate, generateWhatsAppReminderUrl } from "@/lib/formatters";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Truck,
  PlusCircle,
  Receipt,
  ShoppingBag,
  Clock,
  ArrowRight,
  Share2,
  Calendar,
  Wallet,
  Building,
} from "lucide-react";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { AddSupplierModal } from "@/components/suppliers/AddSupplierModal";
import { TransactionType } from "@/types/database";

export default function DashboardPage() {
  const { business } = useAuth();
  const { customers, suppliers, transactions, todaySummary, overallSummary, isLoading } = useDiary();

  // Modal triggers
  const [modalType, setModalType] = useState<TransactionType | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  // Top outstanding debtors (customers who owe money)
  const outstandingCustomers = customers
    .filter((c) => c.current_balance > 0)
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 5);

  // Top payables (suppliers we owe money)
  const outstandingSuppliers = suppliers
    .filter((s) => s.current_balance > 0)
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 5);

  // Latest 8 transactions
  const recentTransactions = transactions.slice(0, 8);

  const getTransactionBadge = (type: TransactionType) => {
    switch (type) {
      case "sale":
        return { label: "Bikri (Sale)", color: "text-emerald-700 bg-emerald-50", sign: "+" };
      case "customer_payment":
        return { label: "Payment Received", color: "text-green-700 bg-green-50", sign: "+" };
      case "purchase":
        return { label: "Kharid (Purchase)", color: "text-slate-700 bg-slate-100", sign: "-" };
      case "supplier_payment":
        return { label: "Payment Paid", color: "text-rose-700 bg-rose-50", sign: "-" };
      case "expense":
        return { label: "Kharcha (Expense)", color: "text-rose-700 bg-rose-50", sign: "-" };
      case "income":
        return { label: "Direct Income", color: "text-teal-700 bg-teal-50", sign: "+" };
      default:
        return { label: type, color: "text-slate-700 bg-slate-100", sign: "" };
    }
  };

  return (
    <AppShell>
      {/* Header Greeting */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {business?.business_name || "Mera Business"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Aapka Digital Business Diary & Hisaab-Kitaab
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Today: {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}
          </span>
        </div>
      </div>

      {/* TODAY'S BUSINESS SUMMARY CARD (Hero section) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600/40 rounded-lg">
              <Calendar className="w-4 h-4 text-emerald-300" />
            </div>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-emerald-300">
              Today&apos;s Business (आज का कारोबार)
            </h2>
          </div>
          <span className="text-xs text-slate-300 font-medium">Real-time Summary</span>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-6 divide-x divide-slate-700/60 pt-1">
          <div>
            <div className="text-[11px] sm:text-xs text-emerald-400 font-medium">Today&apos;s Income</div>
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-white mt-1">
              {formatCurrency(todaySummary.income)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">Aamadani + Jama</div>
          </div>

          <div className="pl-3 sm:pl-6">
            <div className="text-[11px] sm:text-xs text-rose-400 font-medium">Today&apos;s Expense</div>
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-white mt-1">
              {formatCurrency(todaySummary.expense)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">Kharche + Bhugtan</div>
          </div>

          <div className="pl-3 sm:pl-6">
            <div className="text-[11px] sm:text-xs text-blue-300 font-medium">Today&apos;s Net</div>
            <div
              className={`text-lg sm:text-2xl font-bold tracking-tight mt-1 ${
                todaySummary.net >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatCurrency(todaySummary.net)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">Aaj ka Bachaat</div>
          </div>
        </div>
      </div>

      {/* OVERALL SUMMARY TILES (Receivable vs Payable + Net Profit) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Total Receivable */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Lene Hain (Receivable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(overallSummary.total_receivable)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Customer baki rashi</p>
        </div>

        {/* Total Payable */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              Dene Hain (Payable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(overallSummary.total_payable)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Supplier baki rashi</p>
        </div>

        {/* Total Sales (Revenue) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Total Sales (कुल बिक्री)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(overallSummary.total_sales)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Credit + Cash Sales</p>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Net Profit (शुद्ध लाभ)
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              overallSummary.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(overallSummary.net_profit)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Sales - Kharche</p>
        </div>
      </div>

      {/* QUICK ACTIONS SECTION (Large Touch Targets for Non-Technical Users) */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Quick Actions (जल्दी हिसाब जोड़ें)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {/* Add Sale */}
          <button
            onClick={() => setModalType("sale")}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-emerald-50/50 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Add Sale</span>
            <span className="text-[10px] text-slate-500">उधार बिक्री</span>
          </button>

          {/* Receive Money */}
          <button
            onClick={() => setModalType("customer_payment")}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-green-50/50 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Receive Money</span>
            <span className="text-[10px] text-slate-500">जमा / पेमेंट आई</span>
          </button>

          {/* Add Expense */}
          <button
            onClick={() => setModalType("expense")}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-rose-50/50 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Add Expense</span>
            <span className="text-[10px] text-slate-500">खर्च (किराया/बिल)</span>
          </button>

          {/* Pay Supplier */}
          <button
            onClick={() => setModalType("supplier_payment")}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-orange-50/50 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">Pay Supplier</span>
            <span className="text-[10px] text-slate-500">सप्लायर को दिए</span>
          </button>

          {/* Add Customer */}
          <button
            onClick={() => setShowAddCustomer(true)}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-blue-50/50 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">+ Customer</span>
            <span className="text-[10px] text-slate-500">नया ग्राहक</span>
          </button>

          {/* Add Supplier */}
          <button
            onClick={() => setShowAddSupplier(true)}
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl text-center shadow-sm transition active:scale-95 group"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900">+ Supplier</span>
            <span className="text-[10px] text-slate-500">नया व्यापारी</span>
          </button>
        </div>
      </div>

      {/* TWO COLUMN SECTION: OUTSTANDING DUES & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Dues (Customer & Supplier Balances) */}
        <div className="space-y-6">
          {/* Customers Who Owe Money */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Customer Baki (Lene Hain)</h3>
                  <p className="text-xs text-slate-500">Paise lene wale top grahak</p>
                </div>
              </div>
              <Link
                href="/customers"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Sabhi Dekhein</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {outstandingCustomers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Kisi customer ka baki hisaab nahi hai. Sab barabar hai!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {outstandingCustomers.map((cust) => (
                  <div key={cust.id} className="py-3 flex items-center justify-between">
                    <Link href={`/customers/${cust.id}`} className="min-w-0 flex-1 hover:underline">
                      <div className="text-sm font-semibold text-slate-900 truncate">{cust.name}</div>
                      <div className="text-xs text-slate-500">{cust.phone || "No phone"}</div>
                    </Link>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700">
                          {formatCurrency(cust.current_balance)}
                        </div>
                        <div className="text-[10px] text-slate-400">baki hai</div>
                      </div>

                      {cust.phone && (
                        <a
                          href={generateWhatsAppReminderUrl({
                            phone: cust.phone,
                            customerName: cust.name,
                            amount: cust.current_balance,
                            businessName: business?.business_name || "Mera Business",
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp Reminder Bhejein"
                          className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          <Share2 className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suppliers We Owe Money */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-lg">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Supplier Baki (Dene Hain)</h3>
                  <p className="text-xs text-slate-500">Vyapari jinko payment deni hai</p>
                </div>
              </div>
              <Link
                href="/suppliers"
                className="text-xs font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1"
              >
                <span>Sabhi Dekhein</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {outstandingSuppliers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Kisi supplier ka baki bhugtan nahi hai.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {outstandingSuppliers.map((supp) => (
                  <div key={supp.id} className="py-3 flex items-center justify-between">
                    <Link href={`/suppliers/${supp.id}`} className="min-w-0 flex-1 hover:underline">
                      <div className="text-sm font-semibold text-slate-900 truncate">{supp.name}</div>
                      <div className="text-xs text-slate-500">{supp.phone || "No phone"}</div>
                    </Link>

                    <div className="text-right">
                      <div className="text-sm font-bold text-rose-700">
                        {formatCurrency(supp.current_balance)}
                      </div>
                      <div className="text-[10px] text-slate-400">dena hai</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recent Hisaab (लेन-देन)</h3>
                  <p className="text-xs text-slate-500">Taza transactions ki suchi</p>
                </div>
              </div>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Day Book Dekhein</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Abhi tak koi transaction nahi hai.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Upar diye gaye buttons se naya hisaab jodein.
                </p>
                <button
                  onClick={() => setModalType("sale")}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  + Pehla Hisaab Jodein
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((txn) => {
                  const badge = getTransactionBadge(txn.transaction_type);
                  const personName =
                    txn.customer?.name ||
                    txn.supplier?.name ||
                    txn.category_name ||
                    (txn.transaction_type === "expense" ? "Dukan Kharcha" : "Counter Sale");

                  return (
                    <div key={txn.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {personName}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatRelativeDate(txn.transaction_date)} • {txn.payment_method}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-sm sm:text-base font-bold ${
                            badge.sign === "+" ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {badge.sign} {formatCurrency(txn.amount)}
                        </div>
                        {txn.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {txn.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {recentTransactions.length > 0 && (
            <div className="pt-4 mt-2 border-t border-slate-100">
              <Link
                href="/transactions"
                className="w-full py-2.5 text-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl block transition"
              >
                View Complete Day Book & Reports →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      {modalType && (
        <AddTransactionModal
          isOpen={Boolean(modalType)}
          onClose={() => setModalType(null)}
          defaultType={modalType}
        />
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
      />

      {/* Add Supplier Modal */}
      <AddSupplierModal
        isOpen={showAddSupplier}
        onClose={() => setShowAddSupplier(false)}
      />
    </AppShell>
  );
}
