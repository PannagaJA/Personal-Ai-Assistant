import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../services/logger.js";
import { PlannerService } from "../planner/services.server.js";
import { NotesService } from "../notes/services.server.js";
import { FollowUpsService } from "../followups/services.server.js";
import type {
  AutomationItem,
  AutomationRun,
  AutomationLog,
  ListAutomationsOptions,
  TriggerConfig,
  ConditionConfig,
  ActionConfig,
} from "./types.js";

export class AutomationService {
  /**
   * List all user automations
   */
  public static async listAutomations(
    supabase: SupabaseClient,
    userId: string,
    options: ListAutomationsOptions = {},
  ): Promise<AutomationItem[]> {
    let query = (supabase.from as any)("user_automations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options.isEnabled !== undefined) {
      query = query.eq("is_enabled", options.isEnabled);
    }
    if (options.triggerType) {
      query = query.eq("trigger_type", options.triggerType);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    let items = data.map((row: any) => this.mapRowToAutomation(row));
    if (options.query) {
      const q = options.query.toLowerCase();
      items = items.filter(
        (a: AutomationItem) =>
          a.name.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q)),
      );
    }

    return items;
  }

  /**
   * Create default automations if user has none
   */
  public static async ensureDefaultAutomations(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<AutomationItem[]> {
    const existing = await this.listAutomations(supabase, userId);
    if (existing.length > 0) return existing;

    const defaults: Array<{
      name: string;
      description: string;
      triggerType: string;
      triggerConfig: TriggerConfig;
      conditions: ConditionConfig[];
      actions: ActionConfig[];
    }> = [
        {
          name: "Morning Intelligence Briefing",
          description: "Automatically generate morning briefing at 8:00 AM every day",
          triggerType: "daily",
          triggerConfig: { type: "daily", timeStr: "08:00" },
          conditions: [],
          actions: [{ type: "generate_morning_brief", title: "Generate Morning Brief" }],
        },
        {
          name: "Evening Work Review",
          description: "Automatically summarize work completed at 8:00 PM every evening",
          triggerType: "daily",
          triggerConfig: { type: "daily", timeStr: "20:00" },
          conditions: [],
          actions: [{ type: "generate_evening_review", title: "Generate Evening Review" }],
        },
        {
          name: "Pre-Meeting Preparation",
          description: "Generate prep notes 30 minutes before every meeting starts",
          triggerType: "event_start",
          triggerConfig: { type: "event_start", offsetMinutes: -30 },
          conditions: [{ type: "meeting_exists" }],
          actions: [{ type: "notify_user", title: "Prepare meeting agenda" }],
        },
        {
          name: "Overdue Task Alert",
          description: "Alert user when tasks are overdue",
          triggerType: "task_due",
          triggerConfig: { type: "task_due" },
          conditions: [{ type: "task_overdue" }],
          actions: [{ type: "notify_user", title: "Overdue task alert" }],
        },
        {
          name: "Friday Weekly Review",
          description: "Review week's accomplishments and pending follow-ups every Friday",
          triggerType: "weekly",
          triggerConfig: { type: "weekly", dayOfWeek: 5, timeStr: "17:00" },
          conditions: [],
          actions: [{ type: "run_planner", title: "Run Weekly Review" }],
        },
      ];

    const created: AutomationItem[] = [];
    for (const item of defaults) {
      const auto = await this.upsertAutomation(supabase, userId, item);
      created.push(auto);
    }

    return created;
  }

  /**
   * Create or update automation
   */
  public static async upsertAutomation(
    supabase: SupabaseClient,
    userId: string,
    payload: {
      id?: string;
      name: string;
      description?: string;
      isEnabled?: boolean;
      triggerType: string;
      triggerConfig: TriggerConfig;
      conditions: ConditionConfig[];
      actions: ActionConfig[];
    },
  ): Promise<AutomationItem> {
    const dbPayload: any = {
      user_id: userId,
      name: payload.name,
      description: payload.description || null,
      is_enabled: payload.isEnabled ?? true,
      trigger_type: payload.triggerType,
      trigger_config: payload.triggerConfig,
      conditions: payload.conditions,
      actions: payload.actions,
      updated_at: new Date().toISOString(),
    };

    let resultData: any;
    if (payload.id) {
      const { data, error } = await (supabase.from as any)("user_automations")
        .update(dbPayload)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(`Failed to update automation: ${error.message}`);
      resultData = data;
    } else {
      dbPayload.created_at = new Date().toISOString();
      const { data, error } = await (supabase.from as any)("user_automations")
        .insert(dbPayload)
        .select()
        .single();
      if (error) throw new Error(`Failed to create automation: ${error.message}`);
      resultData = data;
    }

    logger.info("system", `Automation saved: ${resultData.id}`, { name: payload.name }, userId);
    return this.mapRowToAutomation(resultData);
  }

  /**
   * Enable or disable automation
   */
  public static async setAutomationEnabled(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    isEnabled: boolean,
  ): Promise<AutomationItem> {
    const { data, error } = await (supabase.from as any)("user_automations")
      .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to update automation status: ${error?.message}`);
    return this.mapRowToAutomation(data);
  }

  /**
   * Delete automation
   */
  public static async deleteAutomation(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const { error } = await (supabase.from as any)("user_automations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete automation: ${error.message}`);
    return true;
  }

  /**
   * Execute automation manually or via trigger
   */
  public static async runAutomation(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<AutomationRun> {
    const startTime = Date.now();
    const { data: autoRow } = await (supabase.from as any)("user_automations")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!autoRow) throw new Error("Automation not found");

    const automation = this.mapRowToAutomation(autoRow);
    const results: string[] = [];

    try {
      for (const action of automation.actions) {
        if (action.type === "generate_morning_brief") {
          const brief = await PlannerService.generateMorningBrief(supabase, userId);
          const briefText = brief.summary || (brief.timelineItems?.length ? `${brief.timelineItems.length} meetings/tasks scheduled for today.` : "Your morning intelligence brief is ready!");
          results.push(`Generated Morning Brief: ${brief.summary}`);

          // Dispatch high-priority FCM notification with detailed morning brief
          await NotificationService.createNotification(supabase, userId, {
            type: "system_notification",
            title: "🌅 Daily Morning Brief",
            message: briefText,
            urgency: "high",
            actionUrl: "/dashboard",
          }).catch((err) => logger.warn("system", "Failed to create morning brief notification", { error: err?.message }));
        } else if (action.type === "generate_evening_review") {
          const review = await PlannerService.generateEveningReview(supabase, userId);
          const reviewText = review.summary || "Your evening work review is complete.";
          results.push(`Generated Evening Review: ${review.summary}`);

          await NotificationService.createNotification(supabase, userId, {
            type: "system_notification",
            title: "🌆 Evening Work Review",
            message: reviewText,
            urgency: "high",
            actionUrl: "/dashboard",
          }).catch((err) => logger.warn("system", "Failed to create evening review notification", { error: err?.message }));
        } else if (action.type === "create_task") {
          results.push(`Created automated task: ${action.title || "New Task"}`);
        } else if (action.type === "create_followup") {
          results.push(`Created automated follow-up: ${action.title || "New Follow-up"}`);
        } else {
          results.push(`Executed action "${action.type}"`);
        }
      }

      const durationMs = Date.now() - startTime;
      const outputSummary = results.join(" | ");

      // Record run
      const runRow = {
        automation_id: id,
        user_id: userId,
        status: "success",
        output_summary: outputSummary,
        duration_ms: durationMs,
        created_at: new Date().toISOString(),
      };

      let runData: any = null;
      try {
        const res = await (supabase.from as any)("automation_runs").insert(runRow).select().single();
        runData = res.data;
      } catch (_) {
        runData = null;
      }

      // Increment run_count & last_run_at
      await (supabase.from as any)("user_automations")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: (autoRow.run_count || 0) + 1,
        })
        .eq("id", id);

      logger.info("system", `Executed automation ${automation.name}`, { durationMs }, userId);

      return {
        id: runData?.id || `run-${Date.now()}`,
        automationId: id,
        userId,
        status: "success",
        outputSummary,
        durationMs,
        createdAt: new Date().toISOString(),
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.error("system", `Automation failed: ${automation.name}`, { error: err.message }, userId);

      return {
        id: `run-${Date.now()}`,
        automationId: id,
        userId,
        status: "failed",
        outputSummary: err.message,
        durationMs,
        createdAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Fetch recent execution runs
   */
  public static async getExecutionHistory(
    supabase: SupabaseClient,
    userId: string,
    limit = 20,
  ): Promise<AutomationRun[]> {
    const { data, error } = await (supabase.from as any)("automation_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      automationId: row.automation_id,
      userId: row.user_id,
      status: row.status,
      outputSummary: row.output_summary,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    }));
  }

  private static mapRowToAutomation(row: any): AutomationItem {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isEnabled: row.is_enabled ?? true,
      triggerType: row.trigger_type,
      triggerConfig: row.trigger_config || {},
      conditions: row.conditions || [],
      actions: row.actions || [],
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      runCount: row.run_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
