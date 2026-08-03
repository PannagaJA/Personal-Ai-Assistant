import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleAuthService } from "@/services/google-auth.server";
import { logger } from "@/services/logger";
import type {
  CalendarEvent,
  FreeTimeSlot,
  ConflictResult,
  CreateEventInput,
  UpdateEventInput,
} from "./types";
import { calculateFreeSlots } from "./utils";

export class GoogleCalendarService {
  private static async fetchGoogleCalendarApi(
    supabase: SupabaseClient,
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ) {
    const startTime = Date.now();
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      logger.error("system", "Google Calendar access token missing/expired", {}, userId);
      throw new Error("Google Calendar access token is missing or expired. Please re-authenticate with Google.");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
        ...options,
        headers,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `Google Calendar API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId,
        );
        throw new Error(`Google Calendar API Error (${response.status}): ${errorText}`);
      }

      logger.info(
        "provider",
        `Google Calendar API request success: ${endpoint}`,
        { durationMs, status: response.status },
        userId,
      );

      return response.status === 204 ? null : response.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Google Calendar API request timed out.");
      }
      throw err;
    }
  }

  static async listEvents(
    supabase: SupabaseClient,
    userId: string,
    timeMin: string,
    timeMax: string,
    q?: string,
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
      });
      if (q && q.trim()) {
        params.append("q", q.trim());
      }

      const data = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events?${params}`);

