"use client";

import React, { useState } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { CloudNoticeBanner } from "../common/CloudNoticeBanner";
import { AddTransactionModal } from "../transactions/AddTransactionModal";
import { AddCustomerModal } from "../customers/AddCustomerModal";
import { AddSupplierModal } from "../suppliers/AddSupplierModal";
import { TransactionType } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const [txnDefaultType, setTxnDefaultType] = useState<TransactionType>("sale");
  const [txnCustomerId, setTxnCustomerId] = useState<string | undefined>(undefined);
  const [txnSupplierId, setTxnSupplierId] = useState<string | undefined>(undefined);

  const [isAddCustOpen, setIsAddCustOpen] = useState(false);
  const [isAddSuppOpen, setIsAddSuppOpen] = useState(false);

  const handleOpenAddTxn = (type?: TransactionType, customerId?: string, supplierId?: string) => {
    if (type) setTxnDefaultType(type);
    setTxnCustomerId(customerId);
    setTxnSupplierId(supplierId);
    setIsAddTxnOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Banner for Cloud Sync / Offline notice */}
      <CloudNoticeBanner />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar onOpenAddTxn={() => handleOpenAddTxn("sale")} />

        {/* Content Column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Navbar */}
          <Navbar onOpenAddTxn={() => handleOpenAddTxn("sale")} />

          {/* Page Content */}
          <main className="flex-1 pb-24 md:pb-12 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenAddTxn={() => handleOpenAddTxn("sale")} />

      {/* Global Modals */}
      <AddTransactionModal
        isOpen={isAddTxnOpen}
        onClose={() => setIsAddTxnOpen(false)}
        defaultType={txnDefaultType}
        defaultCustomerId={txnCustomerId}
        defaultSupplierId={txnSupplierId}
      />

      <AddCustomerModal
        isOpen={isAddCustOpen}
        onClose={() => setIsAddCustOpen(false)}
      />

      <AddSupplierModal
        isOpen={isAddSuppOpen}
        onClose={() => setIsAddSuppOpen(false)}
      />
    </div>
  );
}
