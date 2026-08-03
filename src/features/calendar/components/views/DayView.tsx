import type { CalendarEvent } from "../../types";
import { formatEventTime, isSameDay } from "../../utils";
import { EventCard } from "../EventCard";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (evt: CalendarEvent) => void;
  onDeleteEvent: (evtId: string) => void;
}

export function DayView({ currentDate, events, onSelectEvent, onDeleteEvent }: DayViewProps) {
  const dayEvents = events.filter((e) => {
    const eStart = e.start.dateTime
      ? new Date(e.start.dateTime)
      : e.start.date
      ? new Date(e.start.date)
      : null;
    return eStart && isSameDay(eStart, currentDate);
  });

  return (
    <div className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <h2 className="text-base font-semibold">
          {currentDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <span className="text-xs text-muted-foreground">{dayEvents.length} scheduled</span>
      </div>

      {dayEvents.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No meetings or events for this day.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Enjoy your free time or schedule a new event.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dayEvents.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              onEdit={onSelectEvent}
              onDelete={onDeleteEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
