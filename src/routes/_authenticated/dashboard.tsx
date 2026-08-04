import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Brain,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Users,
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
import { formatEventTime } from "@/features/calendar/utils";
import { extractSenderName } from "@/features/gmail/utils";
import { getPrimaryName, getPrimaryEmail, getPrimaryOrganization } from "@/features/contacts/utils";

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
  const todaysEvents = workspace.data?.todaysEvents ?? [];
  const nextMeeting = workspace.data?.nextMeeting;
  const freeTimeToday = workspace.data?.freeTimeToday ?? [];
  const unreadEmails = workspace.data?.unreadEmails ?? [];
  const contacts = workspace.data?.contacts ?? [];
  const favoriteContacts = workspace.data?.favoriteContacts ?? [];
  const frequentlyContacted = workspace.data?.frequentlyContacted ?? [];
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
              {todaysEvents.length} meetings · {unreadEmails.length} unread emails · {openTasks.length} open tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/gmail">
                <Mail className="size-4" />
                Gmail
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/calendar">
                <CalendarIcon className="size-4" />
                Calendar
              </Link>
            </Button>
            <Button asChild>
              <Link to="/chat">
                Ask Jarvis
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.header>

        {/* Daily Briefing Card */}
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
              ? "Reading your emails, schedule and tasks…"
              : (brief.data?.brief ??
                "Generate a briefing to see unread emails, today's schedule, priority tasks, and smart suggestions.")}
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Left Column: Tasks & Unread Email Widget */}
          <div className="space-y-6">
            {/* Priorities / Tasks */}
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

            {/* Unread Emails Widget */}
            <section className="glass-panel rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Unread Emails</h2>
                </div>
                <Link to="/gmail" className="text-xs text-primary hover:underline">
                  View inbox ({unreadEmails.length})
                </Link>
              </div>

              {unreadEmails.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Your inbox is clear. No unread emails requiring attention.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {unreadEmails.slice(0, 4).map((msg) => (
                    <li key={msg.id} className="flex items-start justify-between rounded-md bg-accent/40 p-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {extractSenderName(msg.from)}
                        </p>
                        <p className="truncate text-sm font-medium text-foreground">{msg.subject}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{msg.snippet}</p>
                      </div>
                      <Link to="/gmail" className="text-xs text-primary hover:underline shrink-0">
                        Read
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right Column: Calendar Widgets, Memory, Recent Chats */}
          <div className="space-y-6">
            {/* Today's Schedule Widget */}
            <section className="glass-panel rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-emerald-500" />
                  <h2 className="text-sm font-semibold">Today's Schedule</h2>
                </div>
                <Link to="/calendar" className="text-xs text-primary hover:underline">
                  View full ({todaysEvents.length})
                </Link>
              </div>

              {/* Next Meeting Banner inside widget */}
              {nextMeeting ? (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Next Meeting
                  </p>
                  <p className="text-sm font-semibold text-foreground">{nextMeeting.summary}</p>
                  <p className="text-xs text-muted-foreground">{formatEventTime(nextMeeting)}</p>
                </div>
              ) : null}

              {todaysEvents.length === 0 ? (
                <div className="mt-4 text-center py-4">
                  <p className="text-sm text-muted-foreground">No meetings scheduled for today.</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Ask Jarvis: "Schedule a meeting tomorrow at 3 PM"
                  </p>
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {todaysEvents.map((evt) => (
                    <li key={evt.id} className="flex items-start justify-between rounded-md bg-accent/40 p-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate text-sm font-medium text-foreground">{evt.summary}</p>
                        <p className="text-xs text-muted-foreground">{formatEventTime(evt)}</p>
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

              {/* Free Time Today summary indicator */}
              {freeTimeToday.length > 0 ? (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-accent/20 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-emerald-500" />
                  <span>
                    {freeTimeToday.length} free slot{freeTimeToday.length > 1 ? "s" : ""} remaining today
                  </span>
                </div>
              ) : null}
            </section>

            {/* People & Contacts Widget */}
            <section className="glass-panel rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">Contacts Directory</h2>
                </div>
                <Link to="/contacts" className="text-xs text-primary hover:underline">
                  View directory ({contacts.length})
                </Link>
              </div>

              {contacts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No contacts loaded. Visit Contacts page to view your directory.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {favoriteContacts.length > 0 ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Starred Favorites
                      </p>
                      <div className="space-y-1.5">
                        {favoriteContacts.slice(0, 3).map((c) => {
                          const name = getPrimaryName(c);
                          const email = getPrimaryEmail(c);
                          return (
                            <Link
                              key={c.resourceName}
                              to="/contacts"
                              className="flex items-center justify-between rounded-md bg-accent/40 px-2.5 py-1.5 text-xs transition hover:bg-accent/70"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="truncate font-medium text-foreground">{name}</p>
                                {email && <p className="truncate text-muted-foreground">{email}</p>}
                              </div>
                              <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Recent & Frequent Contacts
                    </p>
                    <div className="space-y-1.5">
                      {(frequentlyContacted.length > 0 ? frequentlyContacted : contacts).slice(0, 3).map((c) => {
                        const name = getPrimaryName(c);
                        const email = getPrimaryEmail(c);
                        const org = getPrimaryOrganization(c);
                        return (
                          <Link
                            key={c.resourceName}
                            to="/contacts"
                            className="flex items-center justify-between rounded-md bg-accent/30 px-2.5 py-1.5 text-xs transition hover:bg-accent/60"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="truncate font-medium text-foreground">{name}</p>
                              <p className="truncate text-muted-foreground">
                                {org ? org.name : email || "Contact"}
                              </p>
                            </div>
                            <span className="text-[10px] text-primary hover:underline shrink-0">View</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Memory Card */}
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
                  {memories.slice(0, 5).map((memory) => (
                    <li key={memory.id}>
                      <p className="text-sm font-medium">{memory.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{memory.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent Conversations */}
            <section className="glass-panel rounded-xl p-5">
              <h2 className="text-sm font-semibold">Recent conversations</h2>
              {threads.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {threads.slice(0, 5).map((thread) => (
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
