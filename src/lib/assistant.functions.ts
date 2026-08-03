import { supabase } from "@/integrations/supabase/client";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  created_at: string;
};

export type MemoryRow = {
  id: string;
  kind: string;
  title: string;
  content: string;
  tags: string[];
  importance: number;
  created_at: string;
};

export type ThreadRow = {
  id: string;
  title: string;
  updated_at: string;
};

export async function getWorkspace() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;

  const [profile, tasks, memories, threads] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, timezone").eq("id", userId).maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, notes, priority, status, due_at, created_at")
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("memories")
      .select("id, kind, title, content, tags, importance, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("chat_threads")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  return {
    profile: profile.data ?? null,
    tasks: (tasks.data ?? []) as TaskRow[],
    memories: (memories.data ?? []) as MemoryRow[],
    threads: (threads.data ?? []) as ThreadRow[],
    todaysEvents: [],
  };
}

export async function listThreads() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as ThreadRow[];
}

export async function createThread(data?: { title?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: row, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: user.id, title: data?.title ?? "New conversation" })
    .select("id, title, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return row as ThreadRow;
}

export async function deleteThread(data: { threadId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from("chat_threads")
    .delete()
    .eq("id", data.threadId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getThread(data: { threadId: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("id", data.threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!thread) return { thread: null, messages: [] };

  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, created_at")
    .eq("thread_id", data.threadId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    thread: thread as ThreadRow,
    messages: (rows ?? []).map((row) => ({
      id: row.id as string,
      role: row.role as "user" | "assistant" | "system",
      partsJson: JSON.stringify(row.parts ?? []),
    })),
  };
}

export async function renameThread(data: { threadId: string; title: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from("chat_threads")
    .update({ title: data.title })
    .eq("id", data.threadId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function upsertTask(data: {
  id?: string;
  title: string;
  notes?: string | null;
  priority?: "low" | "medium" | "high";
  dueAt?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const payload = {
    user_id: user.id,
    title: data.title,
    notes: data.notes ?? null,
    priority: data.priority ?? "medium",
    due_at: data.dueAt ?? null,
  };
  const query = data.id
    ? supabase.from("tasks").update(payload).eq("id", data.id).eq("user_id", user.id)
    : supabase.from("tasks").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setTaskStatus(data: { id: string; status: "open" | "done" }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from("tasks")
    .update({
      status: data.status,
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", data.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteTask(data: { id: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", data.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveMemory(data: {
  title: string;
  content: string;
  kind?: "fact" | "person" | "project" | "decision" | "promise" | "idea";
  tags?: string[];
  importance?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase.from("memories").insert({
    user_id: user.id,
    title: data.title,
    content: data.content,
    kind: data.kind ?? "fact",
    tags: data.tags ?? [],
    importance: data.importance ?? 3,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteMemory(data: { id: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase
    .from("memories")
    .delete()
    .eq("id", data.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function generateDailyBrief() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [tasks, memories] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, priority, status, due_at")
      .eq("user_id", user.id)
      .eq("status", "open")
      .limit(30),
    supabase
      .from("memories")
      .select("title, content, kind")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const openTasks = tasks.data ?? [];
  const memoryList = memories.data ?? [];

  let brief = "### Daily Brief\n\n";
  if (openTasks.length > 0) {
    brief += `**Open Tasks (${openTasks.length}):**\n`;
    openTasks.forEach((t) => {
      brief += `- [${t.priority.toUpperCase()}] ${t.title}\n`;
    });
    brief += "\n";
  } else {
    brief += "No pending tasks for today.\n\n";
  }

  if (memoryList.length > 0) {
    brief += "**Recent Context & Memory:**\n";
    memoryList.forEach((m) => {
      brief += `- [${m.kind}] ${m.title}: ${m.content}\n`;
    });
  }

  return { brief };
}
