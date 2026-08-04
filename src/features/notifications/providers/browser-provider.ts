import type { INotificationProvider, NotificationItem } from "../types";

export class BrowserNotificationProvider implements INotificationProvider {
  public id = "browser" as const;
  public name = "Browser Web Notifications";

  public isAvailable(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public async send(notification: NotificationItem): Promise<boolean> {
    if (!this.isAvailable()) return false;

    if (Notification.permission === "granted") {
      try {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/favicon.ico",
          tag: notification.id,
        });
        return true;
      } catch {
        return false;
      }
    } else if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/favicon.ico",
          tag: notification.id,
        });
        return true;
      }
    }
    return false;
  }
}
