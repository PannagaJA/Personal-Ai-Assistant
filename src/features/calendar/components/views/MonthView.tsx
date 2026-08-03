import type { CalendarEvent } from "../../types";
import { isSameDay, formatEventTime } from "../../utils";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (evt: CalendarEvent) => void;
  onSelectDate: (date: Date) => void;
}

export function MonthView({ currentDate, events, onSelectEvent, onSelectDate }: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const today = new Date();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="grid grid-cols-7 border-b border-border/40 pb-2 text-center text-xs font-semibold text-muted-foreground">
        {dayNames.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 pt-2">
        {days.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="h-28 rounded-md bg-accent/10" />;
          }

          const isToday = isSameDay(date, today);
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
              onClick={() => onSelectDate(date)}
              className={`group flex h-28 flex-col justify-between rounded-lg border p-1.5 transition cursor-pointer hover:border-primary/50 ${
                isToday ? "border-primary/60 bg-primary/5" : "border-border/30 bg-card/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="text-[10px] text-muted-foreground">{dayEvents.length} ev</span>
                ) : null}
              </div>

              <div className="mt-1 flex-1 overflow-y-auto space-y-1">
                {dayEvents.slice(0, 3).map((evt) => (
                  <button
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(evt);
                    }}
                    className="w-full truncate rounded bg-primary/20 px-1 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/30"
                  >
                    {evt.summary}
                  </button>
                ))}
                {dayEvents.length > 3 ? (
                  <p className="text-[10px] text-muted-foreground pl-1">
                    +{dayEvents.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
