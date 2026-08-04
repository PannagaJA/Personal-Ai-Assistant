import { useState } from "react";
import {
  FileText,
  Plus,
  Search as SearchIcon,
  Pin,
  Archive,
  Grid,
  List as ListIcon,
  RefreshCw,
  Sparkles,
  Tag,
  Star,
  BookOpen,
} from "lucide-react";
import { useNotes } from "@/features/notes/hooks/use-notes";
import { NoteCard } from "@/features/notes/components/NoteCard";
import { NoteEditorModal } from "@/features/notes/components/NoteEditorModal";
import type { UserNote } from "@/features/notes/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "grid" | "list";
type CategoryFilter = "all" | "General" | "Work" | "Architecture" | "Meetings" | "Ideas" | "Personal" | "pinned" | "archived";

export default function NotesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [editingNote, setEditingNote] = useState<UserNote | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const noteOpts: any = {
    query: searchQuery,
    isArchived: activeCategory === "archived",
  };
  if (activeCategory === "pinned") noteOpts.isPinned = true;
  if (activeCategory !== "all" && activeCategory !== "pinned" && activeCategory !== "archived") {
    noteOpts.category = activeCategory;
  }

  const { notes, isLoading, refetch, saveNote, deleteNote, togglePin, toggleArchive } = useNotes(noteOpts);

  const categories = ["all", "General", "Work", "Architecture", "Meetings", "Ideas", "Personal", "pinned", "archived"] as const;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Personal Knowledge System</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your assistant's permanent brain: notes, architecture, ideas, and decisions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setEditingNote(null);
                setIsEditorOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              New Note
            </Button>
          </div>
        </div>

        {/* Search and Navigation Bar */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes by title, content, tags, entities..."
              className="pl-9 bg-accent/30"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <Grid className="size-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <ListIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(cat as CategoryFilter)}
              className="capitalize text-xs gap-1"
            >
              {cat === "pinned" && <Pin className="size-3 text-primary" />}
              {cat === "archived" && <Archive className="size-3 text-amber-400" />}
              {cat}
            </Button>
          ))}
        </div>

        {/* Notes Grid / List */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <BookOpen className="size-10 text-muted-foreground/50" />
              <h3 className="mt-3 text-base font-semibold">No notes found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery
                  ? `No knowledge notes match "${searchQuery}".`
                  : "Start adding notes, ideas, or tell Jarvis in chat."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingNote(null);
                  setIsEditorOpen(true);
                }}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-4" />
                Create Note
              </Button>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-3"
              }
            >
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={(n) => {
                    setEditingNote(n);
                    setIsEditorOpen(true);
                  }}
                  onTogglePin={(id, pin) => togglePin.mutate({ noteId: id, isPinned: pin })}
                  onToggleArchive={(id, arc) => toggleArchive.mutate({ noteId: id, isArchived: arc })}
                  onDelete={(id) => deleteNote.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      <NoteEditorModal
        note={editingNote}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={(payload) => saveNote.mutate(payload)}
      />
    </AppShell>
  );
}
