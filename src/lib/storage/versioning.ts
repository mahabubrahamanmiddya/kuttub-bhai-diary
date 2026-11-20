import { Note, NoteVersion } from '@/types/diary';
import { idbSaveNoteVersion, idbGetNoteVersions } from './indexed-db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * Creates an immutable historical checkpoint of a note before a significant change or restore.
 */
export async function createNoteVersionCheckpoint(
  note: Note,
  changeSummary = 'Manual checkpoint'
): Promise<NoteVersion> {
  const version: NoteVersion = {
    id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    note_id: note.id,
    user_id: note.user_id,
    title: note.title,
    content: note.content,
    color: note.color,
    is_checklist: Boolean(note.is_checklist),
    checklist_items: note.checklist_items ? [...note.checklist_items] : undefined,
    version_number: Date.now(),
    change_summary: changeSummary,
    created_at: new Date().toISOString(),
  };

  // 1. Save in IndexedDB
  await idbSaveNoteVersion(version);

  // 2. Save in Supabase if online
  if (isSupabaseConfigured() && navigator.onLine) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('note_versions').insert({
          id: version.id,
          note_id: version.note_id,
          user_id: version.user_id,
          title: version.title,
          content: version.content,
          color: version.color,
          is_checklist: version.is_checklist,
          version_number: 1,
          change_summary: version.change_summary,
          created_at: version.created_at,
        });
      } catch (e) {
        console.warn('Could not sync version checkpoint to Supabase:', e);
      }
    }
  }

  return version;
}

/**
 * Loads all historical versions of a note from IndexedDB and Supabase.
 */
export async function getNoteVersionHistory(noteId: string): Promise<NoteVersion[]> {
  const localVersions = await idbGetNoteVersions(noteId);

  // If online, also check Supabase for any remote versions
  if (isSupabaseConfigured() && navigator.onLine) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('note_versions')
          .select('*')
          .eq('note_id', noteId)
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          const map = new Map<string, NoteVersion>();
          localVersions.forEach((v) => map.set(v.id, v));
          data.forEach((v: any) => {
            if (!map.has(v.id)) {
              map.set(v.id, {
                id: v.id,
                note_id: v.note_id,
                user_id: v.user_id,
                title: v.title,
                content: v.content,
                color: v.color,
                is_checklist: Boolean(v.is_checklist),
                version_number: v.version_number || 1,
                change_summary: v.change_summary,
                created_at: v.created_at,
              });
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
      } catch {}
    }
  }

  return localVersions;
}
