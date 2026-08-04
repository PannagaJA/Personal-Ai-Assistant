import { useState, useEffect } from "react";
import { Eye, Edit3, Save, History, Tag, FileText, Sparkles, Pin, Clock, X } from "lucide-react";
import type { UserNote } from "../types";
import { useNoteVersions } from "../hooks/use-notes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { calculateWordCount, calculateReadingTime } from "../utils";

interface NoteEditorModalProps {
  note: UserNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: {
    id?: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }) => void;
}

export function NoteEditorModal({ note, open, onOpenChange, onSave }: NoteEditorModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showHistory, setShowHistory] = useState(false);

  const { data: versions } = useNoteVersions(note?.id || null);

  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setContent(note.content || "");
      setCategory(note.category || "General");
      setTags(note.tags || []);
    } else {
      setTitle("");
      setContent("");
      setCategory("General");
      setTags([]);
    }
  }, [note, open]);

  const wordCount = calculateWordCount(content);
  const readingTime = calculateReadingTime(wordCount);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...(note?.id ? { id: note.id } : {}),
      title: title.trim(),
      content,
      category,
      tags,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-card">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <DialogTitle className="text-lg font-bold">
              {note ? "Edit Knowledge Note" : "Create New Knowledge Note"}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={mode === "edit" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("edit")}
              className="gap-1 text-xs"
            >
              <Edit3 className="size-3.5" />
              Edit
            </Button>
            <Button
              variant={mode === "preview" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("preview")}
              className="gap-1 text-xs"
            >
              <Eye className="size-3.5" />
              Markdown Preview
            </Button>

            {note?.id ? (
              <Button
                variant={showHistory ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="gap-1 text-xs"
              >
                <History className="size-3.5" />
                History ({versions?.length || 0})
              </Button>
            ) : null}

            <Button size="sm" onClick={handleSave} className="gap-1.5 ml-2">
              <Save className="size-3.5" />
              Save Note
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {/* Title & Category Input Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. ERP Architecture & Database Decisions"
                  className="mt-1 font-semibold text-base"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="General">General</option>
                  <option value="Work">Work</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Meetings">Meetings</option>
                  <option value="Ideas">Ideas</option>
                  <option value="Personal">Personal</option>
                </select>
              </div>
            </div>

            {/* Tags Input */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Tags & Keywords</label>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag and press Enter..."
                    className="h-7 w-40 text-xs"
                  />
                  <Button variant="ghost" size="sm" onClick={handleAddTag} className="h-7 text-xs">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Editor or Markdown Preview */}
            {mode === "edit" ? (
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex justify-between">
                  <span>Markdown / Rich Content</span>
                  <span className="text-[11px] text-muted-foreground">
                    {wordCount} words · {readingTime} min read
                  </span>
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note in Markdown... Supports code blocks, lists, headers, quotes, and links."
                  className="min-h-[300px] flex-1 font-mono text-sm leading-relaxed p-4 bg-accent/20"
                />
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-6 min-h-[300px]">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                  {content || "*No content to preview*"}
                </div>
              </div>
            )}
          </div>

          {/* Version History Drawer */}
          {showHistory ? (
            <div className="w-64 border-l bg-accent/20 p-4 overflow-y-auto space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="size-3.5 text-primary" />
                Version History
              </h4>
              {!versions || versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No previous versions snapshot recorded.</p>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    onClick={() => {
                      setContent(ver.content);
                      setTitle(ver.title);
                    }}
                    className="rounded-md border bg-card p-2.5 text-xs transition hover:border-primary/50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Version {ver.version}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ver.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-[11px]">{ver.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
