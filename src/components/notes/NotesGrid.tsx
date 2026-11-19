'use client';

import React from 'react';
import { NoteCard } from './NoteCard';
import { useNotes } from '@/context/notes-context';
import { Note } from '@/types/diary';
import {
  Pin,
  FileText,
  Archive,
  Trash2,
  Tag,
  Search,
  Plus,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

interface NotesGridProps {
  onOpenNote: (note: Note) => void;
  onOpenCreateModal: () => void;
}

export function NotesGrid({ onOpenNote, onOpenCreateModal }: NotesGridProps) {
  const { notes, viewFilter, searchQuery, viewMode, emptyTrash, createNote } = useNotes();

  // Filter notes based on active view and search
  const filteredNotes = notes.filter((note) => {
    // 1. Search Query filter (matches title, content, or labels)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      const matchLabel = note.labels?.some((l) => l.name.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchLabel) {
        return false;
      }
    }

    // 2. View Filter
    if (viewFilter === 'trash') {
      return note.is_deleted;
    }

    // Any non-trash view ignores deleted notes
    if (note.is_deleted) return false;

    if (viewFilter === 'archive') {
      return note.is_archived;
    }

    // All active views ignore archived notes
    if (note.is_archived) return false;

    if (viewFilter === 'pinned') {
      return note.is_pinned;
    }

    if (typeof viewFilter === 'object' && viewFilter.labelId) {
      return note.labels?.some((l) => l.id === viewFilter.labelId);
    }

    // Default 'notes' view: all unarchived, undeleted notes
    return true;
  });

  // Separate pinned and unpinned if in standard 'notes' view without search
  const isStandardNotesView = viewFilter === 'notes' && !searchQuery.trim();
  const pinnedNotes = isStandardNotesView ? filteredNotes.filter((n) => n.is_pinned) : [];
  const otherNotes = isStandardNotesView ? filteredNotes.filter((n) => !n.is_pinned) : filteredNotes;

  const isTrash = viewFilter === 'trash';
  const isArchive = viewFilter === 'archive';

  // Grid / List class
  const containerClass =
    viewMode === 'list'
      ? 'flex flex-col gap-3 max-w-3xl mx-auto'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4';

  return (
    <div className="flex-1 pb-24 md:pb-12 pt-4 px-3 sm:px-6 max-w-7xl mx-auto w-full">
      {/* Google Keep style Quick "Take a note..." Bar (Desktop & Tablet) */}
      {viewFilter === 'notes' && !searchQuery && (
        <div className="max-w-2xl mx-auto mb-8 hidden sm:block">
          <div
            onClick={onOpenCreateModal}
            className="w-full bg-white dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700/80 rounded-2xl p-3.5 px-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
          >
            <span className="text-stone-400 dark:text-stone-500 font-medium text-sm">
              Take a note or write daily hisaab...
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createNote({ is_checklist: true });
                }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700"
                title="New checklist"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trash Top Notice & Empty Trash Button */}
      {isTrash && (
        <div className="mb-6 p-4 rounded-2xl bg-stone-100 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-stone-700 dark:text-stone-300">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-stone-500 shrink-0" />
            <span className="text-sm">
              Notes in Trash will be kept here until you delete them permanently.
            </span>
          </div>
          {filteredNotes.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Empty trash? All deleted notes will be permanently lost.')) {
                  emptyTrash();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
            >
              Empty Trash Now
            </button>
          )}
        </div>
      )}

      {/* Archive Header Notice */}
      {isArchive && (
        <div className="mb-6 flex items-center gap-2 text-stone-500 text-sm font-medium">
          <Archive className="w-4 h-4" />
          <span>Archived Notes</span>
        </div>
      )}

      {/* Label Header Notice */}
      {typeof viewFilter === 'object' && viewFilter.labelName && (
        <div className="mb-6 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-semibold">
          <Tag className="w-4 h-4" />
          <span>Label: {viewFilter.labelName}</span>
        </div>
      )}

      {/* Search Query Header */}
      {searchQuery && (
        <div className="mb-6 flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-500" />
            <span>
              Search results for <strong>&quot;{searchQuery}&quot;</strong>
            </span>
          </div>
          <span className="text-xs font-medium bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
            {filteredNotes.length} found
          </span>
        </div>
      )}

      {/* Empty State */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-sm">
            {searchQuery ? (
              <Search className="w-8 h-8" />
            ) : isTrash ? (
              <Trash2 className="w-8 h-8" />
            ) : isArchive ? (
              <Archive className="w-8 h-8" />
            ) : (
              <Sparkles className="w-8 h-8" />
            )}
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 mb-1">
            {searchQuery
              ? 'No matching notes'
              : isTrash
              ? 'Trash is empty'
              : isArchive
              ? 'No archived notes'
              : 'Your diary is ready'}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mb-6">
            {searchQuery
              ? `We couldn't find any notes matching "${searchQuery}".`
              : isTrash
              ? 'Deleted notes will appear here.'
              : isArchive
              ? 'Notes you archive will appear here.'
              : 'Tap the + button to write down your first business note, hisaab, or reminder.'}
          </p>
          {!searchQuery && !isTrash && !isArchive && (
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Note</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3 px-1 text-[11px] font-bold tracking-wider uppercase text-stone-400 dark:text-stone-500">
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                <span>PINNED ({pinnedNotes.length})</span>
              </div>
              <div className={containerClass}>
                {pinnedNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onOpen={onOpenNote} />
                ))}
              </div>
            </div>
          )}

          {/* 2. Others / Main Notes Section */}
          <div>
            {pinnedNotes.length > 0 && otherNotes.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 px-1 text-[11px] font-bold tracking-wider uppercase text-stone-400 dark:text-stone-500">
                <span>OTHERS ({otherNotes.length})</span>
              </div>
            )}
            <div className={containerClass}>
              {otherNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpen={onOpenNote}
                  isTrashView={isTrash}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
