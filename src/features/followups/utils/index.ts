import type { FollowUpItem, FollowUpPriority, FollowUpStatus } from "../types";

export function isOverdue(followupDate?: string | null, status?: FollowUpStatus): boolean {
  if (!followupDate || status === "completed" || status === "cancelled") return false;
  const due = new Date(followupDate).getTime();
  const now = new Date().getTime();
  return due < now;
}

export function isDueToday(followupDate?: string | null): boolean {
  if (!followupDate) return false;
  const today = new Date().toISOString().split("T")[0] || "";
  return followupDate.startsWith(today);
}

export function getPriorityBadgeColor(priority: FollowUpPriority): string {
  switch (priority) {
    case "urgent":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    case "high":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "medium":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    case "low":
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

export function getStatusBadgeColor(status: FollowUpStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "snoozed":
      return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    case "cancelled":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    case "pending":
    default:
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  }
}

export function calculateRelationshipHealthScore(lastContactDate?: string | null, overdueCount = 0): number {
  if (!lastContactDate) return 40;
  const daysSinceContact = Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24));

  let score = 100;
  if (daysSinceContact > 30) score -= 40;
  else if (daysSinceContact > 14) score -= 20;
  else if (daysSinceContact > 7) score -= 10;

  score -= overdueCount * 15;
  return Math.max(0, Math.min(100, score));
}
