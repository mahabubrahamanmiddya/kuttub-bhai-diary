'use client';

import React, { useState } from 'react';
import { X, Tag, Plus, Trash2 } from 'lucide-react';
import { useNotes } from '@/context/notes-context';

interface LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#6366F1', // Indigo
];

export function LabelModal({ isOpen, onClose }: LabelModalProps) {
  const { labels, createLabel, deleteLabel } = useNotes();
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    await createLabel(newLabelName.trim(), selectedColor);
    setNewLabelName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 z-10">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Manage Labels
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create Form */}
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Enter new label (e.g. Suppliers, Invoices)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm border border-transparent focus:border-amber-400 focus:bg-white dark:focus:bg-stone-900 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newLabelName.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Color Presets */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-stone-400">Color:</span>
            <div className="flex items-center gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    selectedColor === c ? 'ring-2 ring-stone-900 dark:ring-white scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Existing Labels List */}
        <div className="mt-6 space-y-1.5 max-h-60 overflow-y-auto pr-1">
          <p className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2">
            Existing Labels ({labels.length})
          </p>
          {labels.map((lbl) => (
            <div
              key={lbl.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: lbl.color || '#f59e0b' }}
                />
                <span className="font-medium text-stone-800 dark:text-stone-200">
                  {lbl.name}
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete label "${lbl.name}"?`)) {
                    deleteLabel(lbl.id);
                  }
                }}
                className="p-1 text-stone-400 hover:text-rose-500 rounded-lg transition-colors"
                title="Delete label"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {labels.length === 0 && (
            <p className="text-xs text-stone-400 italic py-2">No labels created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
