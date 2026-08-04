import type { SupabaseClient } from "@supabase/supabase-js";

export interface UniversalSearchResultItem {
  id: string;
  module: "tasks" | "memory" | "chat" | "notes" | "documents" | "calendar" | "gmail";
  title: string;
  subtitle?: string;
  content?: string;
  url?: string;
  createdAt?: string;
}

export interface UniversalSearchProvider {
  name: string;
  search(supabase: SupabaseClient, userId: string, query: string): Promise<UniversalSearchResultItem[]>;
}

class SearchRegistry {
  private providers: UniversalSearchProvider[] = [];

  register(provider: UniversalSearchProvider): void {
    this.providers.push(provider);
  }

  async searchAll(supabase: SupabaseClient, userId: string, query: string): Promise<UniversalSearchResultItem[]> {
    if (!query.trim()) return [];

    const results = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return await provider.search(supabase, userId, query);
        } catch {
          return [];
        }
      }),
    );

    return results.flat();
  }
}

export const searchRegistry = new SearchRegistry();

// 1. Task Search Provider
searchRegistry.register({
  name: "tasks",
  async search(supabase, userId, query) {
    const like = `%${query}%`;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_at")
      .eq("user_id", userId)
      .ilike("title", like)
      .limit(8);

    return (data ?? []).map((task) => ({
      id: task.id,
      module: "tasks",
      title: task.title,
      subtitle: `Priority: ${task.priority} | Status: ${task.status}`,
    }));
  },
});

// 2. Memory Search Provider
searchRegistry.register({
  name: "memory",
  async search(supabase, userId, query) {
    const like = `%${query}%`;
    const { data } = await supabase
      .from("memories")
      .select("id, title, content, kind, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.${like},content.ilike.${like}`)
      .limit(8);

    return (data ?? []).map((mem) => ({
      id: mem.id,
      module: "memory",
      title: mem.title,
      subtitle: `Kind: ${mem.kind}`,
      content: mem.content,
      createdAt: mem.created_at,
    }));
  },
});

// 3. Chat Search Provider
searchRegistry.register({
  name: "chat",
  async search(supabase, userId, query) {
    const like = `%${query}%`;
    const { data } = await supabase
      .from("chat_messages")
      .select("id, thread_id, text_content, role, created_at")
      .eq("user_id", userId)
      .ilike("text_content", like)
      .order("created_at", { ascending: false })
      .limit(8);

    return (data ?? []).map((msg) => ({
      id: msg.id,
      module: "chat",
      title: msg.text_content.slice(0, 60),
      subtitle: `Role: ${msg.role}`,
      url: `/chat/${msg.thread_id}`,
      createdAt: msg.created_at,
    }));
  },
});

// 4. Notes & Personal Knowledge Search Provider
searchRegistry.register({
  name: "notes",
  async search(supabase, userId, query) {
    const like = `%${query}%`;
    const { data } = await (supabase.from as any)("user_notes")
      .select("id, title, content, summary, category, tags, created_at")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .or(`title.ilike.${like},content.ilike.${like},summary.ilike.${like},category.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(8);

    return (data ?? []).map((note: any) => ({
      id: note.id,
      module: "notes",
      title: note.title,
      subtitle: `Category: ${note.category} ${note.tags && note.tags.length > 0 ? `| Tags: #${note.tags.join(" #")}` : ""}`,
      content: note.summary || note.content.slice(0, 100),
      url: `/notes`,
      createdAt: note.created_at,
    }));
  },
});

// 5. Follow-Ups & Relationship Manager Search Provider
searchRegistry.register({
  name: "followups",
  async search(supabase, userId, query) {
    const like = `%${query}%`;
    const { data } = await (supabase.from as any)("user_followups")
      .select("id, title, person_name, organization_name, priority, status, followup_date, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.${like},person_name.ilike.${like},organization_name.ilike.${like},notes.ilike.${like}`)
      .order("followup_date", { ascending: true, nullsFirst: false })
      .limit(8);

    return (data ?? []).map((item: any) => ({
      id: item.id,
      module: "notes", // group in knowledge / relation results
      title: item.title,
      subtitle: `Followup: ${item.person_name || item.organization_name || "General"} | Status: ${item.status}`,
      content: item.followup_date ? `Due: ${new Date(item.followup_date).toLocaleDateString()}` : undefined,
      url: `/followups`,
      createdAt: item.created_at,
    }));
  },
});
