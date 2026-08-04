import { z } from "zod";
import type { AITool } from "../../ai/tools/registry.js";
import { NotesService } from "../services.server.js";

export const notesCreateTool: AITool = {
  id: "notes_create",
  name: "create_note",
  description: "Create a new note or document in the user's Personal Knowledge System.",
  parameters: z.object({
    title: z.string().describe("Title of the note"),
    content: z.string().describe("Markdown content of the note"),
    category: z.string().optional().default("General").describe("Category (e.g. Work, Personal, Architecture, Ideas, Meetings)"),
    tags: z.array(z.string()).optional().default([]).describe("Tags associated with this note"),
    isPinned: z.boolean().optional().default(false).describe("Pin this note to top"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const note = await NotesService.upsertNote(supabase, userId, params);
      return {
        success: true,
        data: note,
        message: `Created note "${note.title}" in category "${note.category}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesUpdateTool: AITool = {
  id: "notes_update",
  name: "update_note",
  description: "Update an existing note by ID or exact title match.",
  parameters: z.object({
    noteId: z.string().optional().describe("UUID of the note to update"),
    title: z.string().describe("Note title to match or update"),
    content: z.string().optional().describe("Updated markdown content"),
    category: z.string().optional().describe("Updated category"),
    tags: z.array(z.string()).optional().describe("Updated tags"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      let targetId = params.noteId;
      if (!targetId) {
        const matches = await NotesService.listNotes(supabase, userId, { query: params.title, limit: 1 });
        if (matches.length === 0 || !matches[0]) {
          return { success: false, message: `No note found matching title "${params.title}".` };
        }
        targetId = matches[0].id;
      }

      const updated = await NotesService.upsertNote(supabase, userId, {
        id: targetId,
        title: params.title,
        ...(params.content !== undefined ? { content: params.content } : {}),
        ...(params.category !== undefined ? { category: params.category } : {}),
        ...(params.tags !== undefined ? { tags: params.tags } : {}),
      });

      return {
        success: true,
        data: updated,
        message: `Updated note "${updated.title}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesDeleteTool: AITool = {
  id: "notes_delete",
  name: "delete_note",
  description: "Delete a note from the knowledge base.",
  parameters: z.object({
    noteId: z.string().describe("UUID of the note to delete"),
  }),
  execute: async ({ noteId }, { supabase, userId }) => {
    try {
      await NotesService.deleteNote(supabase, userId, noteId);
      return {
        success: true,
        message: `Deleted note successfully.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesSearchTool: AITool = {
  id: "notes_search",
  name: "search_notes",
  description: "Search notes by title, content, category, tags, or entities.",
  parameters: z.object({
    query: z.string().describe("Search query (e.g. ERP architecture, pricing decisions, Smart Path)"),
    category: z.string().optional().describe("Filter by category"),
    tag: z.string().optional().describe("Filter by tag"),
  }),
  execute: async ({ query, category, tag }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query, category, tag, limit: 10 });
      return {
        success: true,
        data: notes,
        message: `Found ${notes.length} note(s) for query "${query}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesPinTool: AITool = {
  id: "notes_pin",
  name: "pin_note",
  description: "Pin or unpin a note to the top of the knowledge base.",
  parameters: z.object({
    noteId: z.string().describe("UUID of the note"),
    isPinned: z.boolean().describe("true to pin, false to unpin"),
  }),
  execute: async ({ noteId, isPinned }, { supabase, userId }) => {
    try {
      const note = await NotesService.toggleNoteState(supabase, userId, noteId, { isPinned });
      return {
        success: true,
        data: note,
        message: `${isPinned ? "Pinned" : "Unpinned"} note "${note.title}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesArchiveTool: AITool = {
  id: "notes_archive",
  name: "archive_note",
  description: "Archive or unarchive a note.",
  parameters: z.object({
    noteId: z.string().describe("UUID of the note"),
    isArchived: z.boolean().describe("true to archive, false to restore"),
  }),
  execute: async ({ noteId, isArchived }, { supabase, userId }) => {
    try {
      const note = await NotesService.toggleNoteState(supabase, userId, noteId, { isArchived });
      return {
        success: true,
        data: note,
        message: `${isArchived ? "Archived" : "Restored"} note "${note.title}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesSummaryTool: AITool = {
  id: "notes_summary",
  name: "summarize_note",
  description: "Get the executive summary and key entities of a note.",
  parameters: z.object({
    query: z.string().describe("Title or search term of the note to summarize"),
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query, limit: 1 });
      if (notes.length === 0 || !notes[0]) {
        return { success: false, message: `No note found matching "${query}".` };
      }
      const note = notes[0];
      return {
        success: true,
        data: {
          title: note.title,
          summary: note.summary,
          tags: note.tags,
          entities: note.entities,
          wordCount: note.wordCount,
          readingTimeMin: note.readingTimeMin,
        },
        message: `Summarized "${note.title}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesRelatedTool: AITool = {
  id: "notes_related",
  name: "get_related_notes",
  description: "Find notes related to a topic, person, or organization.",
  parameters: z.object({
    topic: z.string().describe("Topic, project, person, or company name (e.g. Smart Path, Admissions)"),
  }),
  execute: async ({ topic }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query: topic, limit: 5 });
      return {
        success: true,
        data: notes,
        message: `Found ${notes.length} note(s) related to "${topic}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesTodayTool: AITool = {
  id: "notes_today",
  name: "get_today_notes",
  description: "Retrieve notes created or updated today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { limit: 10 });
      const today = new Date().toISOString().split("T")[0] || "";
      const todayNotes = notes.filter((n) => (n.updatedAt && n.updatedAt.startsWith(today)) || (n.createdAt && n.createdAt.startsWith(today)));
      return {
        success: true,
        data: todayNotes,
        message: `Found ${todayNotes.length} note(s) updated today.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notesRecentTool: AITool = {
  id: "notes_recent",
  name: "get_recent_notes",
  description: "Retrieve recently updated notes.",
  parameters: z.object({
    limit: z.number().optional().default(5).describe("Maximum number of notes to retrieve"),
  }),
  execute: async ({ limit }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { limit });
      return {
        success: true,
        data: notes,
        message: `Retrieved ${notes.length} recent note(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
