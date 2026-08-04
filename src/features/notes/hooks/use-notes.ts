import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotes,
  getNoteDetails,
  saveNote,
  removeNote,
  togglePinNote,
  toggleArchiveNote,
  fetchNoteVersions,
} from "@/lib/assistant.functions";
import type { ListNotesOptions } from "../types";

export function useNotes(options: ListNotesOptions = {}) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: ["notes", options],
    queryFn: () => fetchNotes(options),
  });

  const upsertMutation = useMutation({
    mutationFn: saveNote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeNote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: (input: { noteId: string; isPinned: boolean }) =>
      togglePinNote(input.noteId, input.isPinned),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: (input: { noteId: string; isArchived: boolean }) =>
      toggleArchiveNote(input.noteId, input.isArchived),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  return {
    notes: notesQuery.data ?? [],
    isLoading: notesQuery.isLoading,
    error: notesQuery.error,
    refetch: notesQuery.refetch,
    saveNote: upsertMutation,
    deleteNote: deleteMutation,
    togglePin: togglePinMutation,
    toggleArchive: toggleArchiveMutation,
  };
}

export function useNoteVersions(noteId: string | null) {
  return useQuery({
    queryKey: ["note_versions", noteId],
    queryFn: () => (noteId ? fetchNoteVersions(noteId) : []),
    enabled: Boolean(noteId),
  });
}
