'use client';

import React, { useState } from 'react';
import {
  FileText,
  Pin,
  Archive,
  Trash2,
  Tag,
  Plus,
  Settings,
  X,
  FolderOpen,
  Trash,
} from 'lucide-react';
import { useNotes } from '@/context/notes-context';
import { ViewFilter, Label } from '@/types/diary';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenLabelModal: () => void;
}

export function Sidebar({ isOpen, onClose, onOpenSettings, onOpenLabelModal }: SidebarProps) {
  const { notes, labels, viewFilter, setViewFilter, deleteLabel } = useNotes();

  // Counts
  const activeNotesCount = notes.filter((n) => !n.is_deleted && !n.is_archived).length;
  const pinnedNotesCount = notes.filter((n) => !n.is_deleted && !n.is_archived && n.is_pinned).length;
  const archivedNotesCount = notes.filter((n) => !n.is_deleted && n.is_archived).length;
  const trashNotesCount = notes.filter((n) => n.is_deleted).length;

  const isCurrentView = (target: ViewFilter) => {
    if (typeof viewFilter === 'string' && typeof target === 'string') {
      return viewFilter === target;
    }
    if (typeof viewFilter === 'object' && typeof target === 'object') {
      return viewFilter.labelId === target.labelId;
    }
    return false;
  };

  const navItems = [
    {
      id: 'notes' as const,
      label: 'All Notes',
      icon: FileText,
      count: activeNotesCount,
    },
    {
      id: 'pinned' as const,
      label: 'Pinned',
      icon: Pin,
      count: pinnedNotesCount,
    },
    {
      id: 'archive' as const,
      label: 'Archive',
      icon: Archive,
      count: archivedNotesCount,
    },
    {
      id: 'trash' as const,
      label: 'Trash',
      icon: Trash2,
      count: trashNotesCount,
    },
  ];

  const content = (
    <div className="flex flex-col h-full py-4 text-stone-700 dark:text-stone-300">
      {/* Mobile Close Button */}
      <div className="flex items-center justify-between px-5 pb-3 md:hidden border-b border-stone-200 dark:border-stone-800">
        <span className="font-bold text-stone-900 dark:text-stone-100 text-base">Navigation</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Folders */}
      <div className="px-3 space-y-1 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentView(item.id);
          return (
            <button
              key={item.id}
              onClick={() => {
                setViewFilter(item.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${active ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    active
                      ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <hr className="my-4 border-stone-200 dark:border-stone-800 mx-4" />

      {/* Labels Section */}
      <div className="px-4 flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400 dark:text-stone-500">
          Labels / Categories
        </span>
        <button
          onClick={onOpenLabelModal}
          className="p-1 rounded-md text-stone-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-stone-800 transition-colors"
          title="Create new label"
          aria-label="Add label"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Labels List */}
      <div className="px-3 space-y-0.5 flex-1 overflow-y-auto">
        {labels.map((lbl) => {
          const active =
            typeof viewFilter === 'object' && viewFilter.labelId === lbl.id;
          const labelNotesCount = notes.filter(
            (n) =>
              !n.is_deleted &&
              !n.is_archived &&
              n.labels?.some((l) => l.id === lbl.id)
          ).length;

          return (
            <div
              key={lbl.id}
              className={`group flex items-center justify-between px-3.5 py-2 rounded-xl text-sm transition-all ${
                active
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <button
                onClick={() => {
                  setViewFilter({ labelId: lbl.id, labelName: lbl.name });
                  onClose();
                }}
                className="flex items-center gap-3 flex-1 text-left truncate"
              >
                <Tag
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: lbl.color || '#f59e0b' }}
                />
                <span className="truncate">{lbl.name}</span>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {labelNotesCount > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-amber-200/80 dark:bg-amber-900/80 text-amber-900'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500'
                    }`}
                  >
                    {labelNotesCount}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete label "${lbl.name}"? Notes won't be deleted.`)) {
                      deleteLabel(lbl.id);
                      if (active) setViewFilter('notes');
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-500 transition-opacity"
                  title="Delete label"
                  aria-label="Delete label"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {labels.length === 0 && (
          <div className="px-3 py-3 text-xs text-stone-400 italic">
            No labels created yet.
          </div>
        )}
      </div>

      {/* Footer / Settings Link */}
      <div className="px-3 pt-3 border-t border-stone-200 dark:border-stone-800 mt-auto">
        <button
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-100 transition-all"
        >
          <Settings className="w-4 h-4 text-stone-500" />
          <span>Settings & Backup</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16 border-r border-stone-200 dark:border-stone-800 bg-paper-50/50 dark:bg-stone-900/50">
        {content}
      </aside>

      {/* Mobile Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-stone-900 shadow-2xl z-50 flex flex-col">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
