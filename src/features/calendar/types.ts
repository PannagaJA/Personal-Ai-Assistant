export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
  status?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  isAllDay?: boolean;
  recurrence?: string[];
  hangoutLink?: string;
  organizer?: { email?: string; displayName?: string };
}

export interface FreeTimeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingEvents: CalendarEvent[];
}

export type CalendarViewMode = "month" | "week" | "day" | "agenda";

export interface CreateEventInput {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  timeZone?: string;
  isAllDay?: boolean;
  attendees?: string[];
  recurrence?: string[];
}

export interface UpdateEventInput {
  eventId: string;
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  timeZone?: string;
  isAllDay?: boolean;
  attendees?: string[];
}

export interface FreeTimeQuery {
  dayStartIso: string;
  dayEndIso: string;
  minDurationMinutes?: number;
}

export interface ConflictCheckQuery {
  startDateTime: string;
  endDateTime: string;
}
