export interface GmailAttachmentHeader {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  labelIds: string[];
  bodyText?: string;
  bodyHtml?: string;
  attachments?: GmailAttachmentHeader[];
}

export interface GmailThread {
  id: string;
  historyId?: string;
  messages: GmailMessage[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesUnread?: number;
  threadsUnread?: number;
}

export interface CreateDraftInput {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export interface ReplyInput {
  threadId: string;
  messageId: string;
  to: string;
  subject: string;
  body: string;
}

export interface ListMessagesOptions {
  q?: string;
  labelIds?: string[];
  maxResults?: number;
  pageToken?: string;
}
