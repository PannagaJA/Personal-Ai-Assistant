import { supabase } from "@/integrations/supabase/client";
import { GoogleCalendarService } from "@/features/calendar/services.server";
import { GmailService } from "@/features/gmail/services.server";
import { GoogleContactsService } from "@/features/contacts/services.server";
import { NotesService } from "@/features/notes/services.server";
import { FollowUpsService } from "@/features/followups/services.server";
import { PlannerService } from "@/features/planner/services.server";
import { AutomationService } from "@/features/automation/services.server";
import { NotificationService } from "@/features/notifications/services.server";
import { getStartOfDayIso, getEndOfDayIso } from "@/features/calendar/utils";
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from "@/features/calendar/types";
import type { CreateDraftInput, ReplyInput, ListMessagesOptions } from "@/features/gmail/types";
import type { GoogleContact, ListContactsOptions } from "@/features/contacts/types";
import type { UserNote, ListNotesOptions } from "@/features/notes/types";
import type { FollowUpItem, ListFollowUpsOptions } from "@/features/followups/types";
import type { MorningBrief, EveningReview, DailyTimelineItem } from "@/features/planner/types";
import type { AutomationItem, AutomationRun, ListAutomationsOptions } from "@/features/automation/types";
import type { NotificationItem, ListNotificationsOptions } from "@/features/notifications/types";

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

  const [profile, tasks, memories, threads, calendarEvents, unreadEmails, contactsRes, notes, followups, morningBrief, dailyTimeline, automations, notifications] = await Promise.all([
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
    GoogleContactsService.listContacts(supabase, userId, { pageSize: 50 }).catch(() => ({ contacts: [] })),
    NotesService.listNotes(supabase, userId, { limit: 20 }).catch(() => []),
    FollowUpsService.listFollowUps(supabase, userId, { limit: 30 }).catch(() => []),
    PlannerService.generateMorningBrief(supabase, userId).catch(() => null),
    PlannerService.getDailyTimeline(supabase, userId).catch(() => []),
    AutomationService.ensureDefaultAutomations(supabase, userId).catch(() => []),
    NotificationService.listNotifications(supabase, userId, { limit: 15 }).catch(() => []),
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

  const allContacts = contactsRes.contacts || [];
  const favoriteContacts = allContacts.filter((c) => c.isFavorite);
  const frequentlyContacted = allContacts.filter((c) => c.isFrequentlyContacted || c.lastSyncedAt);

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const recentNotes = notes.slice(0, 5);

  const todayStr = now.toISOString().split("T")[0] || "";
  const pendingFollowUps = followups.filter((f) => f.status === "pending");
  const overdueFollowUps = pendingFollowUps.filter((f) => f.followupDate && new Date(f.followupDate).getTime() < now.getTime());
  const todaysFollowUps = pendingFollowUps.filter((f) => Boolean(f.followupDate && f.followupDate.startsWith(todayStr)));

  return {
    profile: profile.data ?? null,
    tasks: (tasks.data ?? []) as TaskRow[],
    memories: (memories.data ?? []) as MemoryRow[],
    threads: (threads.data ?? []) as ThreadRow[],
    todaysEvents: calendarEvents,
    nextMeeting,
    freeTimeToday,
    unreadEmails: unreadEmails.messages ?? [],
    contacts: allContacts,
    favoriteContacts,
    frequentlyContacted,
    notes,
    pinnedNotes,
    recentNotes,
    followups,
    pendingFollowUps,
    overdueFollowUps,
    todaysFollowUps,
    morningBrief,
    dailyTimeline,
    automations,
    notifications,
    unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
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
  const evt = await GoogleCalendarService.createEvent(supabase, user.id, input);

  const startStr = input.start?.dateTime
    ? new Date(input.start.dateTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    : "All Day";

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "meeting_reminder",
    title: `📅 Scheduled: ${input.summary}`,
    message: `Added to Today's Schedule for ${startStr}.${input.location ? ` Location: ${input.location}` : ""}`,
    priority_score: 85,
    urgency: "high",
    is_read: false,
    is_archived: false,
    action_url: "/dashboard",
    created_at: new Date().toISOString(),
  }).catch(() => null);

  return evt;
}

export async function updateCalendarEvent(input: UpdateEventInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleCalendarService.updateEvent(supabase, user.id, input);
}

export async function deleteCalendarEvent(eventId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const res = await GoogleCalendarService.deleteEvent(supabase, user.id, eventId);

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "system_notification",
    title: `🗓️ Event Cancelled`,
    message: `Removed event from Today's Schedule.`,
    priority_score: 50,
    urgency: "medium",
    is_read: false,
    is_archived: false,
    action_url: "/dashboard",
    created_at: new Date().toISOString(),
  }).catch(() => null);

  return res;
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

  // Dispatch FCM Push Notification for new task
  if (!data.id) {
    const dueInfo = data.dueAt ? ` (Due: ${data.dueAt})` : "";
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "overdue_task",
      title: `📌 Task Created: ${data.title}`,
      message: `Task added to Notification & Attention Engine.${dueInfo}`,
      priority_score: data.priority === "high" ? 90 : 60,
      urgency: data.priority === "high" ? "high" : "medium",
      is_read: false,
      is_archived: false,
      action_url: "/dashboard",
      created_at: new Date().toISOString(),
    }).catch(() => null);
  }

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

  if (data.status === "done") {
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "system_notification",
      title: `🎉 Task Completed`,
      message: `Task marked complete!`,
      priority_score: 40,
      urgency: "low",
      is_read: false,
      is_archived: false,
      action_url: "/dashboard",
      created_at: new Date().toISOString(),
    }).catch(() => null);
  }

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

