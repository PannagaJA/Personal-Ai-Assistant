import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import Landing from "@/routes/index";
import AuthPage from "@/routes/auth";
import AuthCallbackPage from "@/routes/auth.callback";
import Dashboard from "@/routes/_authenticated/dashboard";
import ChatEntry from "@/routes/_authenticated/chat.index";
import ChatPage from "@/routes/_authenticated/chat.$threadId";
import CalendarPage from "@/routes/_authenticated/calendar";
import GmailPage from "@/routes/_authenticated/gmail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedLayout() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(Boolean(session?.user));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (authenticated === null) return null;
  if (!authenticated) return <Navigate to="/auth" replace />;

  return <Outlet />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chat" element={<ChatEntry />} />
              <Route path="/chat/:threadId" element={<ChatPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/gmail" element={<GmailPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
