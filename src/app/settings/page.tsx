"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/auth-context";
import { useDiary } from "@/context/diary-context";
import { dataService } from "@/lib/data-service";
import { ExportService } from "@/lib/export-service";
import {
  Settings,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Download,
  Plus,
  RefreshCw,
  LogOut,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const { business, user, signOut, refreshBusiness } = useAuth();
  const { categories, transactions, customers, suppliers, overallSummary, triggerSync, syncStatus } =
    useDiary();

  const [bizName, setBizName] = useState(business?.business_name || "");
  const [phone, setPhone] = useState(business?.phone || "");
  const [email, setEmail] = useState(business?.email || "");
  const [address, setAddress] = useState(business?.address || "");

  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"expense" | "income">("expense");

  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [bizSuccess, setBizSuccess] = useState(false);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;
    setIsSavingBiz(true);
    setBizSuccess(false);

    try {
      await dataService.updateBusiness({
        id: business.id,
        business_name: bizName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
      await refreshBusiness();
      setBizSuccess(true);
      setTimeout(() => setBizSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !newCatName.trim()) return;

    try {
      await dataService.createCategory({
        business_id: business.id,
        name: newCatName.trim(),
        type: newCatType,
        is_default: false,
      });
      setNewCatName("");
      // Trigger context reload
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-700" />
          <span>Settings & Backup (सेटिंग्स और बैकअप)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Dukan profile, categories, data backup aur account settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column: Business Profile Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Profile */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Business Details (दुकान की जानकारी)</h2>
                <p className="text-xs text-slate-500">Bill aur statements par aane wali details</p>
              </div>
            </div>

            {bizSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Business details safalta-purvak update ho gayi!</span>
              </div>
            )}

            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business / Dukan Ka Naam *
                </label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  placeholder="e.g. Kuttub Bhai Diary"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. contact@business.in"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dukan / Godown Ka Pata (Address)
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shop No., Market, City..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    disabled
                    value="INR (₹) - Indian Rupee"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    disabled
                    value="Asia/Kolkata (IST)"
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingBiz}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
                >
                  {isSavingBiz ? "Saving..." : "Save Business Details"}
                </button>
              </div>
            </form>
          </div>

          {/* Manage Categories */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Expense Categories (खर्च श्रेणियां)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Apni dukan ke anusar custom kharcha category jodein
            </p>

            {/* Existing Categories */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                >
                  {c.name}
                </span>
              ))}
            </div>

            {/* Add Category Form */}
            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nayi category ka naam (e.g. Packing material)"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              >
                <option value="expense">Expense (खर्च)</option>
                <option value="income">Income (आय)</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Export, Cloud & Logout */}
        <div className="space-y-6">
          {/* Data Export & Backup Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Backup & Export (डेटा बैकअप)</h3>
                <p className="text-[11px] text-slate-500">Apne hisaab ki offline copy download karein</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => ExportService.exportTransactionsCSV(transactions)}
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-between transition"
              >
                <span>Export Transactions (CSV)</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => ExportService.exportCustomersCSV(customers)}
                className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-between transition"
              >
                <span>Export Customers (CSV)</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => {
                  if (business) {
                    ExportService.exportBusinessReportPDF(
                      business,
                      overallSummary,
                      transactions,
                      "Full Ledger Backup"
                    );
                  }
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between shadow-sm transition"
              >
                <span>Download Complete PDF Report</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cloud Sync Status */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Cloud Sync & Security</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Row Level Security ke sath aapka data cloud PostgreSQL database par surakshit rehta hai.
            </p>

            <button
              onClick={triggerSync}
              disabled={syncStatus === "syncing"}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-emerald-600 ${
                  syncStatus === "syncing" ? "animate-spin" : ""
                }`}
              />
              <span>{syncStatus === "syncing" ? "Syncing with Cloud..." : "Force Sync Now"}</span>
            </button>
          </div>

          {/* Account & Logout */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Account</h3>
            <div className="text-xs text-slate-500 mb-4">
              Logged in as: <strong className="text-slate-800">{user?.email || "brother@business.in"}</strong>
            </div>

            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout from this Device</span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
