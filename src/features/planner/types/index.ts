export type TimeBlockType = "deep_work" | "meeting" | "break" | "email" | "focus" | "learning";

export interface PriorityScore {
  itemId: string;
  itemType: "task" | "followup" | "event" | "email";
  title: string;
  score: number; // 0 to 100
  urgencyReason: string;
  dueDate?: string | null;
}

export interface RiskAlert {
  id: string;
  type: "conflict" | "deadline" | "overload" | "neglected_contact";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface TimeBlock {
  id: string;
  userId: string;
  title: string;
  blockType: TimeBlockType;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  createdAt?: string;
}

export interface DailyTimelineItem {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  type: "event" | "task" | "followup" | "block";
  subtitle?: string;
  isCompleted?: boolean;
}

export interface MorningBrief {
  id?: string;
  dateStr: string;
  summary: string;
  todaysFocus: string[];
  workloadScore: number; // 0 to 100
  topPriorities: PriorityScore[];
  riskAlerts: RiskAlert[];
  suggestedBlocks: TimeBlock[];
  estimatedWorkloadHours: number;
  productivityTip: string;
  createdAt?: string;
}

export interface EveningReview {
  id?: string;
  dateStr: string;
  summary: string;
  completedTasksCount: number;
  meetingsFinishedCount: number;
  followupsCompletedCount: number;
  unfinishedItems: PriorityScore[];
  rescheduleSuggestions: string[];
  tomorrowPreview: string;
  dailyReflection: string;
  createdAt?: string;
}

export interface PlannerOptions {
  dateStr?: string;
}
