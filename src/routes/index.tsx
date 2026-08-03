import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Brain, ListChecks, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import jarvisMark from "@/assets/jarvis-mark.png";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Conversational command",
    body: "Ask in plain language. Jarvis reasons, calls tools and reports back — no menus.",
  },
  {
    icon: Brain,
    title: "Persistent memory",
    body: "Decisions, people, promises and context are stored and recalled without prompting.",
  },
  {
    icon: ListChecks,
    title: "Executive dashboard",
    body: "Priorities, due work and a generated daily brief the moment you sign in.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  if (!checked) return <div className="min-h-screen bg-background" />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="aurora pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src={jarvisMark} alt="Jarvis" className="size-7 rounded-md" />
          <span className="text-sm font-semibold tracking-tight">Jarvis</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-24 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <p className="mb-5 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Private, single-operator system
          </p>
          <h1 className="text-balance-tight text-5xl leading-[1.05] font-semibold sm:text-6xl">
            A personal operating system, run by an AI that remembers.
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground">
            Jarvis keeps your tasks, context and decisions in one place, then acts on them through
            conversation. Built for one person who wants everything in a single surface.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Enter the system
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {capabilities.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * index, ease: "easeOut" }}
              className="glass-panel rounded-xl p-5"
            >
              <item.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-sm font-semibold">{item.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
