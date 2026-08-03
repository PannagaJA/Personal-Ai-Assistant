import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCalendarEvents,
  useCalendarMutations,
} from "@/features/calendar/hooks/use-calendar";
import { MonthView } from "@/features/calendar/components/views/MonthView";
import { WeekView } from "@/features/calendar/components/views/WeekView";
import { DayView } from "@/features/calendar/components/views/DayView";
import { AgendaView } from "@/features/calendar/components/views/AgendaView";
import { EventDialog } from "@/features/calendar/components/EventDialog";
import type {
  CalendarEvent,
  CalendarViewMode,
  CreateEventInput,
  UpdateEventInput,
} from "@/features/calendar/types";
import {
  getStartOfMonthIso,
  getEndOfMonthIso,
  formatEventTime,
} from "@/features/calendar/utils";

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);

  // Compute time boundaries for fetching events
  const timeMin = getStartOfMonthIso(currentDate);
  const timeMax = getEndOfMonthIso(currentDate);

  const { data: events = [], isLoading, isError, error } = useCalendarEvents(
    timeMin,
    timeMax,
    searchQuery,
  );

  const { createEvent, updateEvent, deleteEvent } = useCalendarMutations();

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOpenCreate = () => {
    setEventToEdit(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (evt: CalendarEvent) => {
    setEventToEdit(evt);
    setDialogOpen(true);
  };

  const handleSaveCreate = (input: CreateEventInput) => {
    createEvent.mutate(input);
  };

  const handleSaveUpdate = (input: UpdateEventInput) => {
    updateEvent.mutate(input);
  };

  const handleDelete = (evtId: string) => {
    if (window.confirm("Are you sure you want to delete this event from Google Calendar?")) {
      deleteEvent.mutate(evtId);
    }
  };

  const formattedMonthYear = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const nextMeeting = events.find(
    (e) => e.start.dateTime && new Date(e.start.dateTime) > new Date(),
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-5"
        >
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Google Calendar</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Synced directly with your Google Account
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meetings…"
                className="pl-9 text-xs"
              />
            </div>

            <Button onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold">
              <Plus className="size-4" />
              New Event
            </Button>
          </div>
        </motion.header>

        {/* View Switcher and Navigation Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleToday} className="text-xs font-medium">
              Today
            </Button>
            <div className="flex items-center rounded-lg border border-border/60 bg-accent/20 p-0.5">
              <Button size="icon-sm" variant="ghost" onClick={handlePrev}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={handleNext}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <h2 className="ml-2 text-base font-semibold text-foreground">{formattedMonthYear}</h2>
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center rounded-lg border border-border/60 bg-accent/30 p-1 text-xs">
            {(["month", "week", "day", "agenda"] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1 font-medium capitalize transition ${
                  viewMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Next Meeting Banner */}
        {nextMeeting ? (
          <div className="glass-panel mt-4 flex items-center justify-between rounded-xl px-4 py-3 border-l-4 border-l-primary">
            <div className="flex items-center gap-3">
              <Sparkles className="size-4 text-primary animate-pulse" />
              <div>
                <p className="text-xs text-muted-foreground">Next Up Today</p>
                <p className="text-sm font-semibold text-foreground">{nextMeeting.summary}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {formatEventTime(nextMeeting)}
            </Badge>
          </div>
        ) : null}

        {/* Main Calendar View Container */}
        <div className="mt-6">
          {isLoading ? (
            <div className="glass-panel flex h-64 items-center justify-center rounded-xl p-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                Syncing Google Calendar events…
              </div>
            </div>
          ) : isError ? (
            <div className="glass-panel rounded-xl p-6 text-center">
              <p className="text-sm text-destructive font-semibold">Calendar Sync Issue</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Failed to load events."}
              </p>
            </div>
          ) : (
            <>
              {viewMode === "month" && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleOpenEdit}
                  onSelectDate={(date) => {
                    setCurrentDate(date);
                    setViewMode("day");
                  }}
                />
              )}
              {viewMode === "week" && (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleOpenEdit}
                />
              )}
              {viewMode === "day" && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onSelectEvent={handleOpenEdit}
                  onDeleteEvent={handleDelete}
                />
              )}
              {viewMode === "agenda" && (
                <AgendaView
                  events={events}
                  onSelectEvent={handleOpenEdit}
                  onDeleteEvent={handleDelete}
                />
              )}
            </>
          )}
        </div>

        {/* Event Dialog Modal */}
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          eventToEdit={eventToEdit}
          onSaveCreate={handleSaveCreate}
          onSaveUpdate={handleSaveUpdate}
          isSubmitting={createEvent.isPending || updateEvent.isPending}
        />
      </div>
    </AppShell>
  );
}
