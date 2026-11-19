'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { NotesGrid } from '@/components/notes/NotesGrid';
import { NoteEditorModal } from '@/components/editor/NoteEditorModal';
import { LabelModal } from '@/components/modals/LabelModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { AuthModal } from '@/components/modals/AuthModal';
import { useNotes } from '@/context/notes-context';
import { Note } from '@/types/diary';
import { Plus } from 'lucide-react';

export default function HomePage() {
  const { activeNote, setActiveNote, isEditorOpen, setIsEditorOpen, createNote } = useNotes();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleOpenNote = (note: Note) => {
    setActiveNote(note);
    setIsEditorOpen(true);
  };

  const handleCreateNote = () => {
    createNote();
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setActiveNote(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper-50 dark:bg-stone-950">
      {/* Top Navigation Bar */}
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar & Mobile Drawer */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLabelModal={() => setLabelModalOpen(true)}
        />

        {/* Notes Grid Main Canvas */}
        <main className="flex-1 flex flex-col overflow-x-hidden">
          <NotesGrid
            onOpenNote={handleOpenNote}
            onOpenCreateModal={handleCreateNote}
          />
        </main>
      </div>

      {/* Desktop Floating Action Button (FAB) */}
      <button
        onClick={handleCreateNote}
        className="hidden md:flex fixed bottom-8 right-8 z-30 w-14 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-xl shadow-amber-500/30 items-center justify-center transition-all group"
        title="Create new note"
        aria-label="Create note"
      >
        <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-200" strokeWidth={2.5} />
      </button>

      {/* Mobile Bottom Navigation Bar with Center + Button */}
      <BottomNav
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLabelModal={() => setLabelModalOpen(true)}
      />

      {/* Keep Notes Style Editor Modal */}
      <NoteEditorModal
        note={activeNote}
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
      />

      {/* Label Management Modal */}
      <LabelModal
        isOpen={labelModalOpen}
        onClose={() => setLabelModalOpen(false)}
      />

      {/* Settings & Cloud Sync Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
