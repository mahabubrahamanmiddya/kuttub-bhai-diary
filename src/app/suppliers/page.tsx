"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { formatCurrency } from "@/lib/formatters";
import {
  Truck,
  Search,
  UserPlus,
  Phone,
  TrendingUp,
  ArrowRight,
  Download,
} from "lucide-react";
import { AddSupplierModal } from "@/components/suppliers/AddSupplierModal";

export default function SuppliersPage() {
  const { suppliers } = useDiary();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "payable" | "settled" | "advance">("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filteredSuppliers = suppliers.filter((supp) => {
    const matchesSearch =
      supp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supp.phone && supp.phone.includes(searchTerm)) ||
      (supp.address && supp.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "payable") return supp.current_balance > 0;
    if (filterType === "advance") return supp.current_balance < 0;
    if (filterType === "settled") return supp.current_balance === 0;

    return true;
  });

  const totalPayable = suppliers.reduce(
    (sum, s) => sum + (s.current_balance > 0 ? s.current_balance : 0),
    0
  );

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-rose-600" />
            <span>Suppliers (सप्लायर / व्यापारी)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Vendors aur raw material maal supply hisaab
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Naya Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-rose-200 uppercase tracking-wider">
            Total Supplier Payable (कुल देना है)
          </div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
            {formatCurrency(totalPayable)}
          </div>
          <div className="text-xs text-rose-100/80 mt-0.5">
            {suppliers.filter((s) => s.current_balance > 0).length} vyapariyon ko payment karni hai
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-rose-300" />
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
            placeholder="Search by supplier name, phone, or address..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
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
            Sabhi ({suppliers.length})
          </button>
          <button
            onClick={() => setFilterType("payable")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "payable"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            Paise Dene Hain ({suppliers.filter((s) => s.current_balance > 0).length})
          </button>
          <button
            onClick={() => setFilterType("settled")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "settled"
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100"
            }`}
          >
            Hisaab Barabar ({suppliers.filter((s) => s.current_balance === 0).length})
          </button>
          <button
            onClick={() => setFilterType("advance")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
              filterType === "advance"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Advance Diya ({suppliers.filter((s) => s.current_balance < 0).length})
          </button>
        </div>
      </div>

      {/* Supplier List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Koi Supplier nahi mila</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Naya vyapari jodne ke liye &quot;+ Naya Supplier&quot; button dabayein.
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-500 transition"
            >
              + Add Supplier
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSuppliers.map((supp) => {
              const isPayable = supp.current_balance > 0;
              const isAdvance = supp.current_balance < 0;

              return (
                <div
                  key={supp.id}
                  className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4"
                >
                  <Link
                    href={`/suppliers/${supp.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm group-hover:bg-blue-100 group-hover:text-blue-800 transition">
                      {supp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition truncate">
                        {supp.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {supp.phone && <span>{supp.phone}</span>}
                        {supp.address && <span>• {supp.address}</span>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div
                        className={`text-sm sm:text-base font-bold ${
                          isPayable
                            ? "text-rose-700"
                            : isAdvance
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {formatCurrency(Math.abs(supp.current_balance))}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {isPayable
                          ? "Dene Hain (You'll pay)"
                          : isAdvance
                          ? "Advance Diya Hua"
                          : "Hisaab Barabar"}
                      </div>
                    </div>

                    {supp.phone && (
                      <a
                        href={`tel:${supp.phone}`}
                        title="Call Supplier"
                        className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}

                    <Link
                      href={`/suppliers/${supp.id}`}
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

      <AddSupplierModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </AppShell>
  );
}
