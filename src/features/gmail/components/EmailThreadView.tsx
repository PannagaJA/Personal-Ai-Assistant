import { useState } from "react";
import { ArrowLeft, Send, Paperclip, Archive, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { GmailThread, GmailMessage, ReplyInput } from "../types";
import { extractSenderName, formatEmailDate } from "../utils";

interface EmailThreadViewProps {
  thread: GmailThread;
  onBack: () => void;
  onSendReply: (input: ReplyInput) => void;
  onArchiveMessage?: (id: string) => void;
  isSending?: boolean;
}

export function EmailThreadView({
  thread,
  onBack,
  onSendReply,
  onArchiveMessage,
  isSending = false,
}: EmailThreadViewProps) {
  const [replyBody, setReplyBody] = useState("");
  const firstMsg = thread.messages[0];
  const lastMsg = thread.messages[thread.messages.length - 1];

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !lastMsg) return;

    onSendReply({
      threadId: thread.id,
      messageId: lastMsg.id,
      to: lastMsg.from,
      subject: firstMsg?.subject || "No Subject",
      body: replyBody.trim(),
    });

    setReplyBody("");
  };

  return (
    <div className="glass-panel flex h-full flex-col rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button size="icon-sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-foreground">
              {firstMsg?.subject || "Email Conversation"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {thread.messages.length} message{thread.messages.length > 1 ? "s" : ""} in thread
            </p>
          </div>
        </div>

        {onArchiveMessage && lastMsg ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onArchiveMessage(lastMsg.id)}
            className="gap-1.5 text-xs"
          >
            <Archive className="size-3.5" />
            Archive Thread
          </Button>
        ) : null}
      </div>

      {/* Messages Stream */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
        {thread.messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-foreground">{extractSenderName(msg.from)}</p>
                <p className="text-xs text-muted-foreground">To: {msg.to}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatEmailDate(msg.date)}</span>
            </div>

            {/* Email Body */}
            <div className="text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed font-sans pt-2 border-t border-border/20">
              {msg.bodyText || msg.snippet}
            </div>

            {/* Attachments */}
            {msg.attachments && msg.attachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/20">
                {msg.attachments.map((att) => (
                  <Badge key={att.id} variant="secondary" className="gap-1 text-[11px]">
                    <Paperclip className="size-3 text-muted-foreground" />
                    {att.filename} ({Math.round(att.size / 1024)} KB)
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Quick Reply Form */}
      <form onSubmit={handleReplySubmit} className="mt-4 border-t border-border/40 pt-4 space-y-3">
        <Textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder={`Reply to ${extractSenderName(lastMsg?.from || "")}...`}
          rows={3}
          className="text-xs resize-none"
        />

        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setReplyBody((prev) => prev + "\nThank you,\nJarvis Assistant")}
            className="text-xs text-muted-foreground"
          >
            <Sparkles className="size-3 text-primary mr-1" />
            Add Sign-off
          </Button>

          <Button type="submit" size="sm" disabled={isSending || !replyBody.trim()} className="gap-1.5 text-xs font-semibold">
            <Send className="size-3.5" />
            {isSending ? "Sending..." : "Send Reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
