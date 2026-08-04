import { useEffect } from "react";
import { FcmNotificationProvider } from "@/features/notifications/providers/fcm-provider";
import { registerDeviceToken } from "@/lib/assistant.functions";

const fcmProvider = new FcmNotificationProvider();

/**
 * FcmInitializer — mount once inside ProtectedLayout.
 * Registers the FCM token when the user is authenticated and stores it in Supabase.
 */
export function FcmInitializer() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Check permission state
    const checkAndRequestPermission = async () => {
      try {
        if (Notification.permission === "default") {
          // Explicitly prompt the user for permission on load
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            const token = await fcmProvider.register();
            if (token) await registerDeviceToken(token);
          }
        } else if (Notification.permission === "granted") {
          const token = await fcmProvider.register();
          if (token) await registerDeviceToken(token);
        }
      } catch (err) {
        console.error("[FCM] Permission/Registration error:", err);
      }
    };

    void checkAndRequestPermission();
  }, []);

  return null;
}
