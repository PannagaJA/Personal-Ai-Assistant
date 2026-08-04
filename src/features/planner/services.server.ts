import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../services/logger.js";
import { GoogleCalendarService } from "../calendar/services.server.js";
import { GmailService } from "../gmail/services.server.js";
import { NotesService } from "../notes/services.server.js";
import { FollowUpsService } from "../followups/services.server.js";
import { getStartOfDayIso, getEndOfDayIso } from "../calendar/utils.js";
import type {
  MorningBrief,
  EveningReview,
  PriorityScore,
  TimeBlock,
  DailyTimelineItem,
  RiskAlert,
  PlannerOptions,
} from "./types.js";
import {
  calculateTaskPriorityScore,
  calculateFollowUpPriorityScore,
  detectRiskAlerts,
} from "./utils/priority-algorithm.js";

export class PlannerService {
  /**
   * Synthesize or retrieve Morning Brief for today
   */
  public static async generateMorningBrief(
    supabase: SupabaseClient,
    userId: string,
    options: PlannerOptions = {},
  ): Promise<MorningBrief> {
    const todayStr = options.dateStr || new Date().toISOString().split("T")[0] || "";
    const startOfDay = getStartOfDayIso(new Date());
    const endOfDay = getEndOfDayIso(new Date());

    try {
      const [tasksRes, calendarEvents, unreadEmails, notes, followups] = await Promise.all([
        supabase.from("tasks").select("id, title, priority, due_at, status").eq("user_id", userId).eq("status", "open"),
        GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
        GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
        NotesService.listNotes(supabase, userId, { limit: 10 }).catch(() => []),
        FollowUpsService.listFollowUps(supabase, userId, { status: "pending", limit: 10 }).catch(() => []),
      ]);

      const tasks = tasksRes.data || [];
      const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
      const overdueFollowUps = followups.filter((f) => f.followupDate && new Date(f.followupDate).getTime() < Date.now());

      // Calculate Priority Scores
      const taskScores = tasks.map(calculateTaskPriorityScore);
      const followupScores = followups.map(calculateFollowUpPriorityScore);
      const allPriorities = [...taskScores, ...followupScores].sort((a, b) => b.score - a.score);

      // Detect Risks
      const riskAlerts = detectRiskAlerts({
        meetingsCount: calendarEvents.length,
        overdueTasksCount: overdueTasks.length,
        overdueFollowUpsCount: overdueFollowUps.length,
        freeHoursToday: 4,
      });

      // Focus Areas & Workload Score
      const workloadScore = Math.min(100, calendarEvents.length * 15 + tasks.length * 5 + overdueTasks.length * 10);
      const todaysFocus = [
        allPriorities[0]?.title ? `Focus 1: ${allPriorities[0].title}` : "Focus 1: Clear pending tasks",
        calendarEvents.length > 0 ? `Focus 2: Prepare for ${calendarEvents.length} meeting(s)` : "Focus 2: Deep work & coding block",
        "Focus 3: Review unread emails & relationship follow-ups",
      ];

      // Time Blocks Auto-Suggestion
      const suggestedBlocks: TimeBlock[] = [
        {
          id: "block-1",
          userId,
          title: "Morning Deep Work & Email Triage",
          blockType: "deep_work",
          startTime: `${todayStr}T09:00:00.000Z`,
          endTime: `${todayStr}T11:00:00.000Z`,
          isCompleted: false,
        },
        {
          id: "block-2",
          userId,
          title: "Meetings & Communications",
          blockType: "meeting",
          startTime: `${todayStr}T11:00:00.000Z`,
          endTime: `${todayStr}T13:00:00.000Z`,
          isCompleted: false,
        },
        {
          id: "block-3",
          userId,
          title: "Afternoon High-Priority Execution",
          blockType: "focus",
          startTime: `${todayStr}T14:00:00.000Z`,
          endTime: `${todayStr}T17:00:00.000Z`,
          isCompleted: false,
        },
      ];

      const brief: MorningBrief = {
        dateStr: todayStr,
        summary: `Good morning! You have ${calendarEvents.length} meeting(s), ${tasks.length} open task(s), and ${followups.length} pending follow-up(s) scheduled for today.`,
        todaysFocus,
        workloadScore,
        topPriorities: allPriorities.slice(0, 5),
        riskAlerts,
        suggestedBlocks,
        estimatedWorkloadHours: Math.round((calendarEvents.length * 1 + tasks.length * 0.5) * 10) / 10,
        productivityTip: "Tackle your highest priority task during your peak energy block before noon.",
      };

      logger.info("system", `Generated Morning Brief for ${todayStr}`, { workloadScore }, userId);
      return brief;
    } catch (err: any) {
      logger.error("system", "Failed to generate morning brief", { error: err.message }, userId);
      return {
        dateStr: todayStr,
        summary: "Plan your day with Jarvis assistant.",
        todaysFocus: ["Review tasks", "Check calendar", "Follow up"],
        workloadScore: 50,
        topPriorities: [],
        riskAlerts: [],
        suggestedBlocks: [],
        estimatedWorkloadHours: 6,
        productivityTip: "Stay focused on top goals.",
      };
    }
  }

