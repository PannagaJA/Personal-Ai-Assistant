import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  deleteTask,
  generateDailyBrief,
  getWorkspace,
  setTaskStatus,
  upsertTask,
} from "@/lib/assistant.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDue(due: string | null) {
  if (!due) return null;
  const date = new Date(due);
  const today = new Date();
  const overdue = date.getTime() < today.getTime();
  return {
    label: date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" }),
    overdue,
  };
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [newTask, setNewTask] = useState("");

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => getWorkspace() });

  const brief = useMutation({
    mutationFn: () => generateDailyBrief(),
    onError: (error: Error) => toast.error("Couldn't generate a brief", { description: error.message }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  const addTask = useMutation({
    mutationFn: (title: string) => upsertTask({ title, priority: "medium" }),
    onSuccess: () => {
      setNewTask("");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleTask = useMutation({
    mutationFn: (input: { id: string; status: "open" | "done" }) => setTaskStatus(input),
    onSuccess: invalidate,
  });

  const dropTask = useMutation({
    mutationFn: (id: string) => deleteTask({ id }),
    onSuccess: invalidate,
  });

  const tasks = workspace.data?.tasks ?? [];
  const openTasks = tasks.filter((task) => task.status !== "done");
  const doneToday = tasks.filter((task) => task.status === "done").length;
  const memories = workspace.data?.memories ?? [];
  const threads = workspace.data?.threads ?? [];
  const name = workspace.data?.profile?.display_name?.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {greeting()}
              {name ? `, ${name}` : ""}.
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {openTasks.length} open · {doneToday} completed · {memories.length} memories held
            </p>
          </div>
          <Button asChild>
            <Link to="/chat">
              Ask Jarvis
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </motion.header>

        <section className="glass-panel mt-8 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Daily brief</h2>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => brief.mutate()}
              disabled={brief.isPending}
            >
              {brief.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {brief.data ? "Regenerate" : "Generate"}
            </Button>
          </div>
          <div className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {brief.isPending
              ? "Reading your open work…"
              : (brief.data?.brief ??
                "Generate a briefing to see what matters today, what's slipping and what to do next.")}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className="glass-panel rounded-xl p-5">
            <h2 className="text-sm font-semibold">Priorities</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (newTask.trim()) addTask.mutate(newTask.trim());
              }}
              className="mt-3 flex gap-2"
            >
              <Input
                value={newTask}
                onChange={(event) => setNewTask(event.target.value)}
                placeholder="Add a task…"
              />
              <Button type="submit" size="icon" disabled={addTask.isPending || !newTask.trim()}>
                <Plus className="size-4" />
              </Button>
            </form>

            <ul className="mt-4 space-y-1">
              {workspace.isLoading
                ? [0, 1, 2].map((index) => <Skeleton key={index} className="h-11 w-full rounded-md" />)
                : null}
              {!workspace.isLoading && tasks.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Nothing tracked yet. Add a task, or just tell Jarvis in chat.
                </p>
              ) : null}
              {tasks.map((task) => {
                const due = formatDue(task.due_at);
                const done = task.status === "done";
                return (
                  <li
                    key={task.id}
                    className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleTask.mutate({ id: task.id, status: done ? "open" : "done" })
                      }
                      className="text-muted-foreground transition-colors hover:text-primary"
                      aria-label={done ? "Reopen task" : "Complete task"}
                    >
                      {done ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </p>
                      {due ? (
                        <p
                          className={cn(
                            "text-xs",
                            due.overdue && !done ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {due.overdue && !done ? "Overdue · " : ""}
                          {due.label}
                        </p>
                      ) : null}
                    </div>
                    {task.priority === "high" && !done ? (
                      <Badge variant="secondary">High</Badge>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => dropTask.mutate(task.id)}
                      className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                      aria-label="Delete task"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="space-y-6">
            <section className="glass-panel rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-semibold">Today's Schedule</h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  {workspace.data?.todaysEvents?.length ?? 0} events
                </span>
              </div>
              {!workspace.data?.todaysEvents || workspace.data.todaysEvents.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No meetings scheduled for today. Ask Jarvis in chat to schedule one.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {workspace.data.todaysEvents.map((evt) => (
                    <li key={evt.id} className="flex items-start justify-between rounded-md bg-accent/40 p-2.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{evt.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {evt.start.dateTime
                            ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "All Day"}
                        </p>
                      </div>
                      {evt.htmlLink && (
                        <a href={evt.htmlLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Brain className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Memory</h2>
              </div>
              {memories.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Jarvis stores facts, people and decisions automatically as you talk.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {memories.slice(0, 6).map((memory) => (
                    <li key={memory.id}>
                      <p className="text-sm font-medium">{memory.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{memory.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-panel rounded-xl p-5">
              <h2 className="text-sm font-semibold">Recent conversations</h2>
              {threads.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {threads.slice(0, 6).map((thread) => (
                    <li key={thread.id}>
                      <Link
                        to={`/chat/${thread.id}`}
                        className="block truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                      >
                        {thread.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
