import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/services/logger";
import { GoogleCalendarService } from "@/features/calendar/services.server";
import type { CalendarEvent } from "@/features/calendar/types";

export interface AIContext {
  userId: string;
  now: string;
  recentChat: Array<{ role: string; content: string }>;
  relevantMemories: Array<{ title: string; content: string; kind: string }>;
  pendingTasks: Array<{ title: string; priority: string; due_at: string | null }>;
  todaysEvents: CalendarEvent[];
  nextMeeting?: CalendarEvent;
}

export async function buildAIContext(
  supabase: SupabaseClient,
  userId: string,
  userQuery: string,
): Promise<AIContext> {
  const nowObj = new Date();
  const now = nowObj.toISOString();
  const endOfDay = new Date(nowObj);
  endOfDay.setUTCHours(23, 59, 59, 999);

  try {
    const like = userQuery ? `%${userQuery}%` : "";

    const [tasksRes, memoriesRes, calendarEvents] = await Promise.all([
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
      GoogleCalendarService.listEvents(supabase, userId, now, endOfDay.toISOString()).catch(() => []),
    ]);

    const nextMeeting = calendarEvents.find((evt) => evt.start.dateTime && new Date(evt.start.dateTime) > nowObj);

    return {
      userId,
      now,
      recentChat: [],
      relevantMemories: memoriesRes.data ?? [],
      pendingTasks: tasksRes.data ?? [],
      todaysEvents: calendarEvents,
      ...(nextMeeting ? { nextMeeting } : {}),
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
    };
  }
}
