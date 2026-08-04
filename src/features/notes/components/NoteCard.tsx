import { Pin, Star, Archive, Clock, FileText, Tag, Trash2, Edit3 } from "lucide-react";
import type { UserNote } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NoteCardProps {
  note: UserNote;
  onEdit: (note: UserNote) => void;
  onTogglePin: (noteId: string, isPinned: boolean) => void;
  onToggleArchive: (noteId: string, isArchived: boolean) => void;
  onDelete: (noteId: string) => void;
}

export function NoteCard({
  note,
  onEdit,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: NoteCardProps) {
  const formattedDate = new Date(note.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      onClick={() => onEdit(note)}
      className={`group relative flex flex-col justify-between rounded-xl border bg-card/70 p-4 shadow-sm transition-all hover:bg-accent/40 hover:shadow-md cursor-pointer ${
        note.isPinned ? "border-primary/40 ring-1 ring-primary/20" : ""
      }`}
    >
      <div>
        {/* Header Title & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {note.isPinned && <Pin className="size-4 text-primary shrink-0 fill-primary/30" />}
            <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {note.title || "Untitled Note"}
            </h3>
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => onTogglePin(note.id, !note.isPinned)}
              title={note.isPinned ? "Unpin" : "Pin to top"}
            >
              <Pin className={`size-3.5 ${note.isPinned ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => onToggleArchive(note.id, !note.isArchived)}
              title={note.isArchived ? "Restore" : "Archive"}
            >
              <Archive className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Category Pill */}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-medium bg-accent/40">
            {note.category}
          </Badge>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            {note.readingTimeMin} min read ({note.wordCount} words)
          </span>
        </div>

        {/* Summary or Content Preview */}
        <p className="mt-3 line-clamp-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {note.summary || note.content}
        </p>

        {/* AI Entities / Tags */}
        {note.tags.length > 0 || (note.entities.companies && note.entities.companies.length > 0) ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
            {note.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-primary/90 bg-primary/10 px-2 py-0.5 rounded-md">
                #{tag}
              </span>
            ))}
            {note.entities.companies?.map((co) => (
              <span key={co} className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                🏢 {co}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer Meta */}
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground/80 border-t border-border/30 pt-2.5">
        <span>Updated {formattedDate}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition"
          title="Delete note"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
