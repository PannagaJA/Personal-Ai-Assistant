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
