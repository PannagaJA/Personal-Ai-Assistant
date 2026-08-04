import { Download, X, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PwaInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function PwaInstallBanner({ onInstall, onDismiss }: PwaInstallBannerProps) {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-card/95 p-4 shadow-xl backdrop-blur-md">
        {/* Icon */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isMobile ? <Smartphone className="size-5" /> : <Monitor className="size-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Install Jarvis</p>
          {isIos ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <span className="font-semibold">Share</span> then{" "}
              <span className="font-semibold">"Add to Home Screen"</span> to install.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Install your AI Operating System for offline access and faster experience.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {!isIos && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={onInstall}
            >
              <Download className="size-3.5" />
              Install
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
