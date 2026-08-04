export interface AIEntities {
  people?: string[];
  companies?: string[];
  projects?: string[];
  meetings?: string[];
  tasks?: string[];
}

export interface NoteRelationship {
  type: "calendar" | "email" | "contact" | "task" | "project";
  refId: string;
  title: string;
}

export interface UserNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary?: string | null;
  category: string;
  tags: string[];
  entities: AIEntities;
  importance: number;
  isPinned: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  wordCount: number;
  readingTimeMin: number;
  relationships: NoteRelationship[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
}

export interface ListNotesOptions {
  category?: string;
  tag?: string;
  query?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  limit?: number;
}
