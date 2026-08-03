import { z } from "zod";
import type { AITool } from "@/features/ai/tools/registry";
import { GoogleCalendarService } from "./services.server";

export const listCalendarEventsTool: AITool = {
  id: "calendar_list",
  name: "List Calendar Events",
  description: "List the user's Google Calendar events for a specific time range.",
  parameters: z.object({
    timeMin: z.string().describe("ISO 8601 start time limit"),
    timeMax: z.string().describe("ISO 8601 end time limit"),
  }),
  execute: async ({ timeMin, timeMax }, { supabase, userId }) => {
    try {
      const events = await GoogleCalendarService.listEvents(supabase, userId, timeMin, timeMax);
      return { success: true, data: { events } };
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
    location: z.string().optional(),
  }),
  execute: async ({ summary, description, startDateTime, endDateTime, location }, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.createEvent(supabase, userId, {
        summary,
        description,
        startDateTime,
        endDateTime,
        location,
      });
      return { success: true, message: `Scheduled "${summary}"`, data: { event } };
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
    eventId: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
  }),
  execute: async ({ eventId, summary, description, startDateTime, endDateTime }, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.updateEvent(supabase, userId, eventId, {
        summary,
        description,
        startDateTime,
        endDateTime,
      });
      return { success: true, message: `Updated event`, data: { event } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const deleteCalendarEventTool: AITool = {
  id: "calendar_delete",
  name: "Delete Calendar Event",
  description: "Delete an event from Google Calendar by ID.",
  parameters: z.object({
    eventId: z.string(),
  }),
  execute: async ({ eventId }, { supabase, userId }) => {
    try {
      await GoogleCalendarService.deleteEvent(supabase, userId, eventId);
      return { success: true, message: `Event deleted` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const findFreeTimeTool: AITool = {
  id: "calendar_free_time",
  name: "Find Free Time",
  description: "Find available free time slots in the user's schedule for a given date.",
  parameters: z.object({
    dayStartIso: z.string().describe("ISO 8601 start of day (e.g. 2026-08-03T09:00:00Z)"),
    dayEndIso: z.string().describe("ISO 8601 end of day (e.g. 2026-08-03T18:00:00Z)"),
    minDurationMinutes: z.number().default(30),
  }),
  execute: async ({ dayStartIso, dayEndIso, minDurationMinutes }, { supabase, userId }) => {
    try {
      const freeSlots = await GoogleCalendarService.findFreeTime(supabase, userId, dayStartIso, dayEndIso, minDurationMinutes);
      return { success: true, data: { freeSlots } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const detectConflictsTool: AITool = {
  id: "calendar_conflicts",
  name: "Detect Calendar Conflicts",
  description: "Check if a proposed meeting slot conflicts with existing events.",
  parameters: z.object({
    startDateTime: z.string().describe("ISO 8601 start time"),
    endDateTime: z.string().describe("ISO 8601 end time"),
  }),
  execute: async ({ startDateTime, endDateTime }, { supabase, userId }) => {
    try {
      const conflict = await GoogleCalendarService.detectConflicts(supabase, userId, startDateTime, endDateTime);
      return { success: true, data: conflict };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
