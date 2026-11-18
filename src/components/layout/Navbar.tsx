"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useDiary } from "@/context/diary-context";
import { BookOpen, Cloud, CloudOff, RefreshCw, User, Settings, Plus } from "lucide-react";

export function Navbar({ onOpenAddTxn }: { onOpenAddTxn?: () => void }) {
  const { business, user } = useAuth();
  const { isOffline, pendingSyncCount, syncStatus, triggerSync } = useDiary();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
              {business?.business_name || "Kuttub Bhai Diary"}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium">Digital Business Hisaab</div>
          </div>
        </Link>

        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Cloud Sync Status Indicator */}
          <button
            onClick={triggerSync}
            title={
              isOffline
                ? "Offline - Saved on device"
                : pendingSyncCount > 0
                ? `${pendingSyncCount} records waiting to sync`
                : "Cloud Synced & Protected"
            }
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              isOffline
                ? "bg-amber-950/40 border-amber-600/40 text-amber-300"
                : pendingSyncCount > 0
                ? "bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/40"
                : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {isOffline ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline</span>
              </>
            ) : pendingSyncCount > 0 ? (
              <>
                <RefreshCw
                  className={`w-3.5 h-3.5 text-blue-400 ${syncStatus === "syncing" ? "animate-spin" : ""}`}
                />
                <span>Sync ({pendingSyncCount})</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cloud Synced</span>
              </>
            )}
          </button>

          {/* Desktop Add Transaction CTA */}
          {onOpenAddTxn && (
            <button
              onClick={onOpenAddTxn}
              className="hidden md:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-3.5 py-2 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Naya Hisaab</span>
            </button>
          )}

          {/* Settings Link */}
          <Link
            href="/settings"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Settings & Export"
          >
            <Settings className="w-5 h-5" />
          </Link>

          {/* Profile / Account link */}
          <Link
            href="/profile"
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
            title={user?.name || "My Account"}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-300 border border-slate-600">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
