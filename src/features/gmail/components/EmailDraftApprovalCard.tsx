import { useState } from "react";
import { Send, Edit3, Mail, CheckCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EmailDraftApprovalCardProps {
  to: string;
  subject: string;
  body: string;
  onApproveSend: (to: string, subject: string, body: string) => void;
  onEdit?: () => void;
  isSending?: boolean;
  isSent?: boolean;
}

export function EmailDraftApprovalCard({
  to,
  subject,
  body,
  onApproveSend,
  onEdit,
  isSending = false,
  isSent = false,
}: EmailDraftApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTo, setEditedTo] = useState(to);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);

  const handleSend = () => {
    onApproveSend(editedTo, editedSubject, editedBody);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/80 bg-card shadow-md transition-all max-w-lg">
      {/* Gmail Window Header */}
      <div className="flex items-center justify-between bg-accent/60 px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            {isEditing ? "Editing Gmail Draft" : "Gmail Draft Preview"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isSent ? (
            <>
              <CheckCircle className="size-3.5 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-500">Email Sent</span>
            </>
          ) : isEditing ? (
            <>
              <Edit3 className="size-3 text-primary animate-pulse" />
              <span className="text-[11px] font-semibold text-primary">In-Card Edit Mode</span>
            </>
          ) : (
            <>
              <span className="flex size-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">Pending Approval</span>
            </>
          )}
        </div>
      </div>

      {/* Gmail Form Content */}
      <div className="p-4 space-y-3">
        <div className="space-y-2.5 text-xs">
          {/* To Field */}
          <div className="flex items-center gap-2 border-b border-border/30 pb-2">
            <span className="w-14 font-semibold text-muted-foreground shrink-0">To:</span>
            {isEditing ? (
              <Input
                value={editedTo}
                onChange={(e) => setEditedTo(e.target.value)}
                className="h-8 text-xs font-medium"
                placeholder="recipient@example.com"
              />
            ) : (
              <span className="font-medium text-foreground truncate rounded bg-accent/30 px-2 py-0.5">
                {editedTo || "(No recipient specified)"}
              </span>
            )}
          </div>

          {/* Subject Field */}
          <div className="flex items-center gap-2 border-b border-border/30 pb-2">
            <span className="w-14 font-semibold text-muted-foreground shrink-0">Subject:</span>
            {isEditing ? (
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="h-8 text-xs font-semibold"
                placeholder="Email Subject"
              />
            ) : (
              <span className="font-semibold text-foreground truncate">
                {editedSubject || "(No subject)"}
              </span>
            )}
          </div>

          {/* Body Field */}
          <div className="mt-2 space-y-1">
            <span className="font-semibold text-muted-foreground">Message Body:</span>
            {isEditing ? (
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={6}
                className="text-xs leading-relaxed font-sans resize-none"
                placeholder="Type your message body..."
              />
            ) : (
              <div className="rounded-lg bg-accent/20 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto border border-border/30 font-sans">
                {editedBody || "(Empty message body)"}
              </div>
            )}
          </div>
        </div>

        {/* Interactive Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2 border-t border-border/40">
          {isSent ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-500">
              <CheckCircle className="size-4" />
              Email Sent to {editedTo}
            </div>
          ) : isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending || !editedTo.trim()}
                className="flex-1 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Send className="size-3.5" />
                {isSending ? "Sending Email..." : "Approve & Send Email"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="gap-1 text-xs font-medium"
              >
                <Check className="size-3.5 text-emerald-500" />
                Done Editing
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isSending}
                className="flex-1 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Send className="size-3.5" />
                {isSending ? "Sending Email..." : "Approve & Send Email"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                  if (onEdit) onEdit();
                }}
                disabled={isSending}
                className="gap-1.5 text-xs font-semibold hover:bg-accent"
              >
                <Edit3 className="size-3.5 text-muted-foreground" />
                Edit Draft
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
