import { Bell, CheckCircle2, AlertCircle, Calendar, Clock, Archive } from "lucide-react";
import type { NotificationItem } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NotificationCardProps {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}

export function NotificationCard({ notification, onMarkRead }: NotificationCardProps) {
  const urgencyBadge =
    notification.urgency === "critical"
      ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
      : notification.urgency === "high"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-slate-500/20 text-slate-400 border-slate-500/30";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-4 shadow-xs transition hover:bg-accent/30 ${
        !notification.isRead ? "bg-card border-primary/30" : "bg-card/40 opacity-75"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="size-4" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-sm text-foreground">{notification.title}</h4>
            <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${urgencyBadge}`}>
              {notification.urgency}
            </Badge>
          </div>

          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{notification.message}</p>
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {!notification.isRead && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-primary"
          onClick={() => onMarkRead(notification.id)}
        >
          Mark Read
        </Button>
      )}
    </div>
  );
}
