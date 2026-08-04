import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../services/logger.js";
import type {
  FollowUpItem,
  FollowUpHistory,
  RelationshipLink,
  ListFollowUpsOptions,
  RelationshipTimeline,
  TimelineEvent,
  FollowUpPriority,
  FollowUpStatus,
} from "./types";
import { calculateRelationshipHealthScore, isOverdue } from "./utils";

export class FollowUpsService {
  /**
   * List follow-ups with filters
   */
  public static async listFollowUps(
    supabase: SupabaseClient,
    userId: string,
    options: ListFollowUpsOptions = {},
  ): Promise<FollowUpItem[]> {
    let query = (supabase.from as any)("user_followups")
      .select("*, relationship_links(*)")
      .eq("user_id", userId);

    if (options.status) query = query.eq("status", options.status);
    if (options.priority) query = query.eq("priority", options.priority);
    if (options.category) query = query.eq("category", options.category);
    if (options.personName) query = query.ilike("person_name", `%${options.personName}%`);
    if (options.organizationName) query = query.ilike("organization_name", `%${options.organizationName}%`);

    if (options.query && options.query.trim()) {
      const q = `%${options.query.trim()}%`;
      query = query.or(`title.ilike.${q},person_name.ilike.${q},organization_name.ilike.${q},notes.ilike.${q}`);
    }

    query = query.order("followup_date", { ascending: true, nullsFirst: false });

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) {
      logger.error("database", "Failed to list followups", { error: error.message }, userId);
      return [];
    }

    let items: FollowUpItem[] = (data || []).map(this.mapRowToFollowUp);

    if (options.isOverdue) {
      items = items.filter((f) => isOverdue(f.followupDate, f.status));
    }
    if (options.isToday) {
      const today = new Date().toISOString().split("T")[0] || "";
      items = items.filter((f) => Boolean(f.followupDate && f.followupDate.startsWith(today)));
    }

