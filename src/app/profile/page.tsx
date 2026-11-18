"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/auth-context";
import { User, Mail, Building, KeyRound, LogOut, CheckCircle2 } from "lucide-react";

export default function ProfilePage() {
  const { user, business, resetPassword, signOut } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    await resetPassword(user.email);
    setIsLoading(false);
    setResetSent(true);
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto py-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">User Profile (प्रोफ़ाइल)</h1>
        <p className="text-xs sm:text-sm text-slate-500 mb-6">Aapki personal login aur security settings</p>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-2xl shadow-inner">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user?.name || "Business Owner"}</h2>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 mt-1">
                Owner / Admin
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" /> Business Name
              </span>
              <span className="font-semibold text-slate-900">{business?.business_name || "Mera Business"}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> Email
              </span>
              <span className="font-semibold text-slate-900">{user?.email || "-"}</span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> User ID
              </span>
              <span className="font-mono text-slate-600 text-[11px] truncate max-w-xs">{user?.id || "-"}</span>
            </div>
          </div>

          {/* Password Reset */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Security</h3>
            {resetSent ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Password reset link aapke email par bhej diya gaya hai.</span>
              </div>
            ) : (
              <button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                <span>{isLoading ? "Sending..." : "Send Password Reset Email"}</span>
              </button>
            )}
          </div>

          {/* Logout */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
