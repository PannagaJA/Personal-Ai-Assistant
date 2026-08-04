import { Sun, Sparkles, AlertCircle, Target, Clock, ShieldAlert } from "lucide-react";
import type { MorningBrief } from "../types";
import { Badge } from "@/components/ui/badge";

interface MorningBriefCardProps {
  brief: MorningBrief;
}

export function MorningBriefCard({ brief }: MorningBriefCardProps) {
  const workloadColor =
    brief.workloadScore >= 75
      ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
      : brief.workloadScore >= 40
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card/90 via-card/60 to-primary/5 p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sun className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Morning Intelligence Briefing
              <Sparkles className="size-4 text-primary animate-pulse" />
            </h2>
            <p className="text-xs text-muted-foreground">{brief.dateStr}</p>
          </div>
        </div>

        <Badge variant="outline" className={`gap-1.5 px-3 py-1 font-bold text-xs ${workloadColor}`}>
          Workload Score: {brief.workloadScore}/100 (~{brief.estimatedWorkloadHours} hrs)
        </Badge>
      </div>

      {/* Summary */}
      <p className="mt-4 text-sm leading-relaxed text-foreground/90 bg-accent/30 p-3.5 rounded-xl border border-border/40">
        {brief.summary}
      </p>

      {/* Today's Focus & Top Priorities */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Today's Focus */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="size-3.5 text-primary" />
            Today's Core Focus Areas
          </h4>
          <ul className="space-y-1.5 text-xs text-foreground/90 font-medium">
            {brief.todaysFocus.map((focus, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-accent/20 px-3 py-1.5">
                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                <span>{focus}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risk Alerts */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-rose-400" />
            Schedule & Deadline Risk Alerts
          </h4>
          {brief.riskAlerts.length === 0 ? (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 font-medium">
              No schedule conflicts or overdue risks detected for today!
            </p>
          ) : (
            <div className="space-y-1.5">
              {brief.riskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300"
                >
                  <p className="font-bold">{alert.title}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{alert.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Productivity Tip */}
      <div className="mt-4 flex items-center gap-2 text-xs text-primary/90 font-medium bg-primary/10 px-3.5 py-2 rounded-lg border border-primary/20">
        <Sparkles className="size-3.5 shrink-0" />
        <span>Productivity Insight: {brief.productivityTip}</span>
      </div>
    </div>
  );
}
