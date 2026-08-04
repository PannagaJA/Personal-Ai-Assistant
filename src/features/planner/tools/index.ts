import { z } from "zod";
import type { AITool } from "../../ai/tools/registry.js";
import { PlannerService } from "../services.server.js";

export const plannerDailyTool: AITool = {
  id: "planner_daily",
  name: "get_daily_plan",
  description: "Get the complete AI daily plan, morning brief, top priorities, and suggested schedule.",
  parameters: z.object({
    dateStr: z.string().optional().describe("ISO date string (YYYY-MM-DD)"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId, params);
      return {
        success: true,
        data: brief,
        message: brief.summary,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerWeeklyTool: AITool = {
  id: "planner_weekly",
  name: "get_weekly_plan",
  description: "Get weekly planning priorities, meeting load, and risk analysis.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: {
          weeklySummary: "Weekly plan active: balance meeting load with deep work execution.",
          brief,
        },
        message: "Generated weekly overview.",
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerTodayTool: AITool = {
  id: "planner_today",
  name: "get_today_plan",
  description: "Get today's morning brief and focus areas.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief,
        message: `Today's Brief: ${brief.summary}`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerTomorrowTool: AITool = {
  id: "planner_tomorrow",
  name: "get_tomorrow_preview",
  description: "Preview tomorrow's scheduled meetings, tasks, and follow-ups.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const review = await PlannerService.generateEveningReview(supabase, userId);
      return {
        success: true,
        data: { preview: review.tomorrowPreview },
        message: review.tomorrowPreview,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerPrioritiesTool: AITool = {
  id: "planner_priorities",
  name: "get_top_priorities",
  description: "Get the AI priority-ranked list of top tasks, follow-ups, and commitments for today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.topPriorities,
        message: `Found ${brief.topPriorities.length} top priority item(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerScheduleTool: AITool = {
  id: "planner_schedule",
  name: "get_daily_schedule",
  description: "Get the unified 24-hour timeline schedule combining calendar events, tasks, and time blocks.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const timeline = await PlannerService.getDailyTimeline(supabase, userId);
      return {
        success: true,
        data: timeline,
        message: `Retrieved ${timeline.length} schedule item(s) on today's timeline.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerRisksTool: AITool = {
  id: "planner_risks",
  name: "get_risk_alerts",
  description: "Identify schedule conflicts, meeting overloads, and overdue deadline risk alerts.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.riskAlerts,
        message: `Detected ${brief.riskAlerts.length} risk alert(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerWorkloadTool: AITool = {
  id: "planner_workload",
  name: "get_workload_estimate",
  description: "Estimate total work hours and workload intensity score for today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: {
          workloadScore: brief.workloadScore,
          estimatedHours: brief.estimatedWorkloadHours,
        },
        message: `Workload Score: ${brief.workloadScore}/100 (~${brief.estimatedWorkloadHours} hours of work).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerSummaryTool: AITool = {
  id: "planner_summary",
  name: "get_planner_summary",
  description: "Get an executive summary of today's workload and schedule.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief,
        message: brief.summary,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerReviewTool: AITool = {
  id: "planner_review",
  name: "generate_evening_review",
  description: "Generate end-of-day evening review summarizing completed work, unfinished items, and tomorrow preview.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const review = await PlannerService.generateEveningReview(supabase, userId);
      return {
        success: true,
        data: review,
        message: review.summary,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerNextTaskTool: AITool = {
  id: "planner_next_task",
  name: "get_recommended_next_task",
  description: "Get the single highest priority recommended next task or action to work on right now.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      const nextItem = brief.topPriorities[0];
      if (!nextItem) {
        return { success: true, message: "All high priority items are completed!" };
      }
      return {
        success: true,
        data: nextItem,
        message: `Recommended Next Action: "${nextItem.title}" (${nextItem.urgencyReason}, Priority Score: ${nextItem.score}/100).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerTimeblockTool: AITool = {
  id: "planner_timeblock",
  name: "get_time_blocks",
  description: "Get AI suggested focus & deep work time blocks for today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.suggestedBlocks,
        message: `Generated ${brief.suggestedBlocks.length} time block suggestion(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const plannerSuggestTool: AITool = {
  id: "planner_suggest",
  name: "get_planner_suggestions",
  description: "Get AI productivity suggestions, break reminders, and energy-aware recommendations.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: { tip: brief.productivityTip, focus: brief.todaysFocus },
        message: brief.productivityTip,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
