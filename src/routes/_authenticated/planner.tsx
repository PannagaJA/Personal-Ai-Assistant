import { useState } from "react";
import {
  Sun,
  Moon,
  Sparkles,
  Calendar,
  Clock,
  Target,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useMorningBrief, useEveningReview, useDailyTimeline } from "@/features/planner/hooks/use-planner";
import { MorningBriefCard } from "@/features/planner/components/MorningBriefCard";
import { UnifiedDailyTimeline } from "@/features/planner/components/UnifiedDailyTimeline";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlannerPage() {
  const [activeTab, setActiveTab] = useState<"morning" | "evening" | "timeline">("morning");

  const { data: morningBrief, isLoading: isLoadingMorning } = useMorningBrief();
  const { data: eveningReview, isLoading: isLoadingEvening } = useEveningReview();
  const { data: dailyTimeline, isLoading: isLoadingTimeline } = useDailyTimeline();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Planning & Daily Intelligence</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Proactive AI chief of staff: Morning Briefing, Evening Review, Priority Engine, and Unified Timeline
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "morning" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("morning")}
              className="gap-1.5"
            >
              <Sun className="size-4 text-amber-400" />
              Morning Brief
            </Button>
            <Button
              variant={activeTab === "evening" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("evening")}
              className="gap-1.5"
            >
              <Moon className="size-4 text-indigo-400" />
              Evening Review
            </Button>
            <Button
              variant={activeTab === "timeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("timeline")}
              className="gap-1.5"
            >
              <Clock className="size-4 text-primary" />
              Unified Timeline
            </Button>
          </div>
        </div>

        {/* Content Views */}
        <div className="mt-6 space-y-6">
          {activeTab === "morning" ? (
            isLoadingMorning ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : morningBrief ? (
              <MorningBriefCard brief={morningBrief} />
            ) : (
              <p className="text-sm text-muted-foreground">Unable to generate morning brief.</p>
            )
          ) : activeTab === "evening" ? (
            isLoadingEvening ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : eveningReview ? (
              <div className="rounded-2xl border bg-card/60 p-6 shadow-md space-y-4">
                <div className="flex items-center gap-2">
                  <Moon className="size-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-foreground">Evening Review & Daily Reflection</h2>
                </div>

                <p className="text-sm text-foreground/90 bg-accent/30 p-3.5 rounded-xl border border-border/40">
                  {eveningReview.summary}
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border bg-accent/20 p-4 text-center">
                    <p className="text-2xl font-extrabold text-emerald-400">{eveningReview.completedTasksCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Tasks Completed</p>
                  </div>
                  <div className="rounded-xl border bg-accent/20 p-4 text-center">
                    <p className="text-2xl font-extrabold text-sky-400">{eveningReview.meetingsFinishedCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Meetings Attended</p>
                  </div>
                  <div className="rounded-xl border bg-accent/20 p-4 text-center">
                    <p className="text-2xl font-extrabold text-purple-400">{eveningReview.followupsCompletedCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Follow-ups Handled</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tomorrow Preview</h4>
                  <p className="text-xs text-muted-foreground bg-accent/20 p-3 rounded-lg">
                    {eveningReview.tomorrowPreview}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to generate evening review.</p>
            )
          ) : (
            isLoadingTimeline ? (
              <Skeleton className="h-64 rounded-2xl" />
            ) : (
              <UnifiedDailyTimeline items={dailyTimeline || []} />
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}
