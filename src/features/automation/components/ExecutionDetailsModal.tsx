import { useState } from "react";
import { Eye, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { AutomationRun } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ExecutionDetailsModalProps {
  run: AutomationRun | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExecutionDetailsModal({
  run,
  isOpen,
  onClose,
}: ExecutionDetailsModalProps) {
  if (!run) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            {run.status === "success" ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <AlertCircle className="size-5 text-rose-400" />
            )}
            Automation Execution Output Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Metadata */}
          <div className="flex items-center justify-between rounded-lg border bg-accent/20 p-3">
            <div>
              <p className="text-muted-foreground font-medium">Executed At</p>
              <p className="font-semibold text-foreground mt-0.5">
                {new Date(run.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground font-medium">Duration</p>
              <p className="font-semibold text-foreground mt-0.5">{run.durationMs}ms</p>
            </div>
            <Badge variant={run.status === "success" ? "outline" : "destructive"}>
              {run.status}
            </Badge>
          </div>

          {/* Full Output Summary */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] text-muted-foreground">
              Output / Result Summary
            </h4>
            <div className="rounded-lg border bg-card p-3.5 leading-relaxed font-mono whitespace-pre-wrap text-foreground/90">
              {run.outputSummary || "No output details generated."}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
