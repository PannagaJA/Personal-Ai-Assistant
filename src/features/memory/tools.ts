import { z } from "zod";
import type { AITool } from "../ai/tools/registry.js";

export const rememberTool: AITool = {
  id: "remember",
  name: "Remember Fact / Decision",
  description: "Store an important fact, decision, promise, person or project detail so it can be recalled later.",
  parameters: z.object({
    title: z.string(),
    content: z.string(),
    kind: z.enum(["fact", "person", "project", "decision", "promise", "idea"]).default("fact"),
    importance: z.number().int().min(1).max(5).default(3),
    tags: z.array(z.string()).default([]),
  }),
  execute: async ({ title, content, kind, importance, tags }, { supabase, userId, threadId }) => {
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: userId,
        title,
        content,
        kind,
        importance,
        tags,
        source_thread_id: threadId ?? null,
      })
      .select("id, title")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: `Remembered: "${title}"`, data: { remembered: data } };
  },
};

export const searchMemoryTool: AITool = {
  id: "search_memory",
  name: "Search Memory",
  description: "Search everything the assistant remembers: facts, people, projects, decisions, promises, and past conversations.",
  parameters: z.object({
    query: z.string().min(1),
  }),
  execute: async ({ query }, { supabase, userId }) => {
    const like = `%${query}%`;
    const [memories, messages] = await Promise.all([
      supabase
        .from("memories")
        .select("id, title, content, kind, created_at, tags, importance")
        .eq("user_id", userId)
        .or(`title.ilike.${like},content.ilike.${like}`)
        .limit(10),
      supabase
        .from("chat_messages")
        .select("text_content, role, created_at")
        .eq("user_id", userId)
        .ilike("text_content", like)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    return {
      success: true,
      data: {
        memories: memories.data ?? [],
        conversations: messages.data ?? [],
      },
    };
  },
};
