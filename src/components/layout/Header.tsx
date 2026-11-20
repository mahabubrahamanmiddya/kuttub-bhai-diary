'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  Menu,
  CheckCircle2,
  Cloud,
  CloudOff,
  RefreshCw,
  LayoutGrid,
  List,
  User as UserIcon,
  Settings,
  LogOut,
  LogIn,
  BookOpen,
} from 'lucide-react';
import { useNotes } from '@/context/notes-context';
import { useAuth } from '@/context/auth-context';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
}

export function Header({ onToggleSidebar, onOpenSettings, onOpenAuth }: HeaderProps) {
  const {
    searchQuery,
    setSearchQuery,
    syncState,
    syncStatusMessage,
    isOnline,
    databaseWarning,
    viewMode,
    setViewMode,
    triggerSync,
  } = useNotes();
  const { user, signOut, isConfigured } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors md:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-none">
                My Diary
              </h1>
              <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                Keep Notes & Hisaab
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl px-1 sm:px-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-stone-400 dark:text-stone-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes, hisaab, customers..."
              className="w-full pl-10 pr-9 py-2 bg-stone-100 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100 placeholder-stone-500 dark:placeholder-stone-400 text-sm rounded-xl border border-transparent focus:border-amber-400 focus:bg-white dark:focus:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-full"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Sync Status & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sync indicator */}
          <button
            onClick={() => triggerSync()}
            title={databaseWarning || syncStatusMessage || (isOnline ? 'Synced' : 'Offline')}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              syncState === 'saving'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                : syncState === 'sync_failed'
                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                : syncState === 'waiting_sync' || databaseWarning
                ? 'bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                : syncState === 'offline' || !isOnline
                ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                : syncState === 'saved_cloud'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : syncState === 'saved_device'
                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {syncState === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden md:inline">Saving...</span>
              </>
            ) : syncState === 'sync_failed' ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Synchronization failed</span>
              </>
            ) : syncState === 'waiting_sync' || databaseWarning ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="hidden md:inline">Waiting for synchronization</span>
              </>
            ) : !isOnline || syncState === 'offline' ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden md:inline">Saved on device (Offline)</span>
              </>
            ) : syncState === 'saved_cloud' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Saved to cloud</span>
              </>
            ) : syncState === 'saved_device' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden md:inline">Saved on device</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden lg:inline">Saved on device</span>
              </>
            )}
          </button>

          {/* Grid / List switch */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            aria-label="Toggle view mode"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
            title="Settings & Cloud"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Account / Sign In */}
          <div className="relative">
            {user ? (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-800 dark:text-amber-200 text-xs font-bold hover:ring-2 hover:ring-amber-400/30 transition-all"
                aria-label="User account"
              >
                {user.user_metadata?.name?.[0]?.toUpperCase() ||
                  user.email?.[0]?.toUpperCase() ||
                  'U'}
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-sm transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Dropdown Menu */}
            {userMenuOpen && user && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 py-2 z-40 text-sm">
                  <div className="px-4 py-2 border-b border-stone-100 dark:border-stone-800">
                    <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {user.user_metadata?.name || 'Diary User'}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full px-4 py-2 text-left text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-stone-400" />
                    <span>Settings & Sync</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full px-4 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
