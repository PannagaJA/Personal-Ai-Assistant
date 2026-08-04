import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../services/logger.js";
import type {
  NotificationItem,
  NotificationType,
  UrgencyLevel,
  ListNotificationsOptions,
  NotificationPreference,
} from "./types";
import { NotificationProviderRegistry } from "./providers/provider-registry";

export class NotificationService {
  /**
   * List notifications for a user
   */
  public static async listNotifications(
    supabase: SupabaseClient,
    userId: string,
    options: ListNotificationsOptions = {},
  ): Promise<NotificationItem[]> {
    let query = (supabase.from as any)("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options.isRead !== undefined) {
      query = query.eq("is_read", options.isRead);
    }
    if (options.isArchived !== undefined) {
      query = query.eq("is_archived", options.isArchived);
    }
    if (options.type) {
      query = query.eq("type", options.type);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    let items = data.map((row: any) => this.mapRowToNotification(row));
    if (options.query) {
      const q = options.query.toLowerCase();
      items = items.filter(
        (n: NotificationItem) =>
          n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q),
      );
    }

    return items;
  }

  /**
   * Get unread notification count
   */
  public static async getUnreadCount(supabase: SupabaseClient, userId: string): Promise<number> {
    const { count, error } = await (supabase.from as any)("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .eq("is_archived", false);

    if (error) return 0;
    return count ?? 0;
  }

  /**
   * Create and dispatch notification
   */
  public static async createNotification(
    supabase: SupabaseClient,
    userId: string,
    payload: {
      type: NotificationType;
      title: string;
      message: string;
      priorityScore?: number;
      urgency?: UrgencyLevel;
      actionUrl?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<NotificationItem> {
    const priorityScore = payload.priorityScore ?? this.calculatePriorityScore(payload.type, payload.urgency);
    const dbRow = {
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      priority_score: priorityScore,
      urgency: payload.urgency || "medium",
      is_read: false,
      is_archived: false,
      action_url: payload.actionUrl || null,
      metadata: payload.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from as any)("notifications")
      .insert(dbRow)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create notification: ${error?.message}`);

    const item = this.mapRowToNotification(data);

    // Dispatch via Provider Registry (Browser Push / FCM)
    if (typeof window !== "undefined") {
      void NotificationProviderRegistry.getInstance().dispatchAll(item);
    }

    logger.info("system", `Created notification: ${item.title}`, { type: item.type }, userId);
    return item;
  }

  /**
   * Mark notification as read
   */
  public static async markAsRead(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<boolean> {
    const { error } = await (supabase.from as any)("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    return !error;
  }

  /**
   * Clear or archive notifications
   */
  public static async clearAllRead(supabase: SupabaseClient, userId: string): Promise<boolean> {
    const { error } = await (supabase.from as any)("notifications")
      .update({ is_archived: true })
      .eq("user_id", userId)
      .eq("is_read", true);

    return !error;
  }

  /**
   * Register FCM Device Token
   */
  public static async registerDeviceToken(
    supabase: SupabaseClient,
    userId: string,
    fcmToken: string,
    deviceType = "browser",
  ): Promise<boolean> {
    const dbRow = {
      user_id: userId,
      fcm_token: fcmToken,
      device_type: deviceType,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      last_active_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from as any)("notification_devices")
      .upsert(dbRow, { onConflict: "fcm_token" });

    return !error;
  }

  private static calculatePriorityScore(type: NotificationType, urgency?: UrgencyLevel): number {
    let score = 50;
    if (urgency === "critical") score += 40;
    else if (urgency === "high") score += 25;
    else if (urgency === "medium") score += 10;

    if (type === "meeting_reminder" || type === "overdue_task") score += 15;
    return Math.min(100, Math.max(0, score));
  }

  private static mapRowToNotification(row: any): NotificationItem {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priorityScore: row.priority_score || 50,
      urgency: row.urgency || "medium",
      isRead: row.is_read ?? false,
      isArchived: row.is_archived ?? false,
      actionUrl: row.action_url,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }
}
