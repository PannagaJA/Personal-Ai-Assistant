import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineStatusBarProps {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSync?: string | null;
}

export function OfflineStatusBar({ isOnline, isSyncing, lastSync }: OfflineStatusBarProps) {
  if (isOnline && !isSyncing) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all",
        isOnline
          ? "bg-amber-500/15 text-amber-400 border-b border-amber-500/20"
          : "bg-rose-500/15 text-rose-400 border-b border-rose-500/20"
      )}
    >
      {isOnline ? (
        <>
          <RefreshCw className="size-3 animate-spin" />
          Syncing changes…
        </>
      ) : (
        <>
          <WifiOff className="size-3" />
          You're offline — viewing cached data
          {lastSync && (
            <span className="text-muted-foreground ml-2">
              Last synced: {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function OnlineIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium",
        isOnline ? "text-emerald-400" : "text-rose-400"
      )}
    >
      {isOnline ? (
        <Wifi className="size-3" />
      ) : (
        <WifiOff className="size-3" />
      )}
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
