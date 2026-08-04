import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/services/logger";
import type { UserNote, NoteVersion, ListNotesOptions, AIEntities, NoteRelationship } from "./types";
import { calculateWordCount, calculateReadingTime, generateAutoSummary, extractEntitiesFromText } from "./utils";

export class NotesService {
  /**
   * List notes with optional category, tag, pin, archive, favorite, or search query filter
   */
  public static async listNotes(
    supabase: SupabaseClient,
    userId: string,
    options: ListNotesOptions = {},
  ): Promise<UserNote[]> {
    let query = (supabase.from as any)("user_notes")
      .select("*")
      .eq("user_id", userId);

    if (options.isArchived !== undefined) {
      query = query.eq("is_archived", options.isArchived);
    } else {
      query = query.eq("is_archived", false);
    }

    if (options.isPinned !== undefined) query = query.eq("is_pinned", options.isPinned);
    if (options.isFavorite !== undefined) query = query.eq("is_favorite", options.isFavorite);
    if (options.category) query = query.eq("category", options.category);
    if (options.tag) query = query.contains("tags", [options.tag]);

    if (options.query && options.query.trim()) {
      const q = `%${options.query.trim()}%`;
      query = query.or(`title.ilike.${q},content.ilike.${q},summary.ilike.${q},category.ilike.${q}`);
    }

    query = query
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) {
      logger.error("database", "Failed to list notes", { error: error.message }, userId);
      return [];
    }

    return (data || []).map(this.mapRowToNote);
  }

  /**
   * Get single note by ID
   */
  public static async getNoteById(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<UserNote | null> {
    const { data, error } = await (supabase.from as any)("user_notes")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToNote(data);
  }

  /**
   * Create or update note with autosave, versioning snapshot, and AI extraction
   */
  public static async upsertNote(
    supabase: SupabaseClient,
    userId: string,
    payload: {
      id?: string;
      title: string;
      content?: string;
      category?: string;
      tags?: string[];
      isPinned?: boolean;
      isArchived?: boolean;
      isFavorite?: boolean;
      importance?: number;
      relationships?: NoteRelationship[];
    },
  ): Promise<UserNote> {
    const content = payload.content || "";
    const wordCount = calculateWordCount(content);
    const readingTimeMin = calculateReadingTime(wordCount);
    const summary = generateAutoSummary(content);
    const extracted = extractEntitiesFromText(`${payload.title} ${content}`);

    const combinedTags = Array.from(new Set([...(payload.tags || []), ...extracted.tags]));

    const dbPayload: any = {
      user_id: userId,
      title: payload.title,
      content,
      summary,
      category: payload.category || "General",
      tags: combinedTags,
      entities: {
        people: extracted.people,
        companies: extracted.companies,
        projects: [],
        meetings: [],
        tasks: [],
      },
      word_count: wordCount,
      reading_time_min: readingTimeMin,
      updated_at: new Date().toISOString(),
    };

    if (payload.importance !== undefined) dbPayload.importance = payload.importance;
    if (payload.isPinned !== undefined) dbPayload.is_pinned = payload.isPinned;
    if (payload.isArchived !== undefined) dbPayload.is_archived = payload.isArchived;
    if (payload.isFavorite !== undefined) dbPayload.is_favorite = payload.isFavorite;
    if (payload.relationships) dbPayload.relationships = payload.relationships;

    let resultData: any;

    if (payload.id) {
      // Fetch existing note for versioning snapshot
      const existing = await this.getNoteById(supabase, userId, payload.id);
      if (existing && existing.content !== content) {
        // Create version snapshot
        await this.createVersionSnapshot(supabase, existing.id, existing.title, existing.content);
      }

      const { data, error } = await (supabase.from as any)("user_notes")
        .update(dbPayload)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        logger.error("database", "Failed to update note", { error: error.message }, userId);
        throw new Error(`Failed to update note: ${error.message}`);
      }
      resultData = data;
    } else {
      dbPayload.created_at = new Date().toISOString();
      const { data, error } = await (supabase.from as any)("user_notes")
        .insert(dbPayload)
        .select()
        .single();

      if (error) {
        logger.error("database", "Failed to create note", { error: error.message }, userId);
        throw new Error(`Failed to create note: ${error.message}`);
      }
      resultData = data;
    }

    logger.info("database", `Note saved: ${resultData.id}`, { title: payload.title }, userId);
    return this.mapRowToNote(resultData);
  }

  /**
   * Delete note
   */
  public static async deleteNote(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
  ): Promise<{ ok: boolean }> {
    const { error } = await (supabase.from as any)("user_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);

    if (error) {
      logger.error("database", "Failed to delete note", { error: error.message }, userId);
      throw new Error(`Failed to delete note: ${error.message}`);
    }

    return { ok: true };
  }

  /**
   * Toggle pin or archive state
   */
  public static async toggleNoteState(
    supabase: SupabaseClient,
    userId: string,
    noteId: string,
    updates: { isPinned?: boolean; isArchived?: boolean; isFavorite?: boolean },
  ): Promise<UserNote> {
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.isPinned !== undefined) payload.is_pinned = updates.isPinned;
    if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;
    if (updates.isFavorite !== undefined) payload.is_favorite = updates.isFavorite;

    const { data, error } = await (supabase.from as any)("user_notes")
      .update(payload)
      .eq("id", noteId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to toggle note state: ${error.message}`);
    return this.mapRowToNote(data);
  }

  /**
   * Get Version History for a note
   */
  public static async getNoteVersions(
    supabase: SupabaseClient,
    noteId: string,
  ): Promise<NoteVersion[]> {
    const { data, error } = await (supabase.from as any)("note_versions")
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((v: any) => ({
      id: v.id,
      noteId: v.note_id,
      title: v.title,
      content: v.content,
      version: v.version,
      createdAt: v.created_at,
    }));
  }

  private static async createVersionSnapshot(
    supabase: SupabaseClient,
    noteId: string,
    title: string,
    content: string,
  ) {
    const { data: existingVersions } = await (supabase.from as any)("note_versions")
      .select("version")
      .eq("note_id", noteId)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

    await (supabase.from as any)("note_versions").insert({
      note_id: noteId,
      title,
      content,
      version: nextVersion,
      created_at: new Date().toISOString(),
    });
  }

  private static mapRowToNote(row: any): UserNote {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content || "",
      summary: row.summary,
      category: row.category || "General",
      tags: row.tags || [],
      entities: row.entities || { people: [], companies: [], projects: [], meetings: [], tasks: [] },
      importance: row.importance || 3,
      isPinned: Boolean(row.is_pinned),
      isArchived: Boolean(row.is_archived),
      isFavorite: Boolean(row.is_favorite),
      wordCount: row.word_count || 0,
      readingTimeMin: row.reading_time_min || 1,
      relationships: row.relationships || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
