"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { useAuth } from "@/context/auth-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ExportService } from "@/lib/export-service";
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Receipt,
  Wallet,
  PieChart,
} from "lucide-react";

export default function ReportsPage() {
  const { transactions, customers, suppliers } = useDiary();
  const { business } = useAuth();

  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

  // Determine date boundary for timeframe
  const now = new Date();
  let startDate = new Date();

  if (timeframe === "daily") {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === "weekly") {
    startDate.setDate(now.getDate() - 7);
  } else if (timeframe === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (timeframe === "yearly") {
    startDate = new Date(now.getFullYear(), 0, 1);
  }

  // Filter transactions within selected period
  const periodTxns = transactions.filter((t) => {
    if (t.is_deleted) return false;
    const tDate = new Date(t.transaction_date);
    return tDate >= startDate && tDate <= now;
  });

  // Calculate metrics according to accounting principles (Section 16)
  let periodSales = 0;
  let periodExpenses = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  const categoryMap: { [cat: string]: number } = {};
  const methodMap: { [method: string]: number } = {};

  for (const txn of periodTxns) {
    const amt = Number(txn.amount) || 0;

    // Payment method distribution
    methodMap[txn.payment_method] = (methodMap[txn.payment_method] || 0) + amt;

    switch (txn.transaction_type) {
      case "sale":
        periodSales += amt;
        break;
      case "income":
        periodSales += amt;
        cashInflow += amt;
        break;
      case "customer_payment":
        cashInflow += amt;
        break;
      case "purchase":
        periodExpenses += amt;
        break;
      case "expense":
        periodExpenses += amt;
        cashOutflow += amt;
        const cat = txn.category_name || "General Expense";
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        break;
      case "supplier_payment":
        cashOutflow += amt;
        break;
    }
  }

  const netProfit = periodSales - periodExpenses;
  const netCashFlow = cashInflow - cashOutflow;

  const totalReceivable = customers.reduce(
    (sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0),
    0
  );

  const totalPayable = suppliers.reduce(
    (sum, s) => sum + (s.current_balance > 0 ? s.current_balance : 0),
    0
  );

  const handleExportPDF = () => {
    if (!business) return;
    ExportService.exportBusinessReportPDF(
      business,
      {
        total_sales: periodSales,
        total_expenses: periodExpenses,
        net_profit: netProfit,
        total_receivable: totalReceivable,
        total_payable: totalPayable,
        cash_in_hand: netCashFlow,
      },
      periodTxns,
      timeframe.toUpperCase()
    );
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Business Reports & Munafa (रिपोर्ट्स)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Labh-hani (Profit & Loss) aur kharchon ka vishleshan
          </p>
        </div>

        <button
          onClick={handleExportPDF}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Download PDF Report</span>
        </button>
      </div>

      {/* Timeframe Tabs */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit mb-6 text-xs font-semibold">
        <button
          onClick={() => setTimeframe("daily")}
          className={`px-4 py-2 rounded-xl transition ${
            timeframe === "daily" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Daily (आज का)
        </button>
        <button
          onClick={() => setTimeframe("weekly")}
          className={`px-4 py-2 rounded-xl transition ${
            timeframe === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Weekly (7 Din)
        </button>
        <button
          onClick={() => setTimeframe("monthly")}
          className={`px-4 py-2 rounded-xl transition ${
            timeframe === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Monthly (Is Mahine)
        </button>
        <button
          onClick={() => setTimeframe("yearly")}
          className={`px-4 py-2 rounded-xl transition ${
            timeframe === "yearly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Yearly (Is Saal)
        </button>
      </div>

      {/* Main KPI Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Total Sales (बिक्री)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(periodSales)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Credit + Cash sales</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Total Expenses (खर्च)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(periodExpenses)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Purchases + shop expenses</p>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Net Profit (शुद्ध लाभ)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${
              netProfit >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(netProfit)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sales - Expenses</p>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Cash Inflow/Outflow
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${
              netCashFlow >= 0 ? "text-teal-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(netCashFlow)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Net cash/bank movement</p>
        </div>
      </div>

      {/* Two Column Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Expense Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Expense Breakdown (खर्चों का विवरण)</h3>
                <p className="text-xs text-slate-500">Kis category me kitna kharch hua</p>
              </div>
            </div>
          </div>

          {Object.keys(categoryMap).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Is samayavdhi me koi kharcha darj nahi hai.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(categoryMap)
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => {
                  const percentage =
                    periodExpenses > 0 ? Math.round((amount / periodExpenses) * 100) : 0;

                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">{category}</span>
                        <span className="text-rose-700">
                          {formatCurrency(amount)} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Payment Modes (पेमेंट के तरीके)</h3>
                <p className="text-xs text-slate-500">Cash vs UPI vs Bank transfer</p>
              </div>
            </div>
          </div>

          {Object.keys(methodMap).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              Is samayavdhi me koi transaction nahi hai.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(methodMap)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => (
                  <div
                    key={method}
                    className="p-3 bg-slate-50 rounded-xl flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-slate-800">{method}</span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
