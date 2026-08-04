import { useState } from "react";
import {
  Calendar,
  Plus,
  Search as SearchIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building2,
  User,
  HeartPulse,
  LayoutGrid,
  List as ListIcon,
  Kanban,
  Sparkles,
} from "lucide-react";
import { useFollowUps, useRelationshipTimeline } from "@/features/followups/hooks/use-followups";
import { FollowUpCard } from "@/features/followups/components/FollowUpCard";
import { FollowUpModal } from "@/features/followups/components/FollowUpModal";
import { RelationshipTimelineModal } from "@/features/followups/components/RelationshipTimelineModal";
import { FollowUpKanbanBoard } from "@/features/followups/components/FollowUpKanbanBoard";
import type { FollowUpItem, FollowUpPriority, FollowUpStatus } from "@/features/followups/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "kanban" | "grid" | "list";
type FilterTab = "all" | "today" | "overdue" | "pending" | "completed";

export default function FollowUpsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const queryOpts: any = {
    query: searchQuery,
  };
  if (activeTab === "today") queryOpts.isToday = true;
  if (activeTab === "overdue") queryOpts.isOverdue = true;
  if (activeTab === "pending" || activeTab === "completed") queryOpts.status = activeTab;

  const { followups: fetchedFollowUps, isLoading, saveFollowUp, completeFollowUp, deleteFollowUp } = useFollowUps(queryOpts);
  const [localFollowUps, setLocalFollowUps] = useState<FollowUpItem[]>([]);
  const { data: timelineData } = useRelationshipTimeline(selectedEntity);

  const displayFollowUps = localFollowUps.length > 0 || fetchedFollowUps.length > 0 ? (localFollowUps.length === fetchedFollowUps.length ? localFollowUps : fetchedFollowUps) : [];

  const handleOpenTimeline = (personOrOrg: string) => {
    setSelectedEntity(personOrOrg);
    setIsTimelineOpen(true);
  };

  const handleStatusChange = (id: string, newStatus: FollowUpStatus, title: string) => {
    // Instant optimistic UI update
    const updated = (localFollowUps.length > 0 ? localFollowUps : fetchedFollowUps).map((f) =>
      f.id === id ? { ...f, status: newStatus } : f
    );
    setLocalFollowUps(updated);

    saveFollowUp.mutate({
      id,
      title,
      status: newStatus,
    });
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HeartPulse className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Follow-Up & Relationship Manager</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Assistant relationship memory: track meetings, promises, emails, next actions, and relationship health
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setEditingFollowUp(null);
                setIsModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              New Follow-Up
            </Button>
          </div>
        </div>

        {/* Search and Navigation Bar */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search follow-ups by title, person, company, notes..."
              className="pl-9 bg-accent/30"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              onClick={() => setViewMode("kanban")}
              title="Kanban Board View"
            >
              <Kanban className="size-4 text-primary" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <ListIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-2">
          {(["all", "today", "overdue", "pending", "completed"] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="capitalize text-xs gap-1.5"
            >
              {tab === "overdue" && <AlertCircle className="size-3.5 text-rose-400" />}
              {tab === "today" && <Clock className="size-3.5 text-sky-400" />}
              {tab === "completed" && <CheckCircle2 className="size-3.5 text-emerald-400" />}
              {tab}
            </Button>
          ))}
        </div>

        {/* Follow-Ups Board / Grid / List */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[400px] rounded-xl" />
              ))}
            </div>
          ) : displayFollowUps.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <Calendar className="size-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No follow-ups found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery
                  ? `No follow-ups match "${searchQuery}".`
                  : "Create a follow-up or ask Jarvis in chat e.g. 'Remind me to follow up with Smart Path on Friday'."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingFollowUp(null);
                  setIsModalOpen(true);
                }}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-4" />
                Create Follow-Up
              </Button>
            </div>
          ) : viewMode === "kanban" ? (
            <FollowUpKanbanBoard
              followups={displayFollowUps}
              onEdit={(f) => {
                setEditingFollowUp(f);
                setIsModalOpen(true);
              }}
              onComplete={(id) => completeFollowUp.mutate(id)}
              onDelete={(id) => deleteFollowUp.mutate(id)}
              onStatusChange={handleStatusChange}
              onViewTimeline={handleOpenTimeline}
            />
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-3"
              }
            >
              {displayFollowUps.map((item) => (
                <FollowUpCard
                  key={item.id}
                  followup={item}
                  onEdit={(f) => {
                    setEditingFollowUp(f);
                    setIsModalOpen(true);
                  }}
                  onComplete={(id) => completeFollowUp.mutate(id)}
                  onDelete={(id) => deleteFollowUp.mutate(id)}
                  onViewTimeline={handleOpenTimeline}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-Up Edit / Create Modal */}
      <FollowUpModal
        followup={editingFollowUp}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={(payload) => saveFollowUp.mutate(payload)}
      />

      {/* Relationship Timeline Visualizer Modal */}
      <RelationshipTimelineModal
        timeline={timelineData || null}
        open={isTimelineOpen}
        onOpenChange={setIsTimelineOpen}
      />
    </AppShell>
  );
}
