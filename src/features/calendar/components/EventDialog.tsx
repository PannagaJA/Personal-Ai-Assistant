import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from "../types";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventToEdit?: CalendarEvent | null;
  onSaveCreate: (input: CreateEventInput) => void;
  onSaveUpdate: (input: UpdateEventInput) => void;
  isSubmitting?: boolean;
}

export function EventDialog({
  open,
  onOpenChange,
  eventToEdit,
  onSaveCreate,
  onSaveUpdate,
  isSubmitting = false,
}: EventDialogProps) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [attendeesStr, setAttendeesStr] = useState("");

  useEffect(() => {
    if (eventToEdit) {
      setSummary(eventToEdit.summary || "");
      setDescription(eventToEdit.description || "");
      setLocation(eventToEdit.location || "");
      setIsAllDay(Boolean(eventToEdit.isAllDay));

      if (eventToEdit.start.dateTime) {
        const d = new Date(eventToEdit.start.dateTime);
        setStartDate(d.toISOString().split("T")[0] ?? "");
        setStartTime(d.toTimeString().slice(0, 5));
      } else if (eventToEdit.start.date) {
        setStartDate(eventToEdit.start.date);
      }

      if (eventToEdit.end.dateTime) {
        const d = new Date(eventToEdit.end.dateTime);
        setEndDate(d.toISOString().split("T")[0] ?? "");
        setEndTime(d.toTimeString().slice(0, 5));
      } else if (eventToEdit.end.date) {
        setEndDate(eventToEdit.end.date);
      }

      setAttendeesStr(eventToEdit.attendees?.map((a) => a.email).join(", ") || "");
    } else {
      const today = new Date().toISOString().split("T")[0] ?? "";
      setSummary("");
      setDescription("");
      setLocation("");
      setStartDate(today);
      setStartTime("09:00");
      setEndDate(today);
      setEndTime("10:00");
      setIsAllDay(false);
      setAttendeesStr("");
    }
  }, [eventToEdit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    const attendees = attendeesStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const startDateTime = isAllDay
      ? `${startDate}T00:00:00Z`
      : new Date(`${startDate}T${startTime}:00`).toISOString();
    const endDateTime = isAllDay
      ? `${endDate}T23:59:59Z`
      : new Date(`${endDate}T${endTime}:00`).toISOString();

    if (eventToEdit) {
      const updatePayload: UpdateEventInput = {
        eventId: eventToEdit.id,
        summary: summary.trim(),
        startDateTime,
        endDateTime,
        isAllDay,
        attendees,
      };
      if (description.trim()) updatePayload.description = description.trim();
      if (location.trim()) updatePayload.location = location.trim();

      onSaveUpdate(updatePayload);
    } else {
      const createPayload: CreateEventInput = {
        summary: summary.trim(),
        startDateTime,
        endDateTime,
        isAllDay,
        attendees,
      };
      if (description.trim()) createPayload.description = description.trim();
      if (location.trim()) createPayload.location = location.trim();

      onSaveCreate(createPayload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{eventToEdit ? "Edit Calendar Event" : "Schedule New Event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="summary">Event Title *</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Project Sync with Team"
              required
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isAllDay"
              checked={isAllDay}
              onCheckedChange={(c) => setIsAllDay(Boolean(c))}
            />
            <Label htmlFor="isAllDay" className="text-sm font-normal">
              All-day event
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            {!isAllDay ? (
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            {!isAllDay ? (
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="location">Location / Link</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Room 302 or Meet URL"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="attendees">Attendees (comma separated emails)</Label>
            <Input
              id="attendees"
              value={attendeesStr}
              onChange={(e) => setAttendeesStr(e.target.value)}
              placeholder="colleague@example.com, boss@example.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description / Agenda</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda or context..."
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !summary.trim()}>
              {isSubmitting ? "Saving..." : eventToEdit ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
