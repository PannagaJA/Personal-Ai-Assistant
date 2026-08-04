import { useState, useEffect } from "react";
import { Calendar, User, Building2, Save, X, Tag, FileText, AlertCircle } from "lucide-react";
import type { FollowUpItem, FollowUpPriority, FollowUpStatus } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FollowUpModalProps {
  followup: FollowUpItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    id?: string;
    title: string;
    personName?: string;
    organizationName?: string;
    category?: string;
    priority?: FollowUpPriority;
    status?: FollowUpStatus;
    followupDate?: string;
    notes?: string;
  }) => void;
}

export function FollowUpModal({ followup, open, onOpenChange, onSave }: FollowUpModalProps) {
  const [title, setTitle] = useState("");
  const [personName, setPersonName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<FollowUpPriority>("medium");
  const [status, setStatus] = useState<FollowUpStatus>("pending");
  const [followupDate, setFollowupDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (followup) {
      setTitle(followup.title || "");
      setPersonName(followup.personName || "");
      setOrganizationName(followup.organizationName || "");
      setCategory(followup.category || "General");
      setPriority(followup.priority || "medium");
      setStatus(followup.status || "pending");
      const dateStr = followup.followupDate ? followup.followupDate.split("T")[0] : "";
      setFollowupDate(dateStr || "");
      setNotes(followup.notes || "");
    } else {
      setTitle("");
      setPersonName("");
      setOrganizationName("");
      setCategory("General");
      setPriority("medium");
      setStatus("pending");
      setFollowupDate("");
      setNotes("");
    }
  }, [followup, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    const payload: any = {
      title: title.trim(),
      category,
      priority,
      status,
    };
    if (followup?.id) payload.id = followup.id;
    if (personName.trim()) payload.personName = personName.trim();
    if (organizationName.trim()) payload.organizationName = organizationName.trim();
    if (followupDate) payload.followupDate = new Date(followupDate).toISOString();
    if (notes.trim()) payload.notes = notes.trim();

    onSave(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0 sm:max-w-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-card">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            <DialogTitle className="text-lg font-bold">
              {followup ? "Edit Follow-Up" : "Create New Follow-Up"}
            </DialogTitle>
          </div>

          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="size-3.5" />
            Save Follow-Up
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title / Promise *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up on ERP Quotation with Smart Path"
              className="mt-1 font-semibold text-base"
            />
          </div>

          {/* Person & Organization */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <User className="size-3.5 text-primary" /> Person Name
              </label>
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g. Ritesh AMC, Principal"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3.5 text-primary" /> Company / Organization
              </label>
              <Input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Smart Path, AMC"
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {/* Category, Priority & Status Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
              >
                <option value="General">General</option>
                <option value="Email">Email</option>
                <option value="Call">Call</option>
                <option value="Proposal">Proposal</option>
                <option value="Meeting">Meeting</option>
                <option value="Check-in">Check-in</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FollowUpPriority)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="snoozed">Snoozed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Followup Date */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Scheduled Follow-Up Date</label>
            <Input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className="mt-1 text-sm max-w-xs"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Context & Next Actions</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was promised? What are the key details or discussion points?"
              className="mt-1 min-h-[100px] text-sm p-3"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
