'use client';

import React from 'react';
import { FileText, Pin, Tag, Settings, Plus } from 'lucide-react';
import { useNotes } from '@/context/notes-context';
import { ViewFilter } from '@/types/diary';

interface BottomNavProps {
  onOpenSettings: () => void;
  onOpenLabelModal: () => void;
}

export function BottomNav({ onOpenSettings, onOpenLabelModal }: BottomNavProps) {
  const { viewFilter, setViewFilter, createNote } = useNotes();

  const isCurrent = (target: ViewFilter) => {
    if (typeof viewFilter === 'string' && typeof target === 'string') {
      return viewFilter === target;
    }
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 dark:bg-stone-900/95 backdrop-blur-lg border-t border-stone-200 dark:border-stone-800 pb-safe">
      <div className="flex items-center justify-around h-16 px-2 relative max-w-lg mx-auto">
        {/* Notes */}
        <button
          onClick={() => setViewFilter('notes')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isCurrent('notes')
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Notes</span>
        </button>

        {/* Pinned */}
        <button
          onClick={() => setViewFilter('pinned')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isCurrent('pinned')
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
          }`}
        >
          <Pin className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Pinned</span>
        </button>

        {/* Center Floating + Action Button */}
        <div className="flex items-center justify-center flex-1">
          <button
            onClick={() => createNote()}
            className="w-13 h-13 -mt-6 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-amber-500/40 border-4 border-white dark:border-stone-900 transition-all"
            aria-label="Create note"
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </button>
        </div>

        {/* Labels */}
        <button
          onClick={onOpenLabelModal}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            typeof viewFilter === 'object'
              ? 'text-amber-600 dark:text-amber-400 font-semibold'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800'
          }`}
        >
          <Tag className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Labels</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center flex-1 py-1 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Settings</span>
        </button>
      </div>
    </nav>
  );
}
