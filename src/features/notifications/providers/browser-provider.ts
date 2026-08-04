import type { INotificationProvider, NotificationItem } from "../types.js";

export class BrowserNotificationProvider implements INotificationProvider {
  public id = "browser" as const;
  public name = "Browser Web Notifications";

  public isAvailable(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  public async send(notification: NotificationItem): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return false;
      }

      if (Notification.permission !== "granted") return false;

      // Check if a Service Worker is active (especially required for PWA / Android)
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && "showNotification" in registration) {
          await registration.showNotification(notification.title, {
            body: notification.message,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: notification.id,
            data: { url: "/notifications" },
          });
          return true;
        }
      }

      // Fallback to classic browser Notification constructor
      new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico",
        tag: notification.id,
      });
      return true;
    } catch (err) {
      console.error("[BrowserNotificationProvider] Error showing notification:", err);
      return false;
    }
  }
}
