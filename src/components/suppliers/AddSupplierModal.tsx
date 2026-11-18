"use client";

import React, { useState } from "react";
import { useDiary } from "@/context/diary-context";
import { X, Truck, Phone, MapPin, CheckCircle2 } from "lucide-react";

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddSupplierModal({ isOpen, onClose }: AddSupplierModalProps) {
  const { addSupplier } = useDiary();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [balanceType, setBalanceType] = useState<"payable" | "receivable">("payable");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Kripya Supplier ka naam bharein.");
      return;
    }

    const opBal = openingBalance ? parseFloat(openingBalance) : 0;
    if (isNaN(opBal) || opBal < 0) {
      setErrorMsg("Opening balance valid number hona chahiye.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addSupplier({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        opening_balance: opBal,
        opening_balance_type: balanceType,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Supplier jodne me samasya aayi.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg("Supplier safalta-purvak jud gaya!");
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
        setName("");
        setPhone("");
        setAddress("");
        setNotes("");
        setOpeningBalance("");
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add supplier");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">+ Naya Supplier Jodein</h2>
              <p className="text-xs text-slate-500">Vyapari / Vendor profile banayein</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Firm Ka Naam *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ABC Wholesale Traders"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mobile / Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9123456780"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Opening Balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purana Baki (Opening Balance)
            </label>
            <div className="relative mb-2">
              <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="0"
                step="any"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Balance Type Radio */}
            {openingBalance && parseFloat(openingBalance) > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setBalanceType("payable")}
                  className={`p-2 rounded-lg border text-xs text-left font-medium transition ${
                    balanceType === "payable"
                      ? "bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <div className="font-semibold text-rose-700">Paise Dene Hain</div>
                  <div className="text-[10px] text-slate-500">Supplier ko baki dena hai</div>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceType("receivable")}
                  className={`p-2 rounded-lg border text-xs text-left font-medium transition ${
                    balanceType === "receivable"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  <div className="font-semibold text-emerald-700">Advance Diya Hua Hai</div>
                  <div className="text-[10px] text-slate-500">Supplier ke paas jama hai</div>
                </button>
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pata (Address - Optional)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Station Road, Godown Area"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
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
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition active:scale-[0.98]"
            >
              {isSubmitting ? "Saving..." : "Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
