"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  PlusCircle,
  HelpCircle,
  LogOut,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useDiary } from "@/context/diary-context";
import { useAuth } from "@/context/auth-context";
import { formatCurrency } from "@/lib/formatters";

interface SidebarProps {
  onOpenAddTxn: () => void;
}

export function Sidebar({ onOpenAddTxn }: SidebarProps) {
  const pathname = usePathname();
  const { overallSummary } = useDiary();
  const { signOut, user } = useAuth();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Customers (ग्राहक)", href: "/customers", icon: Users },
    { name: "Suppliers (सप्लायर)", href: "/suppliers", icon: Truck },
    { name: "Transactions (खाता बही)", href: "/transactions", icon: ArrowLeftRight },
    { name: "Reports (मुनाफा / हिसाब)", href: "/reports", icon: BarChart3 },
    { name: "Settings & Backup", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 min-h-screen p-4 justify-between">
      <div>
        {/* Quick Action Button */}
        <div className="mb-6">
          <button
            onClick={onOpenAddTxn}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-5 h-5" />
            <span>+ Add Transaction</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-800/40 text-emerald-300 border border-emerald-700/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Quick Outstanding Summary Box */}
        <div className="mt-8 p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Hisaab Snapshot
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Lene Hain (Recv):
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(overallSummary.total_receivable)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Dene Hain (Pay):
              </span>
              <span className="font-semibold text-white">
                {formatCurrency(overallSummary.total_payable)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / User & Logout */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "K"}
            </div>
            <div className="truncate">
              <div className="text-sm font-medium text-white truncate">{user?.name || "Kuttub Bhai"}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email || "brother@business.in"}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Logout"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
