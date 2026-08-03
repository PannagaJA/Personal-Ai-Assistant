import { z } from "zod";
import type { AITool } from "@/features/ai/tools/registry";

export const listTasksTool: AITool = {
  id: "list_tasks",
  name: "List Tasks",
  description: "List the user's tasks, optionally filtered by status.",
  parameters: z.object({
    status: z.enum(["open", "done", "all"]).default("open"),
  }),
  execute: async ({ status }, { supabase, userId }) => {
    let query = supabase
      .from("tasks")
      .select("id, title, priority, status, due_at")
      .eq("user_id", userId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(40);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { tasks: data ?? [] } };
  },
};

export const createTaskTool: AITool = {
  id: "create_task",
  name: "Create Task",
  description: "Create a task or reminder for the user.",
  parameters: z.object({
    title: z.string(),
    notes: z.string().nullable().default(null),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    dueAt: z
      .string()
      .nullable()
      .default(null)
      .describe("ISO 8601 datetime, or null when there is no due date"),
  }),
  execute: async ({ title, notes, priority, dueAt }, { supabase, userId }) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ user_id: userId, title, notes, priority, due_at: dueAt })
      .select("id, title, due_at, priority")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: `Created task: "${title}"`, data: { created: data } };
  },
};

export const completeTaskTool: AITool = {
  id: "complete_task",
  name: "Complete Task",
  description: "Mark a task as done. Look up the id with list_tasks first.",
  parameters: z.object({
    id: z.string().uuid(),
  }),
  execute: async ({ id }, { supabase, userId }) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "Task marked as completed.", data: { completedId: id } };
  },
};

export const dailyOverviewTool: AITool = {
  id: "daily_overview",
  name: "Daily Overview",
  description: "Get a snapshot of today: open tasks, tasks due today, overdue tasks, and recent memories.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [open, memories] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, priority, due_at")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(30),
      supabase
        .from("memories")
        .select("title, content, kind")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const tasks = open.data ?? [];
    return {
      success: true,
      data: {
        now: now.toISOString(),
        dueToday: tasks.filter((t) => t.due_at && t.due_at <= endOfDay.toISOString()),
        openTasks: tasks,
        recentMemories: memories.data ?? [],
      },
    };
  },
};
