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
    if (!fcmProvider.isAvailable()) return;

    void (async () => {
      try {
        const token = await fcmProvider.register();
        if (token) {
          await registerDeviceToken(token);
        }
      } catch {
        // Silently fail — FCM is optional
      }
    })();
  }, []);

  return null;
}
