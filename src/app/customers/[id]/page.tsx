"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { useDiary } from "@/context/diary-context";
import { useAuth } from "@/context/auth-context";
import { buildCustomerLedger } from "@/lib/accounting";
import { formatCurrency, formatDate, generateWhatsAppReminderUrl } from "@/lib/formatters";
import { ExportService } from "@/lib/export-service";
import {
  ArrowLeft,
  Phone,
  Share2,
  Download,
  Trash2,
  ShoppingBag,
  ArrowDownLeft,
  User,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { DeleteConfirmModal } from "@/components/common/DeleteConfirmModal";
import { TransactionType } from "@/types/database";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const { customers, transactions, deleteCustomer, deleteTransaction } = useDiary();
  const { business } = useAuth();

  const customer = customers.find((c) => c.id === customerId);

  // Modal states
  const [modalType, setModalType] = useState<TransactionType | null>(null);
  const [showDeleteCustomer, setShowDeleteCustomer] = useState(false);
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!customer) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Customer nahi mila</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Yeh customer delete ho chuka hai ya maujood nahi hai.
          </p>
          <Link
            href="/customers"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
          >
            ← Wapas Customers List Par Jayein
          </Link>
        </div>
      </AppShell>
    );
  }

  // Calculate detailed chronological ledger
  const ledger = buildCustomerLedger(customer, transactions);

  const handleDeleteCust = async () => {
    setIsDeleting(true);
    await deleteCustomer(customer.id);
    setIsDeleting(false);
    setShowDeleteCustomer(false);
    router.push("/customers");
  };

  const handleDeleteTxn = async () => {
    if (!deleteTxnId) return;
    setIsDeleting(true);
    await deleteTransaction(deleteTxnId);
    setIsDeleting(false);
    setDeleteTxnId(null);
  };

  const handleExportPDF = () => {
    if (!business) return;
    ExportService.exportCustomerLedgerPDF(business, customer, transactions);
  };

  return (
    <AppShell>
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Sabhi Customers</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>PDF Ledger</span>
          </button>

          <button
            onClick={() => setShowDeleteCustomer(true)}
            className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
            title="Delete Customer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl shadow-inner">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{customer.name}</h1>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                {customer.phone && <span>Mobile: {customer.phone}</span>}
                {customer.address && <span>• Pata: {customer.address}</span>}
              </div>
            </div>
          </div>

          {/* Quick Action Contact Pills */}
          <div className="flex items-center gap-2.5">
            {customer.phone && (
              <>
                <a
                  href={`tel:${customer.phone}`}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>

                <a
                  href={generateWhatsAppReminderUrl({
                    phone: customer.phone,
                    customerName: customer.name,
                    amount: customer.current_balance,
                    businessName: business?.business_name || "Mera Business",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp Reminder</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* 3 Metric Cards for Customer */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Total Purchase (कुल बिक्री)</div>
            <div className="text-base sm:text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(ledger.totalDebit)}
            </div>
          </div>

          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium">Total Paid (कुल जमा)</div>
            <div className="text-base sm:text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(ledger.totalCredit)}
            </div>
          </div>

          <div
            className={`p-3 sm:p-4 rounded-xl border ${
              ledger.finalBalance > 0
                ? "bg-emerald-50/80 border-emerald-200"
                : ledger.finalBalance < 0
                ? "bg-rose-50/80 border-rose-200"
                : "bg-slate-50 border-slate-100"
            }`}
          >
            <div className="text-[11px] sm:text-xs font-medium text-slate-600">
              {ledger.finalBalance > 0
                ? "Lene Hain (Baki)"
                : ledger.finalBalance < 0
                ? "Advance (Dene Hain)"
                : "Net Balance"}
            </div>
            <div
              className={`text-base sm:text-xl font-bold mt-1 ${
                ledger.finalBalance > 0
                  ? "text-emerald-700"
                  : ledger.finalBalance < 0
                  ? "text-rose-700"
                  : "text-slate-800"
              }`}
            >
              {formatCurrency(Math.abs(ledger.finalBalance))}
            </div>
          </div>
        </div>

        {/* Action Buttons: Add Udhaar Sale vs Add Payment */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => setModalType("sale")}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ Maal Diya (Udhaar Sale)</span>
          </button>

          <button
            onClick={() => setModalType("customer_payment")}
            className="w-full py-3 px-4 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Paise Aaye (Payment Jama)</span>
          </button>
        </div>
      </div>

      {/* Complete Customer Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Complete Ledger History (खाता बही)</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {ledger.entries.length} Entries
          </span>
        </div>

        {ledger.entries.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Abhi tak koi transaction entry nahi hai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Particulars / Details</th>
                  <th className="py-3 px-4 text-right">Debit (+) / Sale</th>
                  <th className="py-3 px-4 text-right">Credit (-) / Paid</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                      {formatDate(entry.date)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{entry.description}</div>
                      {entry.payment_method && (
                        <div className="text-[10px] text-slate-400">
                          Method: {entry.payment_method}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-800">
                      {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-emerald-700">
                      {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold">
                      <span
                        className={
                          entry.balance > 0
                            ? "text-emerald-700"
                            : entry.balance < 0
                            ? "text-rose-700"
                            : "text-slate-600"
                        }
                      >
                        {formatCurrency(Math.abs(entry.balance))}
                        {entry.balance > 0 ? " Dr" : entry.balance < 0 ? " Cr" : ""}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {entry.id !== "opening-balance" && (
                        <button
                          onClick={() => setDeleteTxnId(entry.id)}
                          title="Delete entry"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {modalType && (
        <AddTransactionModal
          isOpen={Boolean(modalType)}
          onClose={() => setModalType(null)}
          defaultType={modalType}
          defaultCustomerId={customer.id}
        />
      )}

      {/* Delete Customer Confirmation */}
      <DeleteConfirmModal
        isOpen={showDeleteCustomer}
        onClose={() => setShowDeleteCustomer(false)}
        onConfirm={handleDeleteCust}
        title={`Delete customer "${customer.name}"?`}
        description="Yeh customer baki records me safe rahega aur audit trail bna rahega."
        confirmLabel="Yes, Delete Customer"
        isDeleting={isDeleting}
      />

      {/* Delete Transaction Confirmation */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTxnId)}
        onClose={() => setDeleteTxnId(null)}
        onConfirm={handleDeleteTxn}
        title="Delete this transaction?"
        description="Yeh hisaab soft-delete hoga aur customer balance se hat jayega."
        confirmLabel="Yes, Delete Hisaab"
        isDeleting={isDeleting}
      />
    </AppShell>
  );
}
