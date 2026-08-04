import { Zap, Clock, Play, Trash2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import type { AutomationItem } from "../types";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AutomationCardProps {
  automation: AutomationItem;
  onToggle: (id: string, isEnabled: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AutomationCard({
  automation,
  onToggle,
  onRun,
  onDelete,
}: AutomationCardProps) {
  const triggerLabel =
    automation.triggerType === "daily"
      ? `Daily at ${automation.triggerConfig.timeStr || "08:00"}`
      : automation.triggerType === "weekly"
      ? "Weekly Schedule"
      : automation.triggerType === "event_start"
      ? "30m Before Meetings"
      : automation.triggerType === "task_due"
      ? "When Task is Due"
      : automation.triggerType;

  return (
    <div className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-xs transition hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">{automation.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{automation.description}</p>
            </div>
          </div>

          <Switch
            checked={automation.isEnabled}
            onCheckedChange={(checked) => onToggle(automation.id, checked)}
          />
        </div>

        {/* Trigger & Actions Tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1 bg-accent/30 font-semibold">
            <Clock className="size-3 text-primary" />
            {triggerLabel}
          </Badge>
          {automation.actions.map((act, i) => (
            <Badge key={i} variant="secondary" className="font-medium text-[11px]">
              Action: {act.title || act.type}
            </Badge>
          ))}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span>Runs: {automation.runCount}</span>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-primary hover:text-primary"
            onClick={() => onRun(automation.id)}
          >
            <Play className="size-3.5 fill-current" />
            Run Now
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-rose-400 hover:text-rose-500"
            onClick={() => onDelete(automation.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