// Contacts Client Helpers
export async function fetchContacts(options: ListContactsOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const res = await GoogleContactsService.listContacts(supabase, user.id, options);
  return res.contacts;
}

export async function searchContacts(query: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleContactsService.searchContacts(supabase, user.id, query);
}

export async function getContactDetails(resourceName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleContactsService.getContact(supabase, user.id, resourceName);
}

export async function toggleFavoriteContact(resourceName: string, isFavorite: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return GoogleContactsService.updateContactMetadata(supabase, user.id, resourceName, { isFavorite });
}

// Notes & Knowledge System Client Helpers
export async function fetchNotes(options: ListNotesOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.listNotes(supabase, user.id, options);
}

export async function getNoteDetails(noteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.getNoteById(supabase, user.id, noteId);
}

export async function saveNote(payload: {
  id?: string;
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.upsertNote(supabase, user.id, payload);
}

export async function removeNote(noteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.deleteNote(supabase, user.id, noteId);
}

export async function togglePinNote(noteId: string, isPinned: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.toggleNoteState(supabase, user.id, noteId, { isPinned });
}

export async function toggleArchiveNote(noteId: string, isArchived: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.toggleNoteState(supabase, user.id, noteId, { isArchived });
}

export async function fetchNoteVersions(noteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotesService.getNoteVersions(supabase, noteId);
}

// Follow-Up & Relationship Manager Client Helpers
export async function fetchFollowUps(options: ListFollowUpsOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return FollowUpsService.listFollowUps(supabase, user.id, options);
}

export async function saveFollowUp(payload: {
  id?: string;
  title: string;
  personName?: string;
  organizationName?: string;
  category?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "pending" | "completed" | "cancelled" | "snoozed";
  followupDate?: string;
  notes?: string;
  tags?: string[];
  links?: Array<{ entityType: string; entityId: string; entityTitle: string }>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return FollowUpsService.upsertFollowUp(supabase, user.id, payload);
}

export async function markFollowUpComplete(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return FollowUpsService.completeFollowUp(supabase, user.id, id);
}

export async function removeFollowUp(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return FollowUpsService.deleteFollowUp(supabase, user.id, id);
}

export async function fetchRelationshipTimeline(personOrOrg: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return FollowUpsService.getRelationshipTimeline(supabase, user.id, personOrOrg);
}

// AI Planner & Daily Intelligence Client Helpers
export async function fetchMorningBrief(dateStr?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return PlannerService.generateMorningBrief(supabase, user.id, dateStr ? { dateStr } : {});
}

export async function fetchEveningReview(dateStr?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return PlannerService.generateEveningReview(supabase, user.id, dateStr ? { dateStr } : {});
}

export async function fetchDailyTimeline() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return PlannerService.getDailyTimeline(supabase, user.id);
}

// AI Automation Engine Client Helpers
export async function fetchAutomations(options: ListAutomationsOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.ensureDefaultAutomations(supabase, user.id);
}

export async function saveAutomation(payload: {
  id?: string;
  name: string;
  description?: string;
  isEnabled?: boolean;
  triggerType: string;
  triggerConfig: any;
  conditions: any[];
  actions: any[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.upsertAutomation(supabase, user.id, payload);
}

export async function toggleAutomation(data: { id: string; isEnabled: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.setAutomationEnabled(supabase, user.id, data.id, data.isEnabled);
}

export async function removeAutomation(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.deleteAutomation(supabase, user.id, id);
}

export async function triggerAutomation(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.runAutomation(supabase, user.id, id);
}

export async function fetchAutomationHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return AutomationService.getExecutionHistory(supabase, user.id);
}

// AI Notification & Attention Engine Client Helpers
export async function fetchNotifications(options: ListNotificationsOptions = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotificationService.listNotifications(supabase, user.id, options);
}

export async function markNotificationRead(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotificationService.markAsRead(supabase, user.id, id);
}

export async function clearReadNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotificationService.clearAllRead(supabase, user.id);
}

export async function createNotification(payload: {
  type: any;
  title: string;
  message: string;
  urgency?: any;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotificationService.createNotification(supabase, user.id, payload);
}

export async function registerDeviceToken(fcmToken: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return NotificationService.registerDeviceToken(supabase, user.id, fcmToken);
}
