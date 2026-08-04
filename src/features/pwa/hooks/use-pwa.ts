import { useState, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function usePwa() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Service Worker update registration via vite-plugin-pwa
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log("[PWA] Service Worker registered:", r);
    },
    onRegisterError(error: unknown) {
      console.error("[PWA] Service Worker registration error:", error);
    },
  });

  // Online / offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Standalone / installed detection
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener("change", handler);

    // iOS detection
    const iosInstalled = (navigator as any).standalone === true;
    setIsInstalled(mq.matches || iosInstalled);

    return () => mq.removeEventListener("change", handler);
  }, []);

  // Install prompt capture
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if not already installed
      if (!isInstalled) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInstalled]);

  // Detect successful install
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setShowInstallBanner(false);
      setIsInstalled(true);
    }
    return outcome === "accepted";
  }, [installPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false);
  }, []);

  const applyUpdate = useCallback(() => {
    updateServiceWorker(true);
    setNeedRefresh(false);
  }, [updateServiceWorker, setNeedRefresh]);

  return {
    isOnline,
    isInstalled,
    isStandalone,
    canInstall: Boolean(installPrompt),
    showInstallBanner,
    needRefresh,
    promptInstall,
    dismissInstallBanner,
    applyUpdate,
  };
}
