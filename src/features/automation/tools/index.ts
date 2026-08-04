import { z } from "zod";
import type { AITool } from "../../ai/tools/registry.js";
import { AutomationService } from "../services.server.js";

export const automationCreateTool: AITool = {
  id: "automation_create",
  name: "create_automation",
  description: "Create a proactive AI automation with triggers, conditions, and actions.",
  parameters: z.object({
    name: z.string().describe("Title of the automation"),
    description: z.string().optional().describe("Description of what the automation does"),
    triggerType: z.string().describe("Trigger type e.g. 'daily', 'weekly', 'event_start', 'task_due'"),
    timeStr: z.string().optional().describe("Time of day e.g. '08:00'"),
    dayOfWeek: z.number().optional().describe("Day of week 0-6"),
    actionType: z.string().describe("Action type e.g. 'generate_morning_brief', 'notify_user'"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.upsertAutomation(supabase, userId, {
        name: params.name,
        description: params.description,
        triggerType: params.triggerType,
        triggerConfig: {
          type: params.triggerType as any,
          timeStr: params.timeStr,
          dayOfWeek: params.dayOfWeek,
        },
        conditions: [],
        actions: [{ type: params.actionType as any, title: params.name }],
      });
      return {
        success: true,
        data: auto,
        message: `Successfully created automation "${auto.name}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationUpdateTool: AITool = {
  id: "automation_update",
  name: "update_automation",
  description: "Update an existing automation's configuration.",
  parameters: z.object({
    id: z.string().describe("Automation ID"),
    name: z.string().describe("Updated title"),
    isEnabled: z.boolean().optional(),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.upsertAutomation(supabase, userId, {
        id: params.id,
        name: params.name,
        isEnabled: params.isEnabled,
        triggerType: "daily",
        triggerConfig: { type: "daily" },
        conditions: [],
        actions: [],
      });
      return { success: true, data: auto, message: `Updated automation "${auto.name}".` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationDeleteTool: AITool = {
  id: "automation_delete",
  name: "delete_automation",
  description: "Delete an automation by ID.",
  parameters: z.object({ id: z.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      await AutomationService.deleteAutomation(supabase, userId, params.id);
      return { success: true, message: "Automation deleted." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationEnableTool: AITool = {
  id: "automation_enable",
  name: "enable_automation",
  description: "Enable an automation by ID.",
  parameters: z.object({ id: z.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.setAutomationEnabled(supabase, userId, params.id, true);
      return { success: true, data: auto, message: `Enabled automation "${auto.name}".` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationDisableTool: AITool = {
  id: "automation_disable",
  name: "disable_automation",
  description: "Disable an automation by ID.",
  parameters: z.object({ id: z.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.setAutomationEnabled(supabase, userId, params.id, false);
      return { success: true, data: auto, message: `Disabled automation "${auto.name}".` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationListTool: AITool = {
  id: "automation_list",
  name: "list_automations",
  description: "List all user automations.",
  parameters: z.object({
    isEnabled: z.boolean().optional(),
    query: z.string().optional(),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const list = await AutomationService.listAutomations(supabase, userId, params);
      return { success: true, data: list, message: `Found ${list.length} automation(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationRunTool: AITool = {
  id: "automation_run",
  name: "run_automation",
  description: "Manually execute an automation immediately.",
  parameters: z.object({ id: z.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const run = await AutomationService.runAutomation(supabase, userId, params.id);
      return { success: true, data: run, message: `Ran automation: ${run.outputSummary}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationHistoryTool: AITool = {
  id: "automation_history",
  name: "get_automation_history",
  description: "Get recent execution history runs.",
  parameters: z.object({ limit: z.number().optional().default(10) }),
  execute: async (params, { supabase, userId }) => {
    try {
      const runs = await AutomationService.getExecutionHistory(supabase, userId, params.limit);
      return { success: true, data: runs, message: `Fetched ${runs.length} execution run(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationLogsTool: AITool = {
  id: "automation_logs",
  name: "get_automation_logs",
  description: "Get automation execution logs.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const runs = await AutomationService.getExecutionHistory(supabase, userId, 10);
      return { success: true, data: runs, message: "Retrieved execution logs." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const automationDefaultTool: AITool = {
  id: "automation_default",
  name: "setup_default_automations",
  description: "Initialize standard default AI automations (Morning Brief at 8 AM, Evening Review at 8 PM, etc).",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const created = await AutomationService.ensureDefaultAutomations(supabase, userId);
      return { success: true, data: created, message: `Set up ${created.length} default automation(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
