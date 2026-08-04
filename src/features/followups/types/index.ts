export type FollowUpPriority = "low" | "medium" | "high" | "urgent";
export type FollowUpStatus = "pending" | "completed" | "cancelled" | "snoozed";

export interface RelationshipLink {
  id?: string;
  followupId?: string;
  entityType: "contact" | "calendar" | "email" | "task" | "note" | "memory" | "company";
  entityId: string;
  entityTitle: string;
  createdAt?: string;
}

export interface FollowUpHistory {
  id: string;
  followupId: string;
  userId: string;
  eventType: "created" | "contacted" | "email_sent" | "status_changed" | "rescheduled" | "completed";
  description: string;
  createdAt: string;
}

export interface FollowUpItem {
  id: string;
  userId: string;
  title: string;
  personName?: string | null;
  organizationName?: string | null;
  category: string;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  followupDate?: string | null;
  reminderDate?: string | null;
  lastContactDate?: string | null;
  nextContactDate?: string | null;
  notes?: string | null;
  actionItems: string[];
  aiSummary?: string | null;
  tags: string[];
  links?: RelationshipLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ListFollowUpsOptions {
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  personName?: string;
  organizationName?: string;
  category?: string;
  isOverdue?: boolean;
  isToday?: boolean;
  query?: string;
  limit?: number;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  type: "meeting" | "email" | "task" | "note" | "followup" | "memory";
  description?: string;
  url?: string;
}

export interface RelationshipTimeline {
  personOrOrg: string;
  healthScore: number; // 0 to 100
  lastContacted?: string;
  statusSummary: string;
  events: TimelineEvent[];
}
