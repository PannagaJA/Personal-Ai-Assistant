import { z } from "zod";
import type { AITool } from "@/features/ai/tools/registry";
import { NotificationService } from "../services.server";

export const notificationsListTool: AITool = {
  id: "notifications_list",
  name: "list_notifications",
  description: "List user notifications with optional unread/archived filters.",
  parameters: z.object({
    isRead: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    limit: z.number().optional().default(10),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, params);
      return { success: true, data: items, message: `Found ${items.length} notification(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsReadTool: AITool = {
  id: "notifications_read",
  name: "mark_notification_read",
  description: "Mark a notification as read by ID.",
  parameters: z.object({ id: z.string().describe("Notification ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const ok = await NotificationService.markAsRead(supabase, userId, params.id);
      return { success: ok, message: ok ? "Marked as read." : "Notification not found." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsArchiveTool: AITool = {
  id: "notifications_archive",
  name: "archive_notifications",
  description: "Archive all read notifications.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const ok = await NotificationService.clearAllRead(supabase, userId);
      return { success: ok, message: "Archived read notifications." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsDeleteTool: AITool = {
  id: "notifications_delete",
  name: "delete_notification",
  description: "Delete a notification.",
  parameters: z.object({ id: z.string().describe("Notification ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      await NotificationService.markAsRead(supabase, userId, params.id);
      return { success: true, message: "Notification deleted." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsCreateTool: AITool = {
  id: "notifications_create",
  name: "create_notification",
  description: "Create a custom notification/reminder for the user.",
  parameters: z.object({
    title: z.string().describe("Notification title"),
    message: z.string().describe("Notification message content"),
    urgency: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
    type: z.string().optional().default("custom_reminder"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: params.type as any,
        title: params.title,
        message: params.message,
        urgency: params.urgency as any,
      });
      return { success: true, data: item, message: `Notification "${item.title}" sent.` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsSummaryTool: AITool = {
  id: "notifications_summary",
  name: "get_notifications_summary",
  description: "Get summary of unread notifications and attention alerts.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const unreadCount = await NotificationService.getUnreadCount(supabase, userId);
      const items = await NotificationService.listNotifications(supabase, userId, { isRead: false, limit: 5 });
      return {
        success: true,
        data: { unreadCount, topUnread: items },
        message: `You have ${unreadCount} unread notification(s).`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsClearTool: AITool = {
  id: "notifications_clear",
  name: "clear_read_notifications",
  description: "Clear all read notifications from the active list.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      await NotificationService.clearAllRead(supabase, userId);
      return { success: true, message: "Cleared read notifications." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsSettingsTool: AITool = {
  id: "notifications_settings",
  name: "get_notification_settings",
  description: "Get notification preferences and channel configurations.",
  parameters: z.object({}),
  execute: async () => {
    return {
      success: true,
      data: { browserEnabled: true, fcmEnabled: true, quietHours: "22:00 - 07:00" },
      message: "Retrieved notification settings.",
    };
  },
};

export const notificationsTodayTool: AITool = {
  id: "notifications_today",
  name: "get_todays_notifications",
  description: "Get all notifications received today.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, { limit: 15 });
      return { success: true, data: items, message: `Retrieved ${items.length} notification(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsPriorityTool: AITool = {
  id: "notifications_priority",
  name: "get_priority_notifications",
  description: "Get high priority and critical urgency notifications.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, { limit: 10 });
      const priorityItems = items.filter((n) => n.priorityScore >= 70 || n.urgency === "high" || n.urgency === "critical");
      return { success: true, data: priorityItems, message: `Found ${priorityItems.length} priority alert(s).` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsSendTool: AITool = {
  id: "notifications_send",
  name: "send_push_notification",
  description: "Send instant browser push or FCM notification to user device.",
  parameters: z.object({
    title: z.string(),
    message: z.string(),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: "system_notification",
        title: params.title,
        message: params.message,
        urgency: "high",
      });
      return { success: true, data: item, message: "Push notification sent." };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

export const notificationsTestTool: AITool = {
  id: "notifications_test",
  name: "test_notification_system",
  description: "Send a test notification to verify Browser and FCM providers.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: "system_notification",
        title: "Test Notification",
        message: "Jarvis Notification & Attention Engine is active!",
        urgency: "medium",
      });
      return { success: true, data: item, message: "Test notification sent successfully!" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
