import type { PriorityScore, RiskAlert } from "../types";

export function calculateTaskPriorityScore(task: {
  id: string;
  title: string;
  priority: string;
  due_at: string | null;
}): PriorityScore {
  let score = 50;
  let reason = "Standard pending task";

  if (task.priority === "urgent" || task.priority === "high") {
    score += 25;
    reason = "High priority flag";
  }

  if (task.due_at) {
    const dueTime = new Date(task.due_at).getTime();
    const diffHours = (dueTime - Date.now()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      score += 35;
      reason = "Overdue deadline!";
    } else if (diffHours < 12) {
      score += 30;
      reason = "Due within 12 hours";
    } else if (diffHours < 24) {
      score += 20;
      reason = "Due today";
    }
  }

  return {
    itemId: task.id,
    itemType: "task",
    title: task.title,
    score: Math.min(100, Math.max(0, score)),
    urgencyReason: reason,
    dueDate: task.due_at,
  };
}

export function calculateFollowUpPriorityScore(followup: {
  id: string;
  title: string;
  priority: string;
  personName?: string | null;
  organizationName?: string | null;
  followupDate?: string | null;
}): PriorityScore {
  let score = 45;
  let reason = "Pending follow-up";

  if (followup.priority === "urgent" || followup.priority === "high") {
    score += 20;
  }

  if (followup.followupDate) {
    const dueTime = new Date(followup.followupDate).getTime();
    const diffHours = (dueTime - Date.now()) / (1000 * 60 * 60);

    if (diffHours < 0) {
      score += 35;
      reason = "Overdue relationship follow-up!";
    } else if (diffHours < 24) {
      score += 25;
      reason = "Scheduled for today";
    }
  }

  const target = followup.personName || followup.organizationName || "";

  return {
    itemId: followup.id,
    itemType: "followup",
    title: `${followup.title}${target ? ` (${target})` : ""}`,
    score: Math.min(100, Math.max(0, score)),
    urgencyReason: reason,
    dueDate: followup.followupDate || null,
  };
}

export function detectRiskAlerts(input: {
  meetingsCount: number;
  overdueTasksCount: number;
  overdueFollowUpsCount: number;
  freeHoursToday: number;
}): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (input.meetingsCount >= 5) {
    alerts.push({
      id: "meeting_overload",
      type: "overload",
      title: "Meeting Heavy Day",
      description: `You have ${input.meetingsCount} meetings today. Deep work time is constrained.`,
      severity: "high",
    });
  }

  if (input.overdueTasksCount > 0) {
    alerts.push({
      id: "overdue_tasks",
      type: "deadline",
      title: "Overdue Tasks Pending",
      description: `${input.overdueTasksCount} overdue task(s) require immediate completion.`,
      severity: "critical",
    });
  }

  if (input.overdueFollowUpsCount > 0) {
    alerts.push({
      id: "overdue_followups",
      type: "neglected_contact",
      title: "Follow-Ups Neglected",
      description: `${input.overdueFollowUpsCount} relationship follow-up(s) are overdue.`,
      severity: "medium",
    });
  }

  if (input.freeHoursToday < 2 && input.meetingsCount > 0) {
    alerts.push({
      id: "schedule_conflict",
      type: "conflict",
      title: "Tight Schedule",
      description: "Less than 2 hours of buffer/free time available today.",
      severity: "medium",
    });
  }

  return alerts;
}
