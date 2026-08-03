import type { CalendarEvent } from "../../types";
import { isSameDay, formatEventTime } from "../../utils";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (evt: CalendarEvent) => void;
}

export function WeekView({ currentDate, events, onSelectEvent }: WeekViewProps) {
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const today = new Date();

  return (
    <div className="glass-panel overflow-x-auto rounded-xl p-4">
      <div className="grid min-w-[700px] grid-cols-7 gap-2 border-b border-border/40 pb-3 text-center">
        {weekDays.map((date) => {
          const isToday = isSameDay(date, today);
          return (
            <div key={date.toISOString()} className="flex flex-col items-center">
              <span className="text-xs font-semibold text-muted-foreground">
                {date.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span
                className={`mt-1 flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
                }`}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid min-w-[700px] grid-cols-7 gap-2 pt-3">
        {weekDays.map((date) => {
          const dayEvents = events.filter((e) => {
            const eStart = e.start.dateTime
              ? new Date(e.start.dateTime)
              : e.start.date
              ? new Date(e.start.date)
              : null;
            return eStart && isSameDay(eStart, date);
          });

          return (
            <div
              key={date.toISOString()}
              className="min-h-[350px] space-y-2 rounded-lg border border-border/30 bg-card/30 p-2"
            >
              {dayEvents.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground/60">No events</p>
              ) : (
                dayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => onSelectEvent(evt)}
                    className="cursor-pointer rounded-md bg-accent/60 p-2 text-left transition hover:bg-accent hover:border-primary/40 border border-transparent"
                  >
                    <p className="truncate text-xs font-semibold text-foreground">{evt.summary}</p>
                    <p className="text-[10px] text-muted-foreground">{formatEventTime(evt)}</p>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
