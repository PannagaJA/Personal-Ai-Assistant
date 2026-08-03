import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleAuthService } from "@/services/google-auth.server";
import { logger } from "@/services/logger";
import type { CalendarEvent, FreeTimeSlot, ConflictResult } from "./types";

export class GoogleCalendarService {
  private static async fetchGoogleCalendarApi(
    supabase: SupabaseClient,
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ) {
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error("Google Calendar access token is missing or expired. Please re-authenticate with Google.");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API Error (${response.status}): ${errorText}`);
    }

    return response.status === 204 ? null : response.json();
  }

  static async listEvents(
    supabase: SupabaseClient,
    userId: string,
    timeMin: string,
    timeMax: string,
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
      });

      const data = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events?${params}`);

      return (data?.items ?? []).map((item: any) => ({
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        location: item.location ?? undefined,
        start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined, timeZone: item.start?.timeZone ?? undefined },
        end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined, timeZone: item.end?.timeZone ?? undefined },
        htmlLink: item.htmlLink ?? undefined,
        status: item.status ?? undefined,
      }));
    } catch (err) {
      logger.error("provider", "Failed to list Google Calendar events", { error: String(err) }, userId);
      throw err;
    }
  }

  static async createEvent(
    supabase: SupabaseClient,
    userId: string,
    eventData: {
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone?: string;
      location?: string;
    },
  ): Promise<CalendarEvent> {
    try {
      const item = await this.fetchGoogleCalendarApi(supabase, userId, "/calendars/primary/events", {
        method: "POST",
        body: JSON.stringify({
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: { dateTime: eventData.startDateTime, timeZone: eventData.timeZone || "UTC" },
          end: { dateTime: eventData.endDateTime, timeZone: eventData.timeZone || "UTC" },
        }),
      });

      logger.info("tool_call", `Created Google Calendar event: ${item.summary}`, { eventId: item.id }, userId);

      return {
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? undefined,
        start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined },
        end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined },
        htmlLink: item.htmlLink ?? undefined,
      };
    } catch (err) {
      logger.error("provider", "Failed to create Google Calendar event", { error: String(err) }, userId);
      throw err;
    }
  }

  static async updateEvent(
    supabase: SupabaseClient,
    userId: string,
    eventId: string,
    eventData: {
      summary?: string;
      description?: string;
      startDateTime?: string;
      endDateTime?: string;
    },
  ): Promise<CalendarEvent> {
    try {
      const existing = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`);

      const item = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({
          summary: eventData.summary ?? existing.summary,
          description: eventData.description ?? existing.description,
          start: eventData.startDateTime ? { dateTime: eventData.startDateTime } : existing.start,
          end: eventData.endDateTime ? { dateTime: eventData.endDateTime } : existing.end,
        }),
      });

      return {
        id: item.id!,
        summary: item.summary ?? "Untitled Event",
        start: { dateTime: item.start?.dateTime ?? undefined },
        end: { dateTime: item.end?.dateTime ?? undefined },
      };
    } catch (err) {
      logger.error("provider", `Failed to update event ${eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async deleteEvent(supabase: SupabaseClient, userId: string, eventId: string): Promise<boolean> {
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
    return {
      hasConflict: events.length > 0,
      conflictingEvents: events,
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
    const slots: FreeTimeSlot[] = [];

    let currentStart = new Date(dayStartIso).getTime();
    const dayEnd = new Date(dayEndIso).getTime();

    for (const evt of events) {
      const evtStart = evt.start.dateTime ? new Date(evt.start.dateTime).getTime() : currentStart;
      const evtEnd = evt.end.dateTime ? new Date(evt.end.dateTime).getTime() : currentStart;

      if (evtStart > currentStart) {
        const duration = Math.floor((evtStart - currentStart) / 60000);
        if (duration >= minDurationMinutes) {
          slots.push({
            start: new Date(currentStart).toISOString(),
            end: new Date(evtStart).toISOString(),
            durationMinutes: duration,
          });
        }
      }
      if (evtEnd > currentStart) {
        currentStart = evtEnd;
      }
    }

    if (dayEnd > currentStart) {
      const duration = Math.floor((dayEnd - currentStart) / 60000);
      if (duration >= minDurationMinutes) {
        slots.push({
          start: new Date(currentStart).toISOString(),
          end: new Date(dayEnd).toISOString(),
          durationMinutes: duration,
        });
      }
    }

    return slots;
  }
}
