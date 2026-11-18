"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { useAuth } from "@/context/auth-context";
import { formatCurrency, generateWhatsAppReminderUrl, cleanPhoneNumber } from "@/lib/formatters";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Share2,
  TrendingDown,
  ArrowRight,
  Download,
  Filter,
} from "lucide-react";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { ExportService } from "@/lib/export-service";

export default function CustomersPage() {
  const { customers } = useDiary();
  const { business } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "receivable" | "settled" | "advance">("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Filter logic
  const filteredCustomers = customers.filter((cust) => {
    const matchesSearch =
      cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cust.phone && cust.phone.includes(searchTerm)) ||
      (cust.address && cust.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "receivable") return cust.current_balance > 0;
    if (filterType === "advance") return cust.current_balance < 0;
    if (filterType === "settled") return cust.current_balance === 0;

    return true;
  });

  const totalReceivable = customers.reduce(
    (sum, c) => sum + (c.current_balance > 0 ? c.current_balance : 0),
    0
  );

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Customers (ग्राहक / खातेदार)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Grahakon ka hisaab-kitaab aur baki rashi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => ExportService.exportCustomersCSV(customers)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Naya Customer</span>
          </button>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-2xl p-5 shadow-lg mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-emerald-200 uppercase tracking-wider">
            Total Customer Receivable (कुल लेना है)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
            {formatCurrency(totalReceivable)}
          </div>
          <div className="text-xs text-emerald-100/80 mt-0.5">
            {customers.filter((c) => c.current_balance > 0).length} grahakon se baki lena hai
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <TrendingDown className="w-6 h-6 text-emerald-200" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name, phone, or address..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Sabhi ({customers.length})
          </button>
          <button
            onClick={() => setFilterType("receivable")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "receivable"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Baki Dena Hai ({customers.filter((c) => c.current_balance > 0).length})
          </button>
          <button
            onClick={() => setFilterType("settled")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "settled"
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100"
            }`}
          >
            Hisaab Barabar ({customers.filter((c) => c.current_balance === 0).length})
          </button>
          <button
            onClick={() => setFilterType("advance")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "advance"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            Advance ({customers.filter((c) => c.current_balance < 0).length})
          </button>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Koi Customer nahi mila</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Naya customer jodne ke liye &quot;+ Naya Customer&quot; button dabayein.
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-500 transition"
            >
              + Add Customer
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((cust) => {
              const isDebtor = cust.current_balance > 0;
              const isCreditor = cust.current_balance < 0;
              const isSettled = cust.current_balance === 0;

              return (
                <div
                  key={cust.id}
                  className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4"
                >
                  <Link
                    href={`/customers/${cust.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm group-hover:bg-emerald-100 group-hover:text-emerald-800 transition">
                      {cust.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition truncate">
                        {cust.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {cust.phone && <span>{cust.phone}</span>}
                        {cust.address && <span>• {cust.address}</span>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4">
                    {/* Balance */}
                    <div className="text-right">
                      <div
                        className={`text-sm sm:text-base font-bold ${
                          isDebtor
                            ? "text-emerald-700"
                            : isCreditor
                            ? "text-rose-700"
                            : "text-slate-500"
                        }`}
                      >
                        {formatCurrency(Math.abs(cust.current_balance))}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {isDebtor
                          ? "Lene Hain (You'll get)"
                          : isCreditor
                          ? "Advance (Dene Hain)"
                          : "Hisaab Barabar"}
                      </div>
                    </div>

                    {/* WhatsApp reminder shortcut */}
                    {cust.phone && isDebtor && (
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

                    {/* Ledger View Arrow */}
                    <Link
                      href={`/customers/${cust.id}`}
                      className="p-2 text-slate-400 hover:text-slate-700 transition"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddCustomerModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </AppShell>
  );
}
