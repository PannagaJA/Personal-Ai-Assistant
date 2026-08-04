import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, MessageSquare, Calendar as CalendarIcon, Mail, Users, BookOpen, Moon, Sun, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import jarvisMark from "@/assets/jarvis-mark.png";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/gmail", label: "Gmail", icon: Mail },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/notes", label: "Notes", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase.from as any)("user_google_tokens").delete().eq("user_id", user.id);
    }
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-[64px] flex-col items-center justify-between border-r bg-sidebar py-4 sm:w-[212px] sm:items-stretch sm:px-3">
        <div className="w-full">
          <div className="flex items-center gap-2.5 px-1 pb-6 sm:px-2">
            <img src={jarvisMark} alt="Jarvis" className="size-7 rounded-md" />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">Jarvis</span>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex w-full flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={toggle} className="justify-start gap-2.5">
            {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-2.5">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1">
        <div className="aurora pointer-events-none absolute inset-x-0 top-0 h-[380px]" />
        <div className="relative">{children}</div>
      </main>
    </div>
  );
}
