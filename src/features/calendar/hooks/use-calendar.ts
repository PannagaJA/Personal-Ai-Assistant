import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/assistant.functions";
import type { CreateEventInput, UpdateEventInput } from "../types";

export function useCalendarEvents(timeMin: string, timeMax: string, query?: string) {
  return useQuery({
    queryKey: ["calendar-events", timeMin, timeMax, query],
    queryFn: () => fetchCalendarEvents(timeMin, timeMax, query),
    staleTime: 60 * 1000,
  });
}

export function useCalendarMutations() {
  const queryClient = useQueryClient();

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateEventInput) => createCalendarEvent(input),
    onSuccess: (data) => {
      toast.success(`Scheduled "${data.summary}"`);
      invalidateCalendar();
    },
    onError: (err: Error) => {
      toast.error("Failed to create event", { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateEventInput) => updateCalendarEvent(input),
    onSuccess: (data) => {
      toast.success(`Updated "${data.summary}"`);
      invalidateCalendar();
    },
    onError: (err: Error) => {
      toast.error("Failed to update event", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteCalendarEvent(eventId),
    onSuccess: () => {
      toast.success("Event deleted from Google Calendar");
      invalidateCalendar();
    },
    onError: (err: Error) => {
      toast.error("Failed to delete event", { description: err.message });
    },
  });

  return {
    createEvent: createMutation,
    updateEvent: updateMutation,
    deleteEvent: deleteMutation,
  };
}
