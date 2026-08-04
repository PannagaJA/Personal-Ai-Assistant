import { useState } from "react";
import { Bell, Check, Sparkles } from "lucide-react";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { NotificationCard } from "@/features/notifications/components/NotificationCard";
import type { NotificationItem } from "@/features/notifications/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "priority">("unread");

  const queryOpts: any = {};
  if (activeTab === "unread") queryOpts.isRead = false;

  const { notifications, isLoading, markAsRead, clearRead, createNotification } = useNotifications(queryOpts);

  const displayNotifications: NotificationItem[] =
    activeTab === "priority"
      ? notifications.filter((n: NotificationItem) => n.priorityScore >= 60 || n.urgency === "high" || n.urgency === "critical")
      : notifications;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Notification & Attention Engine</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Provider-agnostic attention hub: Browser push, FCM Web SDK, and AI prioritized alerts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                createNotification.mutate({
                  type: "system_notification",
                  title: "Test Push Notification",
                  message: "Jarvis Notification & Attention Engine is active!",
                  urgency: "high",
                })
              }
              className="gap-1.5"
            >
              <Sparkles className="size-4 text-primary" />
              Test Push
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearRead.mutate()}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <Check className="size-3.5" />
              Clear Read
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-6 flex items-center gap-1 border-b border-border/40 pb-2">
          <Button
            variant={activeTab === "unread" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("unread")}
          >
            Unread
          </Button>
          <Button
            variant={activeTab === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("all")}
          >
            All
          </Button>
          <Button
            variant={activeTab === "priority" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("priority")}
          >
            Priority Alerts
          </Button>
        </div>

        {/* Notifications List */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : displayNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <Bell className="size-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No notifications</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You're all caught up! No active attention alerts pending.
              </p>
            </div>
          ) : (
            displayNotifications.map((item) => (
              <NotificationCard
                key={item.id}
                notification={item}
                onMarkRead={(id) => markAsRead.mutate(id)}
              />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