    return items;
  }

  /**
   * Get single follow-up by ID with links & history
   */
  public static async getFollowUpById(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<FollowUpItem | null> {
    const { data, error } = await (supabase.from as any)("user_followups")
      .select("*, relationship_links(*)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToFollowUp(data);
  }

  /**
   * Create or update follow-up
   */
  public static async upsertFollowUp(
    supabase: SupabaseClient,
    userId: string,
    payload: {
      id?: string;
      title: string;
      personName?: string;
      organizationName?: string;
      category?: string;
      priority?: FollowUpPriority;
      status?: FollowUpStatus;
      followupDate?: string;
      reminderDate?: string;
      lastContactDate?: string;
      nextContactDate?: string;
      notes?: string;
      actionItems?: string[];
      tags?: string[];
      links?: Array<{ entityType: string; entityId: string; entityTitle: string }>;
    },
  ): Promise<FollowUpItem> {
    const dbPayload: any = {
      user_id: userId,
      title: payload.title,
      person_name: payload.personName || null,
      organization_name: payload.organizationName || null,
      category: payload.category || "General",
      priority: payload.priority || "medium",
      status: payload.status || "pending",
      followup_date: payload.followupDate || null,
      reminder_date: payload.reminderDate || null,
      last_contact_date: payload.lastContactDate || null,
      next_contact_date: payload.nextContactDate || null,
      notes: payload.notes || null,
      action_items: payload.actionItems || [],
      tags: payload.tags || [],
      updated_at: new Date().toISOString(),
    };

    let resultData: any;
    const isNew = !payload.id;

    if (payload.id) {
      const { data, error } = await (supabase.from as any)("user_followups")
        .update(dbPayload)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update followup: ${error.message}`);
      resultData = data;

      await this.recordHistory(supabase, userId, payload.id, "updated", `Updated followup "${payload.title}"`);
    } else {
      dbPayload.created_at = new Date().toISOString();
      const { data, error } = await (supabase.from as any)("user_followups")
        .insert(dbPayload)
        .select()
        .single();

      if (error) throw new Error(`Failed to create followup: ${error.message}`);
      resultData = data;

      try {
        await this.recordHistory(supabase, userId, resultData.id, "created", `Created followup "${payload.title}"`);
      } catch (histErr) {
        logger.warn("database", "Failed to record followup history", { error: String(histErr) }, userId);
      }
    }

    // Insert relationship links if provided
    if (payload.links && payload.links.length > 0) {
      const linkRows = payload.links.map((link) => ({
        followup_id: resultData.id,
        entity_type: link.entityType,
        entity_id: link.entityId,
        entity_title: link.entityTitle,
      }));
      await (supabase.from as any)("relationship_links").insert(linkRows).catch(() => null);
    }

    logger.info("database", `Followup saved: ${resultData.id}`, { title: payload.title }, userId);
    return this.mapRowToFollowUp(resultData);
  }

  /**
   * Complete follow-up
   */
  public static async completeFollowUp(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<FollowUpItem> {
    const { data, error } = await (supabase.from as any)("user_followups")
      .update({
        status: "completed",
        last_contact_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to complete followup: ${error.message}`);
    await this.recordHistory(supabase, userId, id, "completed", `Completed followup "${data.title}"`);
    return this.mapRowToFollowUp(data);
  }

  /**
   * Delete follow-up
   */
  public static async deleteFollowUp(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<{ ok: boolean }> {
    const { error } = await (supabase.from as any)("user_followups")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete followup: ${error.message}`);
    return { ok: true };
  }

  /**
   * Build Relationship Timeline for a Person or Organization across Meetings, Emails, Tasks, Notes, and Followups
   */
  public static async getRelationshipTimeline(
    supabase: SupabaseClient,
    userId: string,
    personOrOrg: string,
  ): Promise<RelationshipTimeline> {
    const like = `%${personOrOrg.trim()}%`;
    const events: TimelineEvent[] = [];

    // 1. Fetch Followups
    const followups = await this.listFollowUps(supabase, userId, { query: personOrOrg });
    followups.forEach((f) => {
      events.push({
        id: f.id,
        date: f.followupDate || f.createdAt,
        title: f.title,
        type: "followup",
        description: `Status: ${f.status} | Priority: ${f.priority}${f.notes ? ` - ${f.notes}` : ""}`,
        url: `/followups`,
      });
    });

    // 2. Fetch Memories
    const { data: memories } = await supabase
      .from("memories")
      .select("id, title, content, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.${like},content.ilike.${like}`)
      .limit(5);

    (memories || []).forEach((m: any) => {
      events.push({
        id: m.id,
        date: m.created_at,
        title: m.title,
        type: "memory",
        description: m.content,
      });
    });

    // 3. Fetch Tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, due_at, created_at")
      .eq("user_id", userId)
      .ilike("title", like)
      .limit(5);

    (tasks || []).forEach((t: any) => {
      events.push({
        id: t.id,
        date: t.due_at || t.created_at,
        title: `Task: ${t.title}`,
        type: "task",
        description: `Status: ${t.status}`,
      });
    });

    // Sort timeline chronologically descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastContacted = events.length > 0 && events[0] ? events[0].date : undefined;
    const overdueCount = followups.filter((f) => isOverdue(f.followupDate, f.status)).length;
    const healthScore = calculateRelationshipHealthScore(lastContacted, overdueCount);

    const timeline: RelationshipTimeline = {
      personOrOrg,
      healthScore,
      statusSummary: `${events.length} historical interaction(s) recorded for "${personOrOrg}".`,
      events,
    };
    if (lastContacted) timeline.lastContacted = lastContacted;

    return timeline;
  }

  private static async recordHistory(
    supabase: SupabaseClient,
    userId: string,
    followupId: string,
    eventType: string,
    description: string,
  ) {
    await (supabase.from as any)("followup_history").insert({
      followup_id: followupId,
      user_id: userId,
      event_type: eventType,
      description,
      created_at: new Date().toISOString(),
    }).catch(() => null);
  }

  private static mapRowToFollowUp(row: any): FollowUpItem {
    const rawLinks = row.relationship_links || [];
    const links: RelationshipLink[] = rawLinks.map((l: any) => ({
      id: l.id,
      followupId: l.followup_id,
      entityType: l.entity_type,
      entityId: l.entity_id,
      entityTitle: l.entity_title,
      createdAt: l.created_at,
    }));

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      personName: row.person_name,
      organizationName: row.organization_name,
      category: row.category || "General",
      priority: row.priority || "medium",
      status: row.status || "pending",
      followupDate: row.followup_date,
      reminderDate: row.reminder_date,
      lastContactDate: row.last_contact_date,
      nextContactDate: row.next_contact_date,
      notes: row.notes,
      actionItems: row.action_items || [],
      aiSummary: row.ai_summary,
      tags: row.tags || [],
      links,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
