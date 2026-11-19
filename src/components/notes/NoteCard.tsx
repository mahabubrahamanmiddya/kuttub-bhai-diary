'use client';

import React, { useState } from 'react';
import {
  Pin,
  Archive,
  ArchiveRestore,
  Trash2,
  RotateCcw,
  Palette,
  Tag,
  Clock,
  CheckSquare,
  Square,
  MoreVertical,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColor } from '@/types/diary';
import { useNotes } from '@/context/notes-context';

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  isTrashView?: boolean;
}

export function NoteCard({ note, onOpen, isTrashView = false }: NoteCardProps) {
  const {
    togglePin,
    toggleArchive,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    updateNoteColor,
  } = useNotes();

  const [showColorPicker, setShowColorPicker] = useState(false);

  const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.default;

  // Split content lines for clean preview
  const contentPreview = note.content ? note.content.slice(0, 300) : '';

  return (
    <div
      onClick={() => onOpen(note)}
      className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-note-hover ${
        colorConfig.bgLight
      } ${colorConfig.bgDark} ${colorConfig.borderLight} ${colorConfig.borderDark} ${
        note.is_pinned ? 'ring-1 ring-amber-400/40 shadow-sm' : 'shadow-note'
      }`}
    >
      {/* Top Section: Title & Pin Button */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-base leading-snug line-clamp-2">
          {note.title || (
            <span className="text-stone-400 dark:text-stone-500 font-normal italic">
              Untitled Note
            </span>
          )}
        </h3>

        {!isTrashView && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePin(note.id);
            }}
            className={`p-1.5 rounded-full transition-all shrink-0 ${
              note.is_pinned
                ? 'text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/50'
                : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/50 opacity-0 group-hover:opacity-100'
            }`}
            title={note.is_pinned ? 'Unpin note' : 'Pin note'}
            aria-label="Pin note"
          >
            <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Body: Note Content or Checklist Preview */}
      <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed mb-3 whitespace-pre-wrap font-sans break-words line-clamp-8">
        {note.is_checklist && note.checklist_items && note.checklist_items.length > 0 ? (
          <div className="space-y-1.5 pt-0.5">
            {note.checklist_items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs sm:text-sm">
                {item.completed ? (
                  <CheckSquare className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                )}
                <span className={item.completed ? 'line-through text-stone-400' : ''}>
                  {item.text}
                </span>
              </div>
            ))}
            {note.checklist_items.length > 5 && (
              <span className="text-xs text-stone-400 block pt-1">
                +{note.checklist_items.length - 5} more items
              </span>
            )}
          </div>
        ) : (
          contentPreview || (
            <span className="text-stone-400 dark:text-stone-500 italic text-xs">
              No content
            </span>
          )
        )}
      </div>

      {/* Metadata & Footer (Labels, Dates, Actions) */}
      <div className="mt-auto pt-2 space-y-2">
        {/* Reminder Date Badge */}
        {note.reminder_date && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-800/80 text-[11px] font-medium text-stone-700 dark:text-stone-300">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{new Date(note.reminder_date).toLocaleDateString()}</span>
          </div>
        )}

        {/* Labels Badges */}
        {note.labels && note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.labels.map((lbl) => (
              <span
                key={lbl.id}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-200/60 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 border border-stone-300/40 dark:border-stone-700/40"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: lbl.color || '#f59e0b' }}
                />
                {lbl.name}
              </span>
            ))}
          </div>
        )}

        {/* Card Action Buttons (Visible on hover on desktop, always clean) */}
        <div className="flex items-center justify-between pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {isTrashView ? (
            <div className="flex items-center gap-1 w-full justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreNote(note.id);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-700 rounded-lg transition-colors"
                title="Restore note"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restore</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Permanently delete this note? This cannot be undone.')) {
                    permanentDeleteNote(note.id);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                title="Delete forever"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete forever</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 relative">
              {/* Color Picker Toggle */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-colors"
                  title="Change note color"
                  aria-label="Color options"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>

                {showColorPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(false);
                      }}
                    />
                    <div className="absolute bottom-full left-0 mb-1 z-30 p-1.5 bg-white dark:bg-stone-800 rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 flex items-center gap-1">
                      {(Object.keys(NOTE_COLORS) as NoteColor[]).map((cKey) => {
                        const cfg = NOTE_COLORS[cKey];
                        return (
                          <button
                            key={cKey}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteColor(note.id, cKey);
                              setShowColorPicker(false);
                            }}
                            className={`w-5 h-5 rounded-full border ${cfg.bgLight} ${
                              note.color === cKey ? 'ring-2 ring-amber-500 scale-110' : ''
                            }`}
                            title={cfg.name}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Archive Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleArchive(note.id);
                }}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-colors"
                title={note.is_archived ? 'Unarchive note' : 'Archive note'}
                aria-label="Archive"
              >
                {note.is_archived ? (
                  <ArchiveRestore className="w-3.5 h-3.5" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Delete Button (Trash) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
                className="p-1.5 rounded-lg text-stone-500 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/30 transition-colors"
                title="Move to trash"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
