import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";

function getEnvVar(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  return undefined;
}

function getFirebaseConfig() {
  return {
    apiKey: getEnvVar("VITE_FIREBASE_API_KEY") || getEnvVar("FIREBASE_API_KEY") || "",
    authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN") || getEnvVar("FIREBASE_AUTH_DOMAIN") || "",
    projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID") || getEnvVar("FIREBASE_PROJECT_ID") || "",
    storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET") || getEnvVar("FIREBASE_STORAGE_BUCKET") || "",
    messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID") || getEnvVar("FIREBASE_MESSAGING_SENDER_ID") || "",
    appId: getEnvVar("VITE_FIREBASE_APP_ID") || getEnvVar("FIREBASE_APP_ID") || "",
  };
}

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (appInstance) return appInstance;

  const config = getFirebaseConfig();
  if (!config.apiKey) return null;

  try {
    appInstance = getApps().length === 0 ? initializeApp(config) : getApps()[0]!;
    return appInstance;
  } catch {
    return null;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const app = getFirebaseApp();
    if (!app) return null;
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch {
    return null;
  }
}

export { appInstance as app };
