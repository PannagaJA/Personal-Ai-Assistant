import { Mail, Star, Archive, CheckCircle, Circle, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GmailMessage } from "../types";
import { extractSenderName, formatEmailDate } from "../utils";

interface EmailCardProps {
  message: GmailMessage;
  onSelect: (msg: GmailMessage) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onReply?: (msg: GmailMessage) => void;
  compact?: boolean;
}

export function EmailCard({
  message,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onReply,
  compact = false,
}: EmailCardProps) {
  const senderName = extractSenderName(message.from);

  if (compact) {
    return (
      <div
        onClick={() => onSelect(message)}
        className="group flex cursor-pointer items-center justify-between rounded-lg bg-accent/40 px-3 py-2.5 text-sm transition hover:bg-accent/70"
      >
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-center gap-2">
            {message.isUnread ? (
              <span className="flex size-2 rounded-full bg-primary shrink-0" />
            ) : null}
            <p className={`truncate text-sm ${message.isUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {senderName}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">{message.subject}</p>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{formatEmailDate(message.date)}</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(message)}
      className={`group glass-panel relative flex cursor-pointer flex-col justify-between rounded-xl p-4 transition-all hover:border-primary/40 ${
        message.isUnread ? "border-l-4 border-l-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className={`truncate text-sm ${message.isUnread ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
              {senderName}
            </h4>
            {message.isImportant ? (
              <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                Important
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-1 font-semibold text-foreground truncate text-sm">{message.subject}</h3>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{formatEmailDate(message.date)}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{message.snippet}</p>

      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-2.5">
        <div className="flex items-center gap-1">
          {message.labelIds.includes("INBOX") ? (
            <Badge variant="outline" className="text-[10px]">
              Inbox
            </Badge>
          ) : null}
          {message.isStarred ? <Star className="size-3.5 fill-amber-400 text-amber-400" /> : null}
        </div>

        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
          {onReply ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onReply(message);
              }}
              title="Reply"
            >
              <CornerUpLeft className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : null}
          {message.isUnread && onMarkRead ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(message.id);
              }}
              title="Mark as read"
            >
              <CheckCircle className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : !message.isUnread && onMarkUnread ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onMarkUnread(message.id);
              }}
              title="Mark as unread"
            >
              <Circle className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : null}
          {onArchive ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(message.id);
              }}
              title="Archive"
            >
              <Archive className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
