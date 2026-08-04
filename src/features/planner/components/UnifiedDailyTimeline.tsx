import { Clock, Calendar, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";
import type { DailyTimelineItem } from "../types";
import { Badge } from "@/components/ui/badge";

interface UnifiedDailyTimelineProps {
  items: DailyTimelineItem[];
}

export function UnifiedDailyTimeline({ items }: UnifiedDailyTimelineProps) {
  return (
    <div className="rounded-2xl border bg-card/60 p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Unified 24-Hour Schedule Timeline</h3>
        </div>
        <span className="text-xs text-muted-foreground">{items.length} item(s) scheduled</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No calendar events or scheduled tasks on today's timeline.
        </p>
      ) : (
        <div className="relative pl-6 border-l-2 border-primary/20 space-y-4">
          {items.map((item) => {
            const timeFormatted = new Date(item.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={item.id} className="relative group">
                <div className="absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />

                <div className="flex items-start justify-between rounded-lg border bg-card p-3 shadow-xs transition hover:bg-accent/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{timeFormatted}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {item.type}
                      </Badge>
                    </div>
                    <h4 className="mt-1 font-semibold text-sm text-foreground">{item.title}</h4>
                    {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
