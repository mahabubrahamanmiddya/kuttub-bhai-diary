"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDiary } from "@/context/diary-context";
import { Cloud, CloudOff, RefreshCw, X, ShieldCheck } from "lucide-react";

export function CloudNoticeBanner() {
  const { isCloudConnected } = useAuth();
  const { isOffline, pendingSyncCount, triggerSync, syncStatus } = useDiary();
  const [dismissed, setDismissed] = useState(false);

  if (isOffline) {
    return (
      <div className="bg-amber-600 text-white text-xs sm:text-sm px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <CloudOff className="w-4 h-4 animate-pulse flex-shrink-0" />
          <span>
            <strong>You are offline:</strong> Changes are saved safely on this device and will automatically sync when internet reconnects.
          </span>
        </div>
        {pendingSyncCount > 0 && (
          <span className="bg-amber-700 px-2 py-0.5 rounded text-xs whitespace-nowrap ml-2">
            {pendingSyncCount} pending sync
          </span>
        )}
      </div>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <div className="bg-blue-600 text-white text-xs sm:text-sm px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 flex-shrink-0 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
          <span>
            {pendingSyncCount} record(s) pending sync to cloud database.
          </span>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncStatus === "syncing"}
          className="bg-white text-blue-700 hover:bg-blue-50 font-medium px-3 py-1 rounded text-xs transition"
        >
          {syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
        </button>
      </div>
    );
  }

  if (!isCloudConnected && !dismissed) {
    return (
      <div className="bg-emerald-800 text-emerald-100 text-xs sm:text-sm px-4 py-2.5 flex items-center justify-between border-b border-emerald-700">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>
            <strong>Ready for Supabase Cloud:</strong> Paste your Supabase project keys in <code className="bg-emerald-950/60 px-1 py-0.5 rounded text-emerald-200">.env.local</code> to activate live cloud PostgreSQL replication. Currently operating with full local persistence.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-emerald-300 hover:text-white p-1 rounded transition ml-2"
          aria-label="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
