import { Clock, Calendar, Mail, FileText, CheckCircle2, HeartPulse, Building2, User } from "lucide-react";
import type { RelationshipTimeline } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface RelationshipTimelineModalProps {
  timeline: RelationshipTimeline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelationshipTimelineModal({ timeline, open, onOpenChange }: RelationshipTimelineModalProps) {
  if (!timeline) return null;

  const healthColor =
    timeline.healthScore >= 80
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : timeline.healthScore >= 50
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-rose-400 bg-rose-500/10 border-rose-500/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 sm:max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-card">
          <div className="flex items-center gap-2.5">
            <Building2 className="size-5 text-primary" />
            <div>
              <DialogTitle className="text-lg font-bold">
                Relationship Timeline: {timeline.personOrOrg}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{timeline.statusSummary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`gap-1.5 px-3 py-1 font-bold text-xs ${healthColor}`}>
              <HeartPulse className="size-3.5" />
              Health Score: {timeline.healthScore}/100
            </Badge>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {timeline.events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No historical interactions recorded yet.
            </p>
          ) : (
            <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
              {timeline.events.map((evt) => {
                const formattedDate = new Date(evt.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={evt.id} className="relative group">
                    {/* Dot */}
                    <div className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />

                    <div className="rounded-lg border bg-card/60 p-4 shadow-sm transition hover:bg-accent/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                          {evt.type}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
                      </div>

                      <h4 className="mt-1 font-semibold text-sm text-foreground">{evt.title}</h4>
                      {evt.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
