import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { createThread, listThreads } from "@/lib/assistant.functions";
import { AppShell } from "@/components/app-shell";
import { Loader2 } from "lucide-react";

export default function ChatEntry() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const threads = await listThreads();
      const existing = threads[0];
      const target = existing ?? (await createThread());
      navigate(`/chat/${target.id}`, { replace: true });
    })();
  }, [navigate]);

  return (
    <AppShell>
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    </AppShell>
  );
}
