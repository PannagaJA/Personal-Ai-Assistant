import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../services/logger.js";
import { GoogleCalendarService } from "../calendar/services.server.js";
import { GmailService } from "../gmail/services.server.js";
import { GoogleContactsService } from "../contacts/services.server.js";
import { NotesService } from "../notes/services.server.js";
import { FollowUpsService } from "../followups/services.server.js";
import type { CalendarEvent, FreeTimeSlot } from "../calendar/types.js";
import type { GmailMessage } from "../gmail/types.js";
import type { GoogleContact } from "../contacts/types.js";
import type { UserNote } from "../notes/types.js";
import type { FollowUpItem } from "../followups/types.js";
import { getStartOfDayIso, getEndOfDayIso } from "../calendar/utils.js";

export interface AIContext {
  userId: string;
  now: string;
  recentChat: Array<{ role: string; content: string }>;
  relevantMemories: Array<{ title: string; content: string; kind: string }>;
  pendingTasks: Array<{ title: string; priority: string; due_at: string | null }>;
  todaysEvents: CalendarEvent[];
  nextMeeting?: CalendarEvent;
  freeSlotsToday?: FreeTimeSlot[];
  unreadEmails: GmailMessage[];
  relevantContacts: GoogleContact[];
  relevantNotes: UserNote[];
  pendingFollowUps: FollowUpItem[];
}

export async function buildAIContext(
  supabase: SupabaseClient,
  userId: string,
  userQuery: string,
): Promise<AIContext> {
  const nowObj = new Date();
  const now = nowObj.toISOString();
  const startOfDay = getStartOfDayIso(nowObj);
  const endOfDay = getEndOfDayIso(nowObj);

  try {
    const like = userQuery ? `%${userQuery}%` : "";

    const [tasksRes, memoriesRes, calendarEvents, unreadEmailRes, contactsRes, notesRes, followupsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("title, priority, due_at")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(10),
      like
        ? supabase
            .from("memories")
            .select("title, content, kind")
            .eq("user_id", userId)
            .or(`title.ilike.${like},content.ilike.${like}`)
            .limit(5)
        : supabase
            .from("memories")
            .select("title, content, kind")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(5),
      GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
      GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
      userQuery
        ? GoogleContactsService.searchContacts(supabase, userId, userQuery).catch(() => [])
        : GoogleContactsService.listContacts(supabase, userId, { pageSize: 10 }).then((res) => res.contacts).catch(() => []),
      NotesService.listNotes(supabase, userId, { query: userQuery, limit: 5 }).catch(() => []),
      FollowUpsService.listFollowUps(supabase, userId, { status: "pending", query: userQuery, limit: 5 }).catch(() => []),
    ]);

    const nextMeeting = calendarEvents.find(
      (evt) => evt.start.dateTime && new Date(evt.start.dateTime) > nowObj,
    );

    const freeSlotsToday = await GoogleCalendarService.findFreeTime(
      supabase,
      userId,
      now,
      endOfDay,
      30,
    ).catch(() => []);

    return {
      userId,
      now,
      recentChat: [],
      relevantMemories: memoriesRes.data ?? [],
      pendingTasks: tasksRes.data ?? [],
      todaysEvents: calendarEvents,
      ...(nextMeeting ? { nextMeeting } : {}),
      freeSlotsToday,
      unreadEmails: unreadEmailRes.messages ?? [],
      relevantContacts: contactsRes.slice(0, 5),
      relevantNotes: notesRes.slice(0, 5),
      pendingFollowUps: followupsRes.slice(0, 5),
    };
  } catch (err) {
    logger.error("ai_request", "Failed to build AI context", { error: String(err) }, userId);
    return {
      userId,
      now,
      recentChat: [],
      relevantMemories: [],
      pendingTasks: [],
      todaysEvents: [],
      freeSlotsToday: [],
      unreadEmails: [],
      relevantContacts: [],
      relevantNotes: [],
      pendingFollowUps: [],
    };
  }
}
