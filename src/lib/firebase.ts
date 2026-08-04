import { initializeApp, getApps } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string,
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch {
    return null;
  }
}

export { app };
