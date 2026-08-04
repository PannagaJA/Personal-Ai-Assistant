import { z } from "zod";
import type { AITool } from "../../ai/tools/registry.js";
import { FollowUpsService } from "../services.server.js";

export const followupsCreateTool: AITool = {
  id: "followups_create",
  name: "create_followup",
  description: "Create a new follow-up reminder for a person, company, meeting, or promise.",
  parameters: z.object({
    title: z.string().describe("Title of the follow-up (e.g. Follow up on ERP Quotation, Send pricing proposal)"),
    personName: z.string().optional().describe("Name of the person (e.g. Ritesh, Principal)"),
    organizationName: z.string().optional().describe("Company or Organization name (e.g. Smart Path, AMC)"),
    category: z.string().optional().default("General").describe("Category (e.g. Email, Call, Proposal, Meeting)"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium").describe("Priority level"),
    followupDate: z.string().optional().describe("ISO timestamp or date string for the follow-up (e.g. 2026-08-05)"),
    notes: z.string().optional().describe("Context notes or promises made"),
    tags: z.array(z.string()).optional().default([]).describe("Tags"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const followup = await FollowUpsService.upsertFollowUp(supabase, userId, params);
      return {
        success: true,
        data: followup,
        message: `Created follow-up "${followup.title}" for ${followup.personName || followup.organizationName || "general"}.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsUpdateTool: AITool = {
  id: "followups_update",
  name: "update_followup",
  description: "Update an existing follow-up details by ID or title match.",
  parameters: z.object({
    followupId: z.string().optional().describe("UUID of the follow-up"),
    title: z.string().describe("Title of the follow-up"),
    status: z.enum(["pending", "completed", "cancelled", "snoozed"]).optional().describe("New status"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
    followupDate: z.string().optional().describe("Updated follow-up date"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      let targetId = params.followupId;
      if (!targetId) {
        const matches = await FollowUpsService.listFollowUps(supabase, userId, { query: params.title, limit: 1 });
        if (matches.length === 0 || !matches[0]) {
          return { success: false, message: `No follow-up found matching title "${params.title}".` };
        }
        targetId = matches[0].id;
      }

      const updated = await FollowUpsService.upsertFollowUp(supabase, userId, {
        id: targetId,
        title: params.title,
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.priority !== undefined ? { priority: params.priority } : {}),
        ...(params.followupDate !== undefined ? { followupDate: params.followupDate } : {}),
        ...(params.notes !== undefined ? { notes: params.notes } : {}),
      });

      return {
        success: true,
        data: updated,
        message: `Updated follow-up "${updated.title}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsDeleteTool: AITool = {
  id: "followups_delete",
  name: "delete_followup",
  description: "Delete a follow-up reminder.",
  parameters: z.object({
    followupId: z.string().describe("UUID of the follow-up to delete"),
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      await FollowUpsService.deleteFollowUp(supabase, userId, followupId);
      return {
        success: true,
        message: `Deleted follow-up successfully.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsSearchTool: AITool = {
  id: "followups_search",
  name: "search_followups",
  description: "Search follow-ups by company, person, notes, priority, or status.",
  parameters: z.object({
    query: z.string().describe("Search query (e.g. Smart Path, AMC, quotation, Ritesh)"),
    status: z.enum(["pending", "completed", "cancelled", "snoozed"]).optional().describe("Filter by status"),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Filter by priority"),
  }),
  execute: async ({ query, status, priority }, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { query, status, priority, limit: 10 });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) matching "${query}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsTodayTool: AITool = {
  id: "followups_today",
  name: "get_today_followups",
  description: "Retrieve all follow-ups scheduled for today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { isToday: true });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) due today.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsOverdueTool: AITool = {
  id: "followups_overdue",
  name: "get_overdue_followups",
  description: "Retrieve all overdue follow-ups that require immediate attention.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { isOverdue: true });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} overdue follow-up(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsNextTool: AITool = {
  id: "followups_next",
  name: "get_next_followup",
  description: "Retrieve the single highest priority or upcoming follow-up.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { status: "pending", limit: 1 });
      if (items.length === 0 || !items[0]) {
        return { success: true, message: "No pending follow-ups scheduled." };
      }
      return {
        success: true,
        data: items[0],
        message: `Next follow-up: "${items[0].title}" due ${items[0].followupDate || "soon"}.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsCompleteTool: AITool = {
  id: "followups_complete",
  name: "complete_followup",
  description: "Mark a follow-up as completed.",
  parameters: z.object({
    followupId: z.string().describe("UUID of the follow-up to mark completed"),
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      const item = await FollowUpsService.completeFollowUp(supabase, userId, followupId);
      return {
        success: true,
        data: item,
        message: `Marked follow-up "${item.title}" as completed.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsTimelineTool: AITool = {
  id: "followups_timeline",
  name: "get_relationship_timeline",
  description: "Get the full chronological relationship timeline and health score for a person or organization.",
  parameters: z.object({
    personOrOrg: z.string().describe("Person or Company name (e.g. Smart Path, AMC, Ritesh)"),
  }),
  execute: async ({ personOrOrg }, { supabase, userId }) => {
    try {
      const timeline = await FollowUpsService.getRelationshipTimeline(supabase, userId, personOrOrg);
      return {
        success: true,
        data: timeline,
        message: `Generated relationship timeline for "${personOrOrg}" (Health Score: ${timeline.healthScore}/100).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsHistoryTool: AITool = {
  id: "followups_history",
  name: "get_followup_history",
  description: "Get historical logs for a specific follow-up.",
  parameters: z.object({
    followupId: z.string().describe("UUID of the follow-up"),
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      const { data } = await (supabase.from as any)("followup_history")
        .select("*")
        .eq("followup_id", followupId)
        .order("created_at", { ascending: false });
      return {
        success: true,
        data: data || [],
        message: `Retrieved ${data?.length || 0} history entry(ies).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const followupsRelatedTool: AITool = {
  id: "followups_related",
  name: "get_related_followups",
  description: "Find follow-ups connected to an organization or contact.",
  parameters: z.object({
    entityName: z.string().describe("Organization or contact name"),
  }),
  execute: async ({ entityName }, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { query: entityName, limit: 5 });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) related to "${entityName}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
