import type { CalendarEvent } from "../../types";
import { formatEventDateHeader } from "../../utils";
import { EventCard } from "../EventCard";

interface AgendaViewProps {
  events: CalendarEvent[];
  onSelectEvent: (evt: CalendarEvent) => void;
  onDeleteEvent: (evtId: string) => void;
}

export function AgendaView({ events, onSelectEvent, onDeleteEvent }: AgendaViewProps) {
  // Group events by date
  const grouped: Record<string, CalendarEvent[]> = {};

  events.forEach((evt) => {
    const rawDate = evt.start.dateTime || evt.start.date || "";
    if (!rawDate) return;
    const dateObj = new Date(rawDate);
    const dateKey = formatEventDateHeader(dateObj);

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(evt);
  });

  const dateKeys = Object.keys(grouped);

  return (
    <div className="glass-panel rounded-xl p-5 space-y-6">
      {dateKeys.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No upcoming events found.</p>
        </div>
      ) : (
        dateKeys.map((dateKey) => (
          <div key={dateKey} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              {dateKey}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(grouped[dateKey] ?? []).map((evt) => (
                <EventCard
                  key={evt.id}
                  event={evt}
                  onEdit={onSelectEvent}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
