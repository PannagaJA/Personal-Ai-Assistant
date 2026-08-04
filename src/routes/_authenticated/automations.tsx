import { useState } from "react";
import { toast } from "sonner";
import { Zap, Plus, Search, Play, CheckCircle2, AlertCircle, RefreshCw, Eye } from "lucide-react";
import { useAutomations, useAutomationHistory } from "@/features/automation/hooks/use-automations";
import { AutomationCard } from "@/features/automation/components/AutomationCard";
import { ExecutionDetailsModal } from "@/features/automation/components/ExecutionDetailsModal";
import type { AutomationRun } from "@/features/automation/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function AutomationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "history">("all");
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const queryOpts: any = { query: searchQuery };
  if (activeTab === "active") queryOpts.isEnabled = true;

  const { automations, isLoading, toggleAutomation, runAutomation, deleteAutomation } = useAutomations(queryOpts);
  const { data: history } = useAutomationHistory();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Automation Engine</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Proactive automation brain: scheduled briefings, pre-meeting prep, overdue alerts, and weekly reviews
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("all")}
            >
              All ({automations.length})
            </Button>
            <Button
              variant={activeTab === "active" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("active")}
            >
              Active
            </Button>
            <Button
              variant={activeTab === "history" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("history")}
            >
              History ({history?.length ?? 0})
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automations by name or description..."
            className="pl-9 bg-accent/30"
          />
        </div>

        {/* Automations Grid or Execution History */}
        <div className="mt-6">
          {activeTab === "history" ? (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-4">
                <RefreshCw className="size-4 text-primary" />
                Recent Automation Execution History
              </h3>
              {!history || history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No recent executions recorded.</p>
              ) : (
                history.map((run) => (
                  <div
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 bg-accent/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {run.status === "success" ? (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-foreground">{run.outputSummary || "Executed automation"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Duration: {run.durationMs}ms · {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => setSelectedRun(run)}
                      >
                        <Eye className="size-3" />
                        View Output
                      </Button>
                      <Badge variant={run.status === "success" ? "outline" : "destructive"}>
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <Zap className="size-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No automations found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask Jarvis in chat e.g. "Create an automation for morning brief every day at 8 AM".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {automations.map((item) => (
                <AutomationCard
                  key={item.id}
                  automation={item}
                  onToggle={(id, isEnabled) =>
                    toggleAutomation.mutate(
                      { id, isEnabled },
                      {
                        onSuccess: () =>
                          toast.success(`Automation ${isEnabled ? "enabled" : "disabled"}`),
                      }
                    )
                  }
                  onRun={(id) =>
                    runAutomation.mutate(id, {
                      onSuccess: (res: any) =>
                        toast.success(res?.outputSummary || "Automation executed successfully!"),
                      onError: (err: any) => toast.error(`Execution failed: ${err.message}`),
                    })
                  }
                  onDelete={(id) =>
                    deleteAutomation.mutate(id, {
                      onSuccess: () => toast.success("Automation deleted"),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ExecutionDetailsModal
        run={selectedRun}
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
      />
    </AppShell>
  );
}
