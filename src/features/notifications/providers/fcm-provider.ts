import { getToken, onMessage } from "firebase/messaging";
import type { INotificationProvider, NotificationItem } from "../types.js";
import { getFirebaseMessaging } from "../../../lib/firebase.js";
import { logger } from "../../../services/logger.js";

const VAPID_KEY = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string | undefined;

export class FcmNotificationProvider implements INotificationProvider {
  public id = "fcm" as const;
  public name = "Firebase Cloud Messaging (FCM)";

  private token: string | null = null;

  public isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      Boolean(VAPID_KEY) &&
      VAPID_KEY !== "your-vapid-key-here"
    );
  }

  /**
   * Request notification permission and register FCM token.
   * Call this once after user logs in.
   */
  public async register(): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        logger.warn("system", "FCM: Notification permission denied");
        return null;
      }

      // Register FCM service worker with a dedicated scope so it doesn't conflict with PWA sw.js
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );

      const messaging = getFirebaseMessaging();
      if (!messaging) return null;

      this.token = await getToken(messaging, {
        vapidKey: VAPID_KEY!,
        serviceWorkerRegistration: registration,
      });

      logger.info("system", "FCM token registered", { tokenLength: this.token?.length });

      // Handle foreground messages
      onMessage(messaging, async (payload) => {
        logger.info("system", "FCM foreground message", { title: payload.notification?.title });
        if (Notification.permission === "granted" && payload.notification) {
          const title = payload.notification.title || "Jarvis";
          const options = {
            body: payload.notification.body || "",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          };

          if ("serviceWorker" in navigator) {
            const swReg = await navigator.serviceWorker.ready;
            if (swReg && "showNotification" in swReg) {
              await swReg.showNotification(title, options);
              return;
            }
          }
          new Notification(title, options);
        }
      });

      return this.token;
    } catch (err: any) {
      logger.warn("system", "FCM token registration failed", { error: err.message });
      return null;
    }
  }

  public async send(notification: NotificationItem): Promise<boolean> {
    if (!this.isAvailable()) return false;
    // FCM sends are server-side via the FCM API.
    // Client-side we only register tokens; the backend sends via HTTP v1 API.
    // For browser-tab foreground notifications we still use the Browser provider.
    logger.info("system", `FCM dispatch queued: ${notification.title}`, { id: notification.id }, notification.userId);
    return true;
  }

  public getToken(): string | null {
    return this.token;
  }
}
