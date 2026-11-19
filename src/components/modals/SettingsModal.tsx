'use client';

import React, { useState } from 'react';
import {
  X,
  Settings,
  Cloud,
  CheckCircle2,
  Database,
  Download,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  LogOut,
  Info,
} from 'lucide-react';
import { useNotes } from '@/context/notes-context';
import { useAuth } from '@/context/auth-context';
import { loadSyncQueue } from '@/lib/storage/offline-store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export function SettingsModal({ isOpen, onClose, onOpenAuth }: SettingsModalProps) {
  const { notes, triggerSync, syncState, syncStatusMessage } = useNotes();
  const { user, signOut, isConfigured } = useAuth();
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const queue = loadSyncQueue();

  const handleExportJSON = () => {
    setExporting(true);
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `my-diary-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setExporting(false);
  };

  const handleExportText = () => {
    let output = `MY DIARY - EXPORTED BUSINESS & PERSONAL NOTES\nGenerated: ${new Date().toLocaleString()}\n========================================\n\n`;
    notes
      .filter((n) => !n.is_deleted)
      .forEach((note, index) => {
        output += `[Note ${index + 1}] ${note.title || 'Untitled'}\n`;
        output += `Date: ${new Date(note.updated_at).toLocaleDateString()}\n`;
        if (note.labels && note.labels.length > 0) {
          output += `Labels: ${note.labels.map((l) => l.name).join(', ')}\n`;
        }
        output += `----------------------------------------\n`;
        output += `${note.content}\n\n`;
        output += `========================================\n\n`;
      });

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(output);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `my-diary-notes-${new Date().toISOString().slice(0, 10)}.txt`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 dark:border-stone-800 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Settings & Cloud Backup
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* User Account Section */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60">
            <span className="text-xs font-bold uppercase text-stone-400 tracking-wider block mb-2">
              Account
            </span>
            {user ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                    {user.user_metadata?.name || 'Brother / Owner'}
                  </p>
                  <p className="text-xs text-stone-500">{user.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  You are currently using local storage. Sign in to synchronize your notes across all devices.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shrink-0 ml-3"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* Supabase PostgreSQL Status */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase text-stone-400 tracking-wider">
                  PostgreSQL Cloud Database
                </span>
              </div>
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full">
                  Local / Offline Mode
                </span>
              )}
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {isConfigured
                ? 'Your notes are securely stored in Supabase PostgreSQL with Row Level Security (RLS). Only your account can view your business notes.'
                : 'Connect your Supabase project keys in .env.local (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) to synchronize notes directly with cloud PostgreSQL.'}
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-stone-500">
                Pending sync items: <strong>{queue.length}</strong>
              </div>
              <button
                onClick={() => triggerSync()}
                disabled={syncState === 'saving'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncState === 'saving' ? 'animate-spin' : ''}`}
                />
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          {/* Backup & Export Options */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60 space-y-3">
            <span className="text-xs font-bold uppercase text-stone-400 tracking-wider block">
              Download Offline Backup
            </span>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Download all your notes and hisaab entries directly to your phone or computer anytime.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleExportText}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-500 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download as Text (.txt)</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-500 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Full Backup (.json)</span>
              </button>
            </div>
          </div>

          {/* Install on Mobile App info */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Install as Mobile App (PWA)</p>
              <p className="leading-relaxed">
                On your phone (iPhone or Android), tap <strong>Share</strong> or <strong>Three Dots ⋮</strong> and select <strong>&quot;Add to Home Screen&quot;</strong>. It will install like a native app with offline support!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
