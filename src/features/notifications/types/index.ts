export type NotificationType =
  | "meeting_reminder"
  | "upcoming_meeting"
  | "task_reminder"
  | "overdue_task"
  | "followup_reminder"
  | "important_email"
  | "automation_result"
  | "morning_brief"
  | "evening_review"
  | "weekly_summary"
  | "monthly_summary"
  | "ai_suggestion"
  | "system_notification"
  | "custom_reminder";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type DeliveryChannel = "browser" | "fcm" | "email" | "sms" | "whatsapp";

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priorityScore: number; // 0 to 100
  urgency: UrgencyLevel;
  isRead: boolean;
  isArchived: boolean;
  actionUrl?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  browserEnabled: boolean;
  fcmEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  meetingReminders: boolean;
  taskReminders: boolean;
  updatedAt?: string;
}

export interface NotificationDevice {
  id: string;
  userId: string;
  fcmToken: string;
  deviceType: "browser" | "android" | "ios" | "pwa";
  userAgent?: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface INotificationProvider {
  id: DeliveryChannel;
  name: string;
  isAvailable(): boolean;
  send(notification: NotificationItem): Promise<boolean>;
}

export interface ListNotificationsOptions {
  isRead?: boolean;
  isArchived?: boolean;
  type?: NotificationType;
  limit?: number;
  query?: string;
}
