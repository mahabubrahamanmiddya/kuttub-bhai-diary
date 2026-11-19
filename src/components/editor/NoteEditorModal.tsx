'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Pin,
  Archive,
  Trash2,
  Palette,
  Tag,
  Clock,
  CheckSquare,
  Square,
  List,
  Calendar,
  IndianRupee,
  RefreshCw,
  CheckCircle2,
  CloudOff,
  Cloud,
  Plus,
} from 'lucide-react';
import { Note, NOTE_COLORS, NoteColor, ChecklistItem, Label } from '@/types/diary';
import { useNotes } from '@/context/notes-context';

interface NoteEditorModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NoteEditorModal({ note, isOpen, onClose }: NoteEditorModalProps) {
  const {
    saveNoteDebounced,
    saveNoteImmediate,
    deleteNote,
    togglePin,
    toggleArchive,
    syncState,
    syncStatusMessage,
    isOnline,
    labels,
  } = useNotes();

  // Local state for instant typing responsiveness
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [reminderDate, setReminderDate] = useState<string | null>(null);
  const [noteLabels, setNoteLabels] = useState<Label[]>([]);

  // UI pickers state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newChecklistInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever the opened note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || 'default');
      setIsPinned(note.is_pinned || false);
      setIsChecklist(Boolean(note.is_checklist));
      setChecklistItems(note.checklist_items || []);
      setReminderDate(note.reminder_date || null);
      setNoteLabels(note.labels || []);
    }
  }, [note?.id]);

  // Handle auto-resizing textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(
        180,
        textareaRef.current.scrollHeight
      )}px`;
    }
  }, [content, isOpen]);

  if (!isOpen || !note) return null;

  const colorConfig = NOTE_COLORS[color] || NOTE_COLORS.default;

  // Title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    saveNoteDebounced(note.id, { title: val });
  };

  // Content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    saveNoteDebounced(note.id, { content: val });
  };

  // Insert text at cursor position (e.g. ₹, date, bullets)
  const insertTextAtCursor = (textToInsert: string) => {
    if (!textareaRef.current) {
      const nextContent = content + textToInsert;
      setContent(nextContent);
      saveNoteDebounced(note.id, { content: nextContent });
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + textToInsert + current.substring(end);

    setContent(updated);
    saveNoteDebounced(note.id, { content: updated });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  // Rupee symbol shortcut
  const handleInsertRupee = () => {
    insertTextAtCursor('₹');
  };

  // Today's date shortcut
  const handleInsertDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const formatted = new Date().toLocaleDateString('en-IN', options);
    insertTextAtCursor(`\n${formatted}\n`);
  };

  // Bullet point shortcut
  const handleInsertBullet = () => {
    insertTextAtCursor('\n• ');
  };

  // Checkbox toggle / item adder
  const handleInsertCheckbox = () => {
    insertTextAtCursor('\n□ ');
  };

  // Toggle checklist mode
  const handleToggleChecklistMode = () => {
    const nextChecklistMode = !isChecklist;
    setIsChecklist(nextChecklistMode);

    let items: ChecklistItem[] = [];
    if (nextChecklistMode) {
      // Parse content lines into checklist items
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      items = lines.map((line, idx) => {
        const isDone = line.startsWith('☑') || line.startsWith('[x]') || line.startsWith('[X]');
        const clean = line.replace(/^(☑|\[x\]|\[X\]|□|\[\s*\]|•|-)\s*/, '');
        return {
          id: `item-${Date.now()}-${idx}`,
          text: clean,
          completed: isDone,
        };
      });
      if (items.length === 0) {
        items = [{ id: `item-${Date.now()}-0`, text: '', completed: false }];
      }
      setChecklistItems(items);
    } else {
      // Convert checklist items back into plain content
      const plain = checklistItems
        .map((it) => `${it.completed ? '☑' : '□'} ${it.text}`)
        .join('\n');
      setContent(plain);
    }

    saveNoteDebounced(note.id, {
      is_checklist: nextChecklistMode,
      checklist_items: items,
    });
  };

  // Checklist item toggle
  const handleToggleChecklistItem = (id: string) => {
    const nextItems = checklistItems.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(nextItems);

    // Sync content as well
    const plain = nextItems.map((it) => `${it.completed ? '☑' : '□'} ${it.text}`).join('\n');
    setContent(plain);

    saveNoteDebounced(note.id, {
      checklist_items: nextItems,
      content: plain,
    });
  };

  // Checklist item text change
  const handleChecklistItemChange = (id: string, text: string) => {
    const nextItems = checklistItems.map((item) =>
      item.id === id ? { ...item, text } : item
    );
    setChecklistItems(nextItems);
    const plain = nextItems.map((it) => `${it.completed ? '☑' : '□'} ${it.text}`).join('\n');
    setContent(plain);
    saveNoteDebounced(note.id, {
      checklist_items: nextItems,
      content: plain,
    });
  };

  // Add new checklist item
  const handleAddChecklistItem = (text = '') => {
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      completed: false,
    };
    const nextItems = [...checklistItems, newItem];
    setChecklistItems(nextItems);
    saveNoteDebounced(note.id, { checklist_items: nextItems });
    setTimeout(() => {
      newChecklistInputRef.current?.focus();
    }, 50);
  };

  // Remove checklist item
  const handleRemoveChecklistItem = (id: string) => {
    const nextItems = checklistItems.filter((it) => it.id !== id);
    setChecklistItems(nextItems);
    saveNoteDebounced(note.id, { checklist_items: nextItems });
  };

  // Pin toggle
  const handlePin = () => {
    const nextVal = !isPinned;
    setIsPinned(nextVal);
    saveNoteImmediate(note.id, { is_pinned: nextVal });
  };

  // Color change
  const handleColorSelect = (cKey: NoteColor) => {
    setColor(cKey);
    setShowColorPicker(false);
    saveNoteImmediate(note.id, { color: cKey });
  };

  // Toggle label on note
  const handleToggleLabel = (lbl: Label) => {
    const exists = noteLabels.some((l) => l.id === lbl.id);
    const next = exists ? noteLabels.filter((l) => l.id !== lbl.id) : [...noteLabels, lbl];
    setNoteLabels(next);
    saveNoteImmediate(note.id, { labels: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Editor Container (Fullscreen on mobile, rounded card on tablet/desktop) */}
      <div
        className={`relative w-full max-w-2xl min-h-screen sm:min-h-0 sm:rounded-3xl border shadow-modal flex flex-col z-10 transition-all ${
          colorConfig.bgLight
        } ${colorConfig.bgDark} ${colorConfig.borderLight} ${colorConfig.borderDark}`}
      >
        {/* Top Header inside Editor */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2 border-b border-black/5 dark:border-white/5">
          {/* Live Auto-save status indicator */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {syncState === 'saving' ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </span>
            ) : !isOnline || syncState === 'offline' ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <CloudOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  Offline — changes will sync when you&apos;re back online
                </span>
                <span className="sm:hidden">Offline</span>
              </span>
            ) : syncState === 'saved_cloud' ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved to cloud ✓</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved ✓</span>
              </span>
            )}
          </div>

          {/* Top Actions: Pin, Done / Close Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePin}
              className={`p-2 rounded-xl transition-all ${
                isPinned
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-black/5'
              }`}
              title={isPinned ? 'Unpin note' : 'Pin to top'}
              aria-label="Pin"
            >
              <Pin className={`w-4 h-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold rounded-xl hover:bg-stone-800 dark:hover:bg-white active:scale-95 transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-4 sm:px-6 py-4 flex-1 flex flex-col">
          {/* Note Title Input */}
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Title"
            className="w-full bg-transparent text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none mb-3"
          />

          {/* Labels chips on note */}
          {noteLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {noteLabels.map((lbl) => (
                <span
                  key={lbl.id}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-stone-800 dark:text-stone-200"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: lbl.color || '#f59e0b' }}
                  />
                  <span>{lbl.name}</span>
                  <button
                    onClick={() => handleToggleLabel(lbl)}
                    className="ml-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Reminder date indicator */}
          {reminderDate && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-medium text-stone-700 dark:text-stone-300 w-fit mb-3">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Reminder: {new Date(reminderDate).toLocaleString()}</span>
              <button
                onClick={() => {
                  setReminderDate(null);
                  saveNoteImmediate(note.id, { reminder_date: null });
                }}
                className="text-stone-400 hover:text-stone-700 ml-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Main Editor Body: Checklist Mode vs Plain Multiline Text */}
          {isChecklist ? (
            <div className="space-y-2 py-2 flex-1">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className="text-stone-500 hover:text-amber-600 transition-colors p-0.5"
                  >
                    {item.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => handleChecklistItemChange(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    placeholder="List item..."
                    className={`flex-1 bg-transparent text-sm sm:text-base text-stone-800 dark:text-stone-200 focus:outline-none ${
                      item.completed ? 'line-through text-stone-400 dark:text-stone-500' : ''
                    }`}
                  />
                  <button
                    onClick={() => handleRemoveChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-500 p-1 text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add next item button */}
              <button
                onClick={() => handleAddChecklistItem()}
                className="flex items-center gap-2 text-stone-500 hover:text-amber-600 text-sm font-medium pt-2"
              >
                <Plus className="w-4 h-4" />
                <span>List item</span>
              </button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Write anything... Raju se ₹5000 lena hai, Aaj ka hisaab, customer number, etc."
              className="w-full flex-1 bg-transparent text-sm sm:text-base text-stone-800 dark:text-stone-200 placeholder-stone-400 dark:placeholder-stone-500 leading-relaxed focus:outline-none resize-none font-sans"
              rows={8}
            />
          )}
        </div>

        {/* Quick Toolbar (₹ Rupee shortcut, Checklist, Bullet, Date, Palette, Tags, Archive, Trash) */}
        <div className="px-4 sm:px-6 py-3 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 mt-auto">
          {/* Left tools: ₹, Date, Checklist, Bullets */}
          <div className="flex items-center gap-1">
            {/* Rupee Symbol Shortcut Button */}
            <button
              onClick={handleInsertRupee}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1 transition-colors"
              title="Insert ₹ Rupee symbol"
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>₹ Rupee</span>
            </button>

            {/* Today's Date Shortcut Button */}
            <button
              onClick={handleInsertDate}
              className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Insert today's date"
            >
              <Calendar className="w-4 h-4" />
            </button>

            {/* Checklist Mode Toggle */}
            <button
              onClick={handleToggleChecklistMode}
              className={`p-1.5 rounded-xl transition-colors ${
                isChecklist
                  ? 'bg-amber-500 text-white'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Toggle checklist"
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            {/* Bullets */}
            {!isChecklist && (
              <button
                onClick={handleInsertBullet}
                className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Insert bullet point"
              >
                <List className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right tools: Color, Label, Date Reminder, Archive, Delete */}
          <div className="flex items-center gap-1 relative">
            {/* Color Palette */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Note color"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showColorPicker && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowColorPicker(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-2 z-30 p-2 bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 flex items-center gap-1.5">
                    {(Object.keys(NOTE_COLORS) as NoteColor[]).map((cKey) => {
                      const cfg = NOTE_COLORS[cKey];
                      return (
                        <button
                          key={cKey}
                          onClick={() => handleColorSelect(cKey)}
                          className={`w-6 h-6 rounded-full border ${cfg.bgLight} ${
                            color === cKey ? 'ring-2 ring-amber-500 scale-110' : ''
                          }`}
                          title={cfg.name}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Label Picker */}
            <div className="relative">
              <button
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Labels / Categories"
              >
                <Tag className="w-4 h-4" />
              </button>

              {showLabelPicker && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowLabelPicker(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-2 z-30 w-52 p-2 bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-stone-400 px-2 py-1">
                      Note Labels
                    </p>
                    {labels.map((lbl) => {
                      const checked = noteLabels.some((l) => l.id === lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          onClick={() => handleToggleLabel(lbl)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: lbl.color || '#f59e0b' }}
                            />
                            <span>{lbl.name}</span>
                          </div>
                          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Reminder Date Picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Set reminder / date"
              >
                <Clock className="w-4 h-4" />
              </button>

              {showDatePicker && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowDatePicker(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-2 z-30 p-3 bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700">
                    <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                      Set Note Reminder
                    </p>
                    <input
                      type="datetime-local"
                      onChange={(e) => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setReminderDate(val);
                        saveNoteImmediate(note.id, { reminder_date: val });
                        setShowDatePicker(false);
                      }}
                      className="text-xs p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Archive Toggle */}
            <button
              onClick={() => {
                toggleArchive(note.id);
                onClose();
              }}
              className="p-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Archive note"
            >
              <Archive className="w-4 h-4" />
            </button>

            {/* Delete to Trash */}
            <button
              onClick={() => {
                deleteNote(note.id);
                onClose();
              }}
              className="p-1.5 rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 transition-colors"
              title="Delete to trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
