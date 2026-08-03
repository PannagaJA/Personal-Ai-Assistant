import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          toast.error("Authentication failed", { description: error.message });
          if (isMounted) navigate("/auth", { replace: true });
          return;
        }

        if (session?.user) {
          if (session.provider_token) {
            const expiresAt = new Date(Date.now() + (session.expires_in || 3600) * 1000).toISOString();
            const tokenPayload: any = {
              user_id: session.user.id,
              access_token: session.provider_token,
              expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            };
            if (session.provider_refresh_token) {
              tokenPayload.refresh_token = session.provider_refresh_token;
            }
            await (supabase.from as any)("user_google_tokens").upsert(tokenPayload);
          }

          toast.success("Successfully authenticated with Google!");
          if (isMounted) navigate("/dashboard", { replace: true });
        } else {
          const { data: listener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user && isMounted) {
              if (currentSession.provider_token) {
                const expiresAt = new Date(Date.now() + (currentSession.expires_in || 3600) * 1000).toISOString();
                const tokenPayload: any = {
                  user_id: currentSession.user.id,
                  access_token: currentSession.provider_token,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                };
                if (currentSession.provider_refresh_token) {
                  tokenPayload.refresh_token = currentSession.provider_refresh_token;
                }
                await (supabase.from as any)("user_google_tokens").upsert(tokenPayload);
              }
              listener.subscription.unsubscribe();
              navigate("/dashboard", { replace: true });
            }
          });
        }
      } catch (err) {
        console.error("Unexpected error during auth callback:", err);
        if (isMounted) navigate("/auth", { replace: true });
      }
    }

    void handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center space-y-4 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </main>
  );
}
