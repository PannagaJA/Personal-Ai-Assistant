import { supabase } from "@/integrations/supabase/client";
import { GoogleCalendarService } from "@/features/calendar/services.server";
import { GmailService } from "@/features/gmail/services.server";
import { getStartOfDayIso, getEndOfDayIso } from "@/features/calendar/utils";
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from "@/features/calendar/types";
import type { CreateDraftInput, ReplyInput, ListMessagesOptions } from "@/features/gmail/types";

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

  const startToday = getStartOfDayIso();
  const endToday = getEndOfDayIso();

  const [profile, tasks, memories, threads, calendarEvents, unreadEmails] = await Promise.all([
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
    GoogleCalendarService.listEvents(supabase, userId, startToday, endToday).catch(() => []),
    GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
  ]);

  const now = new Date();
  const nextMeeting = calendarEvents.find(
    (e) => e.start.dateTime && new Date(e.start.dateTime) > now
  ) ?? null;

  const freeTimeToday = await GoogleCalendarService.findFreeTime(
    supabase,
    userId,
    now.toISOString(),
    endToday,
    30
  ).catch(() => []);

  return {
    profile: profile.data ?? null,
    tasks: (tasks.data ?? []) as TaskRow[],
    memories: (memories.data ?? []) as MemoryRow[],
    threads: (threads.data ?? []) as ThreadRow[],
    todaysEvents: calendarEvents,
    nextMeeting,
    freeTimeToday,
    unreadEmails: unreadEmails.messages ?? [],
  };
}

export async function fetchCalendarEvents(timeMin: string, timeMax: string, q?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleCalendarService.listEvents(supabase, user.id, timeMin, timeMax, q);
}

export async function createCalendarEvent(input: CreateEventInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleCalendarService.createEvent(supabase, user.id, input);
}

export async function updateCalendarEvent(input: UpdateEventInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleCalendarService.updateEvent(supabase, user.id, input);
}

export async function deleteCalendarEvent(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleCalendarService.deleteEvent(supabase, user.id, eventId);
}

// Gmail Client Helpers
export async function fetchGmailMessages(options: ListMessagesOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.listMessages(supabase, user.id, options);
}

export async function fetchGmailMessage(messageId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.getMessage(supabase, user.id, messageId, true);
}

export async function fetchGmailThread(threadId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.getThread(supabase, user.id, threadId);
}

export async function markGmailRead(messageId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.modifyLabels(supabase, user.id, messageId, [], ["UNREAD"]);
}

export async function markGmailUnread(messageId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.modifyLabels(supabase, user.id, messageId, ["UNREAD"], []);
}

export async function archiveGmailMessage(messageId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.modifyLabels(supabase, user.id, messageId, [], ["INBOX"]);
}

export async function sendDirectGmail(input: { to: string; subject: string; body: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.sendEmail(supabase, user.id, input);
}

export async function createGmailDraft(input: CreateDraftInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.createDraft(supabase, user.id, input);
}

export async function sendGmailReply(input: ReplyInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GmailService.sendReply(supabase, user.id, input);
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

  const startToday = getStartOfDayIso();
  const endToday = getEndOfDayIso();

  const [tasks, memories, calendarEvents, unreadEmails] = await Promise.all([
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
    GoogleCalendarService.listEvents(supabase, user.id, startToday, endToday).catch(() => []),
    GmailService.listMessages(supabase, user.id, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
  ]);

  const openTasks = tasks.data ?? [];
  const memoryList = memories.data ?? [];
  const unreadList = unreadEmails.messages ?? [];

  let brief = "### Daily Brief\n\n";
  if (calendarEvents.length > 0) {
    brief += `**Today's Schedule (${calendarEvents.length} meetings):**\n`;
    calendarEvents.forEach((evt) => {
      const time = evt.start.dateTime
        ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
        : "All Day";
      brief += `- [${time}] ${evt.summary}${evt.location ? ` @ ${evt.location}` : ""}\n`;
    });
    brief += "\n";
  } else {
    brief += "No meetings scheduled for today.\n\n";
  }

  if (unreadList.length > 0) {
    brief += `**Unread Inbox (${unreadList.length} unread):**\n`;
    unreadList.forEach((msg) => {
      brief += `- ${msg.subject} from ${msg.from}\n`;
    });
    brief += "\n";
  }

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
