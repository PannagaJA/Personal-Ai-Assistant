import { useState } from "react";
import { Plus, CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";
import type { FollowUpItem, FollowUpStatus } from "../types";
import { FollowUpCard } from "./FollowUpCard";

interface KanbanBoardProps {
  followups: FollowUpItem[];
  onEdit: (item: FollowUpItem) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, newStatus: FollowUpStatus, title: string) => void;
  onViewTimeline?: (personOrOrg: string) => void;
}

const COLUMNS: Array<{ id: FollowUpStatus; title: string; color: string; icon: any }> = [
  { id: "pending", title: "Pending / Due", color: "text-amber-400 border-amber-500/30 bg-amber-500/5", icon: Clock },
  { id: "snoozed", title: "Snoozed / Waiting", color: "text-sky-400 border-sky-500/30 bg-sky-500/5", icon: PauseCircle },
  { id: "completed", title: "Completed", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5", icon: CheckCircle2 },
  { id: "cancelled", title: "Cancelled", color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5", icon: XCircle },
];

export function FollowUpKanbanBoard({
  followups,
  onEdit,
  onComplete,
  onDelete,
  onStatusChange,
  onViewTimeline,
}: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<FollowUpStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, colId: FollowUpStatus) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: FollowUpStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    if (!id) return;

    const item = followups.find((f) => f.id === id);
    if (item && item.status !== targetStatus) {
      onStatusChange(id, targetStatus, item.title);
    }
    setDraggedId(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const ColumnIcon = col.icon;
        const colItems = followups.filter((f) => f.status === col.id);
        const isTarget = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex flex-col rounded-xl border p-3 min-h-[500px] transition-all ${col.color} ${
              isTarget ? "ring-2 ring-primary/60 bg-accent/30 scale-[1.01]" : ""
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-border/30 pb-2 mb-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <ColumnIcon className="size-4" />
                <span>{col.title}</span>
              </div>
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground shadow-xs">
                {colItems.length}
              </span>
            </div>

            {/* Cards Column Body */}
            <div className="flex-1 space-y-3">
              {colItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 rounded-lg border border-dashed border-border/40 text-center text-xs text-muted-foreground/60">
                  Drop follow-up here
                </div>
              ) : (
                colItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    className="cursor-grab active:cursor-grabbing transition-transform active:scale-[0.98]"
                  >
                    {onViewTimeline ? (
                      <FollowUpCard
                        followup={item}
                        onEdit={onEdit}
                        onComplete={onComplete}
                        onDelete={onDelete}
                        onViewTimeline={onViewTimeline}
                      />
                    ) : (
                      <FollowUpCard
                        followup={item}
                        onEdit={onEdit}
                        onComplete={onComplete}
                        onDelete={onDelete}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
