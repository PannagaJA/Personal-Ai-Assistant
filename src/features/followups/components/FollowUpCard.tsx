import { Clock, Calendar, CheckCircle2, Building2, User, AlertCircle, Trash2, ArrowRight } from "lucide-react";
import type { FollowUpItem } from "../types";
import { isOverdue, getPriorityBadgeColor, getStatusBadgeColor } from "../utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FollowUpCardProps {
  followup: FollowUpItem;
  onEdit: (item: FollowUpItem) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onViewTimeline?: (personOrOrg: string) => void;
}

export function FollowUpCard({
  followup,
  onEdit,
  onComplete,
  onDelete,
  onViewTimeline,
}: FollowUpCardProps) {
  const overdue = isOverdue(followup.followupDate, followup.status);
  const formattedDate = followup.followupDate
    ? new Date(followup.followupDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No set date";

  const targetEntity = followup.personName || followup.organizationName || "";

  return (
    <div
      onClick={() => onEdit(followup)}
      className={`group relative flex flex-col justify-between rounded-xl border bg-card/70 p-4 shadow-sm transition-all hover:bg-accent/40 hover:shadow-md cursor-pointer ${
        overdue ? "border-rose-500/50 bg-rose-500/5 ring-1 ring-rose-500/20" : ""
      }`}
    >
      <div>
        {/* Header Badges & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${getPriorityBadgeColor(followup.priority)}`}>
              {followup.priority}
            </Badge>
            <Badge variant="outline" className={`text-[10px] capitalize font-medium ${getStatusBadgeColor(followup.status)}`}>
              {followup.status}
            </Badge>
            {overdue && (
              <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
                <AlertCircle className="size-3" />
                Overdue
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            {followup.status !== "completed" ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400"
                onClick={() => onComplete(followup.id)}
                title="Mark Completed"
              >
                <CheckCircle2 className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(followup.id)}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-2.5 text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {followup.title}
        </h3>

        {/* Target Person or Organization */}
        {(followup.personName || followup.organizationName) ? (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {followup.personName ? <User className="size-3.5 text-primary shrink-0" /> : <Building2 className="size-3.5 text-primary shrink-0" />}
              <span className="truncate max-w-[180px]">
                {followup.personName} {followup.organizationName ? `(${followup.organizationName})` : ""}
              </span>
            </div>

            {targetEntity && onViewTimeline ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewTimeline(targetEntity);
                }}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
              >
                Timeline <ArrowRight className="size-3" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Notes */}
        {followup.notes ? (
          <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {followup.notes}
          </p>
        ) : null}
      </div>

      {/* Footer Date & Category */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2.5">
        <span className="flex items-center gap-1 font-medium">
          <Calendar className="size-3 text-muted-foreground/70" />
          {formattedDate}
        </span>
        <span className="rounded bg-accent/40 px-2 py-0.5 font-medium">
          {followup.category}
        </span>
      </div>
    </div>
  );
}
