"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Truck, ArrowLeftRight, BarChart3, Plus } from "lucide-react";

interface BottomNavProps {
  onOpenAddTxn: () => void;
}

export function BottomNav({ onOpenAddTxn }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Add", isAction: true },
    { label: "Suppliers", href: "/suppliers", icon: Truck },
    { label: "Reports", href: "/reports", icon: BarChart3 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1 safe-area-bottom">
      <div className="flex items-center justify-around relative">
        {navItems.map((item, index) => {
          if (item.isAction) {
            return (
              <div key="action-fab" className="-top-5 relative flex flex-col items-center">
                <button
                  onClick={onOpenAddTxn}
                  aria-label="Naya Hisaab jodein"
                  className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-700/30 border-4 border-white transition-all"
                >
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </button>
                <span className="text-[10px] font-medium text-emerald-800 mt-0.5">
                  + Hisaab
                </span>
              </div>
            );
          }

          const Icon = item.icon!;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href!));

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg transition-colors ${
                isActive
                  ? "text-emerald-700 font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`} />
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
