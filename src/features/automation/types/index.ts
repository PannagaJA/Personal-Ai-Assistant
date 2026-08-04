export type TriggerType =
  | "time"
  | "daily"
  | "weekly"
  | "monthly"
  | "event_start"
  | "event_end"
  | "task_due"
  | "task_completed"
  | "followup_due"
  | "email_received"
  | "manual"
  | "startup";

export type ConditionType =
  | "meeting_exists"
  | "free_time_available"
  | "unread_email_count"
  | "task_overdue"
  | "followup_overdue"
  | "specific_tag"
  | "time_of_day";

export type ActionType =
  | "generate_morning_brief"
  | "generate_evening_review"
  | "create_reminder"
  | "create_task"
  | "create_followup"
  | "create_note"
  | "notify_user"
  | "send_email_draft"
  | "run_planner"
  | "summarize_day";

export interface TriggerConfig {
  type: TriggerType;
  timeStr?: string; // e.g. "08:00"
  dayOfWeek?: number; // 0-6 (Sun-Sat)
  offsetMinutes?: number; // e.g. -30 for 30 mins before
  thresholdCount?: number;
}

export interface ConditionConfig {
  type: ConditionType;
  operator?: "gt" | "gte" | "lt" | "eq" | "contains";
  targetValue?: string | number;
}

export interface ActionConfig {
  type: ActionType;
  title?: string;
  payload?: Record<string, any>;
}

export interface AutomationItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  runCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  userId: string;
  status: "success" | "failed" | "skipped";
  outputSummary?: string;
  durationMs: number;
  createdAt: string;
}

export interface AutomationLog {
  id: string;
  runId?: string;
  automationId: string;
  userId: string;
  logLevel: "info" | "warn" | "error";
  message: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface ListAutomationsOptions {
  query?: string;
  isEnabled?: boolean;
  triggerType?: TriggerType;
}
