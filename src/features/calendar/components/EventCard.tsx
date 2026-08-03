import { Calendar, Clock, MapPin, Video, ExternalLink, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "../types";
import { formatEventTime } from "../utils";

interface EventCardProps {
  event: CalendarEvent;
  onEdit?: (evt: CalendarEvent) => void;
  onDelete?: (evtId: string) => void;
  compact?: boolean;
}

export function EventCard({ event, onEdit, onDelete, compact = false }: EventCardProps) {
  const isPast =
    event.end.dateTime && new Date(event.end.dateTime).getTime() < Date.now();

  if (compact) {
    return (
      <div className="group flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-sm transition hover:bg-accent/70">
        <div className="min-w-0 flex-1 pr-2">
          <p className="truncate font-medium text-foreground">{event.summary}</p>
          <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
        </div>
        {event.htmlLink ? (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Open
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`glass-panel relative flex flex-col justify-between rounded-xl p-4 transition-all hover:border-primary/40 ${
        isPast ? "opacity-75" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{event.summary}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatEventTime(event)}
            </span>
            {event.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {event.location}
              </span>
            ) : null}
          </div>
        </div>
        {event.isAllDay ? (
          <Badge variant="outline" className="text-xs font-normal">
            All Day
          </Badge>
        ) : isPast ? (
          <Badge variant="secondary" className="text-xs font-normal">
            Ended
          </Badge>
        ) : (
          <Badge variant="default" className="bg-primary/20 text-xs text-primary hover:bg-primary/30">
            Upcoming
          </Badge>
        )}
      </div>

      {event.description ? (
        <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">
          {event.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex items-center gap-2">
          {event.hangoutLink ? (
            <Button size="sm" variant="secondary" asChild className="gap-1.5 text-xs">
              <a href={event.hangoutLink} target="_blank" rel="noreferrer">
                <Video className="size-3 text-primary" />
                Join Video Call
              </a>
            </Button>
          ) : null}
          {event.htmlLink ? (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground transition hover:text-foreground"
              title="View in Google Calendar"
            >
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onEdit ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onEdit(event)}
              title="Edit event"
            >
              <Edit3 className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onDelete(event.id)}
              title="Delete event"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
