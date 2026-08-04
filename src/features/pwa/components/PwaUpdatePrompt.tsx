import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PwaUpdatePromptProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function PwaUpdatePrompt({ onUpdate, onDismiss }: PwaUpdatePromptProps) {
  return (
    <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card/95 p-4 shadow-xl backdrop-blur-md">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <RefreshCw className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Update Available</p>
          <p className="text-xs text-muted-foreground">A new version of Jarvis is ready.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            onClick={onUpdate}
          >
            Update
          </Button>
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