      return (data?.items ?? []).map((item: any) => ({
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        location: item.location ?? undefined,
        start: {
          dateTime: item.start?.dateTime ?? undefined,
          date: item.start?.date ?? undefined,
          timeZone: item.start?.timeZone ?? undefined,
        },
        end: {
          dateTime: item.end?.dateTime ?? undefined,
          date: item.end?.date ?? undefined,
          timeZone: item.end?.timeZone ?? undefined,
        },
        htmlLink: item.htmlLink ?? undefined,
        status: item.status ?? undefined,
        hangoutLink: item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
        attendees: item.attendees?.map((att: any) => ({
          email: att.email,
          displayName: att.displayName,
          responseStatus: att.responseStatus,
        })),
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        recurrence: item.recurrence ?? undefined,
        organizer: item.organizer ? { email: item.organizer.email, displayName: item.organizer.displayName } : undefined,
      }));
    } catch (err) {
      logger.error("provider", "Failed to list Google Calendar events", { error: String(err) }, userId);
      throw err;
    }
  }

  static async getEventDetails(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
  ): Promise<CalendarEvent> {
    try {
      const item = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`);
      return {
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        location: item.location ?? undefined,
        start: {
          dateTime: item.start?.dateTime ?? undefined,
          date: item.start?.date ?? undefined,
          timeZone: item.start?.timeZone ?? undefined,
        },
        end: {
          dateTime: item.end?.dateTime ?? undefined,
          date: item.end?.date ?? undefined,
          timeZone: item.end?.timeZone ?? undefined,
        },
        htmlLink: item.htmlLink ?? undefined,
        status: item.status ?? undefined,
        hangoutLink: item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
        attendees: item.attendees?.map((att: any) => ({
          email: att.email,
          displayName: att.displayName,
          responseStatus: att.responseStatus,
        })),
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        recurrence: item.recurrence ?? undefined,
      };
    } catch (err) {
      logger.error("provider", `Failed to get event details for ${eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async createEvent(
    supabase: SupabaseClient,
    userId: string,
    eventData: CreateEventInput,
  ): Promise<CalendarEvent> {
    try {
      const body: any = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
      };

      if (eventData.isAllDay) {
        const startDateOnly = eventData.startDateTime.split("T")[0];
        const endDateOnly = eventData.endDateTime.split("T")[0];
        body.start = { date: startDateOnly };
        body.end = { date: endDateOnly };
      } else {
        body.start = { dateTime: eventData.startDateTime, timeZone: eventData.timeZone || "UTC" };
        body.end = { dateTime: eventData.endDateTime, timeZone: eventData.timeZone || "UTC" };
      }

      if (eventData.attendees && eventData.attendees.length > 0) {
        body.attendees = eventData.attendees.map((email) => ({ email }));
      }

      if (eventData.recurrence && eventData.recurrence.length > 0) {
        body.recurrence = eventData.recurrence;
      }

      const item = await this.fetchGoogleCalendarApi(supabase, userId, "/calendars/primary/events", {
        method: "POST",
        body: JSON.stringify(body),
      });

      logger.info("tool_call", `Created Google Calendar event: ${item.summary}`, { eventId: item.id }, userId);

      return {
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        location: item.location ?? undefined,
        start: {
          dateTime: item.start?.dateTime ?? undefined,
          date: item.start?.date ?? undefined,
        },
        end: {
          dateTime: item.end?.dateTime ?? undefined,
          date: item.end?.date ?? undefined,
        },
        htmlLink: item.htmlLink ?? undefined,
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
      };
    } catch (err) {
      logger.error("provider", "Failed to create Google Calendar event", { error: String(err) }, userId);
      throw err;
    }
  }

  static async updateEvent(
    supabase: SupabaseClient,
    userId: string,
    eventData: UpdateEventInput,
  ): Promise<CalendarEvent> {
    try {
      const existing = await this.getEventDetails(supabase, userId, eventData.eventId);

      const patch: any = {};
      if (eventData.summary !== undefined) patch.summary = eventData.summary;
      if (eventData.description !== undefined) patch.description = eventData.description;
      if (eventData.location !== undefined) patch.location = eventData.location;

      if (eventData.startDateTime || eventData.endDateTime) {
        const start = eventData.startDateTime ?? existing.start.dateTime ?? existing.start.date;
        const end = eventData.endDateTime ?? existing.end.dateTime ?? existing.end.date;

        if (eventData.isAllDay) {
          patch.start = { date: start?.split("T")[0] };
          patch.end = { date: end?.split("T")[0] };
        } else {
          patch.start = { dateTime: start, timeZone: eventData.timeZone || existing.start.timeZone || "UTC" };
          patch.end = { dateTime: end, timeZone: eventData.timeZone || existing.end.timeZone || "UTC" };
        }
      }

      if (eventData.attendees) {
        patch.attendees = eventData.attendees.map((email) => ({ email }));
      }

      const item = await this.fetchGoogleCalendarApi(
        supabase,
        userId,
        `/calendars/primary/events/${eventData.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      logger.info("tool_call", `Updated Google Calendar event: ${eventData.eventId}`, {}, userId);

      return {
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined },
        end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined },
      };
    } catch (err) {
      logger.error("provider", `Failed to update event ${eventData.eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async deleteEvent(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
  ): Promise<boolean> {
    try {
      await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`, {
        method: "DELETE",
      });
      logger.info("tool_call", `Deleted Google Calendar event ${eventId}`, {}, userId);
      return true;
    } catch (err) {
      logger.error("provider", `Failed to delete event ${eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async detectConflicts(
    supabase: SupabaseClient,
    userId: string,
    startDateTime: string,
    endDateTime: string,
  ): Promise<ConflictResult> {
    const events = await this.listEvents(supabase, userId, startDateTime, endDateTime);
    const conflicting = events.filter((evt) => {
      if (evt.isAllDay) return false;
      const evtStart = evt.start.dateTime ? new Date(evt.start.dateTime).getTime() : 0;
      const evtEnd = evt.end.dateTime ? new Date(evt.end.dateTime).getTime() : 0;
      const reqStart = new Date(startDateTime).getTime();
      const reqEnd = new Date(endDateTime).getTime();

      return evtStart < reqEnd && evtEnd > reqStart;
    });

    return {
      hasConflict: conflicting.length > 0,
      conflictingEvents: conflicting,
    };
  }

  static async findFreeTime(
    supabase: SupabaseClient,
    userId: string,
    dayStartIso: string,
    dayEndIso: string,
    minDurationMinutes: number = 30,
  ): Promise<FreeTimeSlot[]> {
    const events = await this.listEvents(supabase, userId, dayStartIso, dayEndIso);
    return calculateFreeSlots(events, dayStartIso, dayEndIso, minDurationMinutes);
  }

  static async getNextEvent(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<CalendarEvent | null> {
    const nowIso = new Date().toISOString();
    const endOfDayIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const events = await this.listEvents(supabase, userId, nowIso, endOfDayIso);
    const next = events.find((e) => e.start.dateTime && new Date(e.start.dateTime) > new Date());
    return next ?? null;
  }
}
