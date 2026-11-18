"use client";

import React, { useState, useEffect } from "react";
import { useDiary } from "@/context/diary-context";
import { TransactionType, PaymentMethod } from "@/types/database";
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  TrendingUp,
  Receipt,
  UserPlus,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType | null;
  defaultCustomerId?: string | null;
  defaultSupplierId?: string | null;
}

export function AddTransactionModal({
  isOpen,
  onClose,
  defaultType = "sale",
  defaultCustomerId,
  defaultSupplierId,
}: AddTransactionModalProps) {
  const { customers, suppliers, categories, addTransaction, addCustomer, addSupplier } = useDiary();

  const [txnType, setTxnType] = useState<TransactionType>(defaultType || "sale");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState<string>(defaultCustomerId || "");
  const [supplierId, setSupplierId] = useState<string>(defaultSupplierId || "");
  const [categoryName, setCategoryName] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [description, setDescription] = useState<string>("");

  // Quick inline creation
  const [showQuickAddCust, setShowQuickAddCust] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [quickCustPhone, setQuickCustPhone] = useState("");

  const [showQuickAddSupp, setShowQuickAddSupp] = useState(false);
  const [quickSuppName, setQuickSuppName] = useState("");
  const [quickSuppPhone, setQuickSuppPhone] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTxnType(defaultType || "sale");
      if (defaultCustomerId) setCustomerId(defaultCustomerId);
      if (defaultSupplierId) setSupplierId(defaultSupplierId);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, defaultType, defaultCustomerId, defaultSupplierId]);

  if (!isOpen) return null;

  // Type meta configurations
  const typeConfigs = [
    {
      type: "sale" as TransactionType,
      label: "Bikri (Udhaar Sale)",
      subtext: "Customer se paise lene hain",
      icon: ArrowUpRight,
      color: "bg-emerald-600 text-white",
      activeTab: "bg-emerald-600 text-white border-emerald-600",
    },
    {
      type: "customer_payment" as TransactionType,
      label: "Jama (Customer Payment)",
      subtext: "Customer ne paise diye",
      icon: ArrowDownLeft,
      color: "bg-green-600 text-white",
      activeTab: "bg-green-600 text-white border-green-600",
    },
    {
      type: "purchase" as TransactionType,
      label: "Kharid (Supplier Purchase)",
      subtext: "Supplier ko paise dene hain",
      icon: ShoppingBag,
      color: "bg-rose-600 text-white",
      activeTab: "bg-rose-600 text-white border-rose-600",
    },
    {
      type: "supplier_payment" as TransactionType,
      label: "Bhugtan (Supplier Payment)",
      subtext: "Supplier ko paise diye",
      icon: ArrowUpRight,
      color: "bg-orange-600 text-white",
      activeTab: "bg-orange-600 text-white border-orange-600",
    },
    {
      type: "expense" as TransactionType,
      label: "Kharcha (Business Expense)",
      subtext: "Kiraya, Bijli, Salary, Chai, etc.",
      icon: Receipt,
      color: "bg-red-700 text-white",
      activeTab: "bg-red-700 text-white border-red-700",
    },
    {
      type: "income" as TransactionType,
      label: "Aamadani (Direct Income / Cash)",
      subtext: "Direct cash sales ya commission",
      icon: TrendingUp,
      color: "bg-teal-600 text-white",
      activeTab: "bg-teal-600 text-white border-teal-600",
    },
  ];

  const currentConfig = typeConfigs.find((c) => c.type === txnType)!;

  const handleQuickCreateCustomer = async () => {
    if (!quickCustName.trim()) return;
    const res = await addCustomer({
      name: quickCustName.trim(),
      phone: quickCustPhone.trim() || undefined,
    });
    if (res.success && res.customer) {
      setCustomerId(res.customer.id);
      setShowQuickAddCust(false);
      setQuickCustName("");
      setQuickCustPhone("");
    }
  };

  const handleQuickCreateSupplier = async () => {
    if (!quickSuppName.trim()) return;
    const res = await addSupplier({
      name: quickSuppName.trim(),
      phone: quickSuppPhone.trim() || undefined,
    });
    if (res.success && res.supplier) {
      setSupplierId(res.supplier.id);
      setShowQuickAddSupp(false);
      setQuickSuppName("");
      setQuickSuppPhone("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Kripya sahi raqam (Amount) bharein.");
      return;
    }

    // Validation for specific types
    if ((txnType === "sale" || txnType === "customer_payment") && !customerId) {
      setErrorMsg("Kripya Customer select karein.");
      return;
    }

    if ((txnType === "purchase" || txnType === "supplier_payment") && !supplierId) {
      setErrorMsg("Kripya Supplier select karein.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCat = categories.find((c) => c.name === categoryName);

      const res = await addTransaction({
        transaction_type: txnType,
        amount: numAmount,
        transaction_date: new Date(date).toISOString(),
        customer_id: customerId || null,
        supplier_id: supplierId || null,
        category_id: selectedCat?.id || null,
        category_name: categoryName || null,
        payment_method: paymentMethod,
        description: description.trim() || null,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Transaction save nahi ho saka.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg(
        res.isLocalOnly
          ? "Hisaab local save ho gaya (Online aane par sync hoga)."
          : "Hisaab safalta-purvak cloud par save ho gaya!"
      );

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        // Reset form
        setAmount("");
        setDescription("");
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">+ Naya Hisaab (Add Transaction)</h2>
            <p className="text-xs text-slate-500">{currentConfig.subtext}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Transaction Type Selector Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
              Hisaab Ka Prakar (Type)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {typeConfigs.map((cfg) => {
                const isSelected = txnType === cfg.type;
                return (
                  <button
                    key={cfg.type}
                    type="button"
                    onClick={() => {
                      setTxnType(cfg.type);
                      setErrorMsg(null);
                    }}
                    className={`flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? `${cfg.activeTab} shadow-sm font-semibold ring-2 ring-emerald-500/30`
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{cfg.label.split("(")[0]}</span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? "text-white/80" : "text-slate-500"}`}>
                      {cfg.label.includes("(") ? `(${cfg.label.split("(")[1]}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Raqam (Amount) *
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-2xl">
                ₹
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-2xl sm:text-3xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
            {amount && !isNaN(parseFloat(amount)) && (
              <p className="text-xs text-emerald-700 font-medium mt-1">
                Amount: {formatCurrency(parseFloat(amount))}
              </p>
            )}
          </div>

          {/* Customer Selection (for Sale, Customer Payment) */}
          {(txnType === "sale" || txnType === "customer_payment") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Customer (Grahak / Khaatedar) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickAddCust(!showQuickAddCust)}
                  className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Naya Customer</span>
                </button>
              </div>

              {showQuickAddCust ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 mb-2">
                  <div className="text-xs font-semibold text-emerald-900">Naya Customer Jodein</div>
                  <input
                    type="text"
                    placeholder="Customer Ka Naam *"
                    value={quickCustName}
                    onChange={(e) => setQuickCustName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-900 focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number (Optional)"
                    value={quickCustPhone}
                    onChange={(e) => setQuickCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-900 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCust(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreateCustomer}
                      className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                    >
                      Save Customer
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  <option value="">-- Customer Chunein --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} - Balance: {formatCurrency(c.current_balance)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Supplier Selection (for Purchase, Supplier Payment) */}
          {(txnType === "purchase" || txnType === "supplier_payment") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Supplier (Vyapari / Vendor) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickAddSupp(!showQuickAddSupp)}
                  className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Naya Supplier</span>
                </button>
              </div>

              {showQuickAddSupp ? (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 mb-2">
                  <div className="text-xs font-semibold text-emerald-900">Naya Supplier Jodein</div>
                  <input
                    type="text"
                    placeholder="Supplier Ka Naam *"
                    value={quickSuppName}
                    onChange={(e) => setQuickSuppName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-900 focus:outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number (Optional)"
                    value={quickSuppPhone}
                    onChange={(e) => setQuickSuppPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm text-slate-900 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupp(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreateSupplier}
                      className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
                    >
                      Save Supplier
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  <option value="">-- Supplier Chunein --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""} - Payable: {formatCurrency(s.current_balance)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Category Selector (for Expense or Income) */}
          {(txnType === "expense" || txnType === "income") && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Category (खर्च / आय का प्रकार)
              </label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              >
                <option value="">-- Category Chunein --</option>
                {categories
                  .filter((cat) => cat.type === txnType || cat.type === "both")
                  .map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Date & Payment Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Tarikh (Date)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Bhugtan Madhyam (Payment Method)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              >
                <option value="Cash">Cash (नकद)</option>
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                <option value="Card">Card</option>
                <option value="Other">Other (अन्य)</option>
              </select>
            </div>
          </div>

          {/* Description / Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Vivaran / Note (Description)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jaise: Bill No. 120, 2 Bora Cheeni, Transport bhada..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all active:scale-[0.98] ${
                currentConfig.color
              } ${isSubmitting ? "opacity-75 cursor-wait" : ""}`}
            >
              {isSubmitting ? "Saving Hisaab..." : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
