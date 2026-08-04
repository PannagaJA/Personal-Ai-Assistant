import { z } from "zod";
import type { AITool } from "../ai/tools/registry.js";
import { GoogleCalendarService } from "./services.server.js";
import {
  getStartOfDayIso,
  getEndOfDayIso,
  getStartOfWeekIso,
  getEndOfWeekIso,
} from "./utils.js";

export const listTodayEventsTool: AITool = {
  id: "calendar_list_today",
  name: "List Today's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const start = getStartOfDayIso();
      const end = getEndOfDayIso();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const listTomorrowEventsTool: AITool = {
  id: "calendar_list_tomorrow",
  name: "List Tomorrow's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for tomorrow.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = getStartOfDayIso(tomorrow);
      const end = getEndOfDayIso(tomorrow);
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const listWeekEventsTool: AITool = {
  id: "calendar_list_week",
  name: "List This Week's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for the current week.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const start = getStartOfWeekIso();
      const end = getEndOfWeekIso();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const searchCalendarEventsTool: AITool = {
  id: "calendar_search",
  name: "Search Calendar Events",
  description: "Search Google Calendar events by keyword query (title, description, location).",
  parameters: z.object({
    query: z.string().describe("Search keyword query"),
    timeMin: z.string().optional().describe("ISO 8601 start time constraint"),
    timeMax: z.string().optional().describe("ISO 8601 end time constraint"),
  }),
  execute: async ({ query, timeMin, timeMax }, { supabase, userId }) => {
    try {
      const start = timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = timeMax || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end, query);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const createCalendarEventTool: AITool = {
  id: "calendar_create",
  name: "Create Calendar Event",
  description: "Schedule or create a new meeting or event in Google Calendar.",
  parameters: z.object({
    summary: z.string().describe("Title or summary of the meeting/event"),
    description: z.string().optional().describe("Description or agenda"),
    startDateTime: z.string().describe("ISO 8601 start datetime"),
    endDateTime: z.string().describe("ISO 8601 end datetime"),
    location: z.string().optional().describe("Location or video call link"),
    isAllDay: z.boolean().optional().describe("Whether this is an all-day event"),
    attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.createEvent(supabase, userId, params);
      return { success: true, message: `Scheduled event "${event.summary}"`, data: { event } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const updateCalendarEventTool: AITool = {
  id: "calendar_update",
  name: "Update Calendar Event",
  description: "Update an existing Google Calendar event by ID.",
  parameters: z.object({
    eventId: z.string().describe("Event ID to update"),
    summary: z.string().optional().describe("Updated summary/title"),
    description: z.string().optional().describe("Updated description"),
    startDateTime: z.string().optional().describe("Updated ISO 8601 start time"),
    endDateTime: z.string().optional().describe("Updated ISO 8601 end time"),
    location: z.string().optional().describe("Updated location"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.updateEvent(supabase, userId, params);
      return { success: true, message: `Updated event "${event.summary}"`, data: { event } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const deleteCalendarEventTool: AITool = {
  id: "calendar_delete",
  name: "Delete Calendar Event",
  description: "Delete an event from Google Calendar by event ID.",
  parameters: z.object({
    eventId: z.string().describe("Event ID to delete"),
  }),
  execute: async ({ eventId }, { supabase, userId }) => {
    try {
      await GoogleCalendarService.deleteEvent(supabase, userId, eventId);
      return { success: true, message: `Successfully deleted event` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const findFreeTimeTool: AITool = {
  id: "calendar_find_free_time",
  name: "Find Free Time",
  description: "Find available free time slots in the user's schedule for a target date.",
  parameters: z.object({
    dayStartIso: z.string().describe("ISO 8601 start of target range (e.g. 2026-08-04T09:00:00Z)"),
    dayEndIso: z.string().describe("ISO 8601 end of target range (e.g. 2026-08-04T18:00:00Z)"),
    minDurationMinutes: z.number().default(30).describe("Minimum slot duration in minutes"),
  }),
  execute: async ({ dayStartIso, dayEndIso, minDurationMinutes }, { supabase, userId }) => {
    try {
      const freeSlots = await GoogleCalendarService.findFreeTime(
        supabase,
        userId,
        dayStartIso,
        dayEndIso,
        minDurationMinutes,
      );
      return { success: true, data: { freeSlots, totalSlots: freeSlots.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const detectConflictsTool: AITool = {
  id: "calendar_detect_conflicts",
  name: "Detect Calendar Conflicts",
  description: "Check if a proposed meeting slot conflicts with existing meetings.",
  parameters: z.object({
    startDateTime: z.string().describe("ISO 8601 start time"),
    endDateTime: z.string().describe("ISO 8601 end time"),
  }),
  execute: async ({ startDateTime, endDateTime }, { supabase, userId }) => {
    try {
      const conflict = await GoogleCalendarService.detectConflicts(
        supabase,
        userId,
        startDateTime,
        endDateTime,
      );
      return { success: true, data: conflict };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const getNextEventTool: AITool = {
  id: "calendar_next_event",
  name: "Get Next Upcoming Meeting",
  description: "Retrieve details of the user's immediate next upcoming meeting today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const nextEvent = await GoogleCalendarService.getNextEvent(supabase, userId);
      return { success: true, data: { nextEvent } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