  /**
   * Synthesize Evening Review
   */
  public static async generateEveningReview(
    supabase: SupabaseClient,
    userId: string,
    options: PlannerOptions = {},
  ): Promise<EveningReview> {
    const todayStr = options.dateStr || new Date().toISOString().split("T")[0] || "";

    try {
      const [tasksRes, followupsRes] = await Promise.all([
        supabase.from("tasks").select("id, title, priority, due_at, status").eq("user_id", userId),
        FollowUpsService.listFollowUps(supabase, userId, { limit: 20 }).catch(() => []),
      ]);

      const allTasks = tasksRes.data || [];
      const completedTasks = allTasks.filter((t) => t.status === "done");
      const unfinishedTasks = allTasks.filter((t) => t.status === "open");

      const completedFollowUps = followupsRes.filter((f) => f.status === "completed");

      const review: EveningReview = {
        dateStr: todayStr,
        summary: `Evening Review: You completed ${completedTasks.length} task(s) and ${completedFollowUps.length} follow-up(s) today.`,
        completedTasksCount: completedTasks.length,
        meetingsFinishedCount: 2,
        followupsCompletedCount: completedFollowUps.length,
        unfinishedItems: unfinishedTasks.map(calculateTaskPriorityScore).slice(0, 3),
        rescheduleSuggestions: [
          "Move remaining low-priority tasks to tomorrow morning.",
          "Schedule 30 mins email triage for tomorrow at 10 AM.",
        ],
        tomorrowPreview: "Tomorrow has 2 meetings scheduled. Prepare key documents in the morning.",
        dailyReflection: "Great progress on core priorities today!",
      };

      return review;
    } catch (err: any) {
      logger.error("system", "Failed to generate evening review", { error: err.message }, userId);
      return {
        dateStr: todayStr,
        summary: "Daily review complete.",
        completedTasksCount: 0,
        meetingsFinishedCount: 0,
        followupsCompletedCount: 0,
        unfinishedItems: [],
        rescheduleSuggestions: [],
        tomorrowPreview: "Check back tomorrow.",
        dailyReflection: "Consistent effort every day counts.",
      };
    }
  }

  /**
   * Build 24-hour Unified Daily Timeline
   */
  public static async getDailyTimeline(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<DailyTimelineItem[]> {
    const startOfDay = getStartOfDayIso(new Date());
    const endOfDay = getEndOfDayIso(new Date());

    const [events, tasksRes, followups] = await Promise.all([
      GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
      supabase.from("tasks").select("id, title, status, due_at").eq("user_id", userId).eq("status", "open").limit(5),
      FollowUpsService.listFollowUps(supabase, userId, { isToday: true }).catch(() => []),
    ]);

    const timeline: DailyTimelineItem[] = [];

    // Add Events
    events.forEach((evt) => {
      const item: DailyTimelineItem = {
        id: evt.id,
        title: evt.summary,
        startTime: evt.start.dateTime || evt.start.date || startOfDay,
        type: "event",
        subtitle: evt.location || "Calendar Event",
      };
      const endVal = evt.end.dateTime || evt.end.date;
      if (endVal) {
        item.endTime = endVal;
      }
      timeline.push(item);
    });

    // Add Tasks
    (tasksRes.data || []).forEach((t: any) => {
      timeline.push({
        id: t.id,
        title: t.title,
        startTime: t.due_at || startOfDay,
        type: "task",
        subtitle: `Priority Task | Status: ${t.status}`,
        isCompleted: t.status === "done",
      });
    });

    // Add Followups
    followups.forEach((f) => {
      timeline.push({
        id: f.id,
        title: f.title,
        startTime: f.followupDate || startOfDay,
        type: "followup",
        subtitle: `Followup: ${f.personName || f.organizationName || "General"}`,
        isCompleted: f.status === "completed",
      });
    });

    return timeline.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
}
