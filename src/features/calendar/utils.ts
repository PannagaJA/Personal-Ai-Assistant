import type { CalendarEvent, FreeTimeSlot } from "./types.js";

export function formatEventTime(evt: CalendarEvent): string {
  if (evt.isAllDay || evt.start.date) {
    return "All Day";
  }
  if (!evt.start.dateTime || !evt.end.dateTime) {
    return "Time unknown";
  }
  const start = new Date(evt.start.dateTime);
  const end = new Date(evt.end.dateTime);

  const startStr = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  const endStr = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  return `${startStr} - ${endStr}`;
}

export function formatEventDateHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getStartOfDayIso(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getEndOfDayIso(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function getStartOfWeekIso(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getEndOfWeekIso(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (7 - (day === 0 ? 7 : day)); // Sunday end
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function getStartOfMonthIso(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function getEndOfMonthIso(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function calculateFreeSlots(
  events: CalendarEvent[],
  dayStartIso: string,
  dayEndIso: string,
  minDurationMinutes: number = 30
): FreeTimeSlot[] {
  const slots: FreeTimeSlot[] = [];
  let currentStart = new Date(dayStartIso).getTime();
  const dayEnd = new Date(dayEndIso).getTime();

  // Filter & sort timed events
  const timedEvents = events
    .filter((e) => e.start.dateTime && e.end.dateTime)
    .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());

  for (const evt of timedEvents) {
    const evtStart = new Date(evt.start.dateTime!).getTime();
    const evtEnd = new Date(evt.end.dateTime!).getTime();

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
