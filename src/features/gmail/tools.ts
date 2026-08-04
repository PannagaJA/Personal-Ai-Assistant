import { z } from "zod";
import type { AITool } from "../ai/tools/registry.js";
import { GmailService } from "./services.server";
import { extractSenderName } from "./utils";

export const listUnreadGmailTool: AITool = {
  id: "gmail_list_unread",
  name: "List Unread Emails",
  description: "Retrieve recent unread emails from the user's Gmail inbox.",
  parameters: z.object({
    maxResults: z.number().default(10).describe("Maximum number of unread emails to fetch"),
  }),
  execute: async ({ maxResults }, { supabase, userId }) => {
    try {
      const result = await GmailService.listMessages(supabase, userId, {
        labelIds: ["UNREAD", "INBOX"],
        maxResults,
      });

      const summaryList = result.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        subject: m.subject,
        sender: extractSenderName(m.from),
        snippet: m.snippet,
        date: m.date,
        isImportant: m.isImportant,
      }));

      return {
        success: true,
        data: {
          count: summaryList.length,
          unreadEmails: summaryList,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const searchGmailTool: AITool = {
  id: "gmail_search",
  name: "Search Gmail Messages",
  description: "Search emails by sender, subject, date range, or keyword query.",
  parameters: z.object({
    query: z.string().describe("Search query (e.g. 'from:Smart Path', 'subject:proposal', 'invoice')"),
    maxResults: z.number().default(10).describe("Maximum results to return"),
  }),
  execute: async ({ query, maxResults }, { supabase, userId }) => {
    try {
      const result = await GmailService.listMessages(supabase, userId, {
        q: query,
        maxResults,
      });

      const summaryList = result.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        subject: m.subject,
        sender: extractSenderName(m.from),
        snippet: m.snippet,
        date: m.date,
        isUnread: m.isUnread,
      }));

      return {
        success: true,
        data: {
          count: summaryList.length,
          messages: summaryList,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const readGmailMessageTool: AITool = {
  id: "gmail_read",
  name: "Read Gmail Message",
  description: "Retrieve full body text, headers, and attachments metadata for a specific email message ID.",
  parameters: z.object({
    messageId: z.string().describe("Gmail message ID to read"),
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      const msg = await GmailService.getMessage(supabase, userId, messageId, true);
      return { success: true, data: { message: msg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const summarizeInboxGmailTool: AITool = {
  id: "gmail_summary",
  name: "Summarize Unread Inbox",
  description: "Retrieve an executive overview of unread and high-priority emails requiring attention.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const [unreadRes, importantRes] = await Promise.all([
        GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 8 }),
        GmailService.listMessages(supabase, userId, { labelIds: ["IMPORTANT", "INBOX"], maxResults: 5 }),
      ]);

      const unreadList = unreadRes.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: extractSenderName(m.from),
        snippet: m.snippet,
      }));

      const importantList = importantRes.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: extractSenderName(m.from),
        snippet: m.snippet,
      }));

      return {
        success: true,
        data: {
          unreadCount: unreadList.length,
          importantCount: importantList.length,
          unread: unreadList,
          important: importantList,
        },
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const sendGmailTool: AITool = {
  id: "gmail_send",
  name: "Send Direct Email",
  description: "Send an email after user confirmation. If user has not confirmed yet, set userConfirmed to false to create a draft preview.",
  parameters: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Subject line"),
    body: z.string().describe("Email body content"),
    userConfirmed: z.boolean().default(false).describe("Set to true ONLY if the user explicitly clicked Approve or confirmed sending in chat."),
  }),
  execute: async (params, { supabase, userId }) => {
    if (!params.userConfirmed) {
      // Auto-create draft so the user sees a draft card in chat
      try {
        const draft = await GmailService.createDraft(supabase, userId, {
          to: params.to,
          subject: params.subject,
          body: params.body,
        });
        return {
          success: true,
          action: "draft_created",
          draftId: draft.id,
          to: params.to,
          subject: params.subject,
          body: params.body,
          message: `Saved email draft for ${params.to}. Please approve or edit using the card below.`,
        };
      } catch (err) {
        return {
          success: true,
          action: "draft_preview",
          to: params.to,
          subject: params.subject,
          body: params.body,
          message: `Draft preview ready for ${params.to}. Please approve to send.`,
        };
      }
    }

    try {
      const sentMsg = await GmailService.sendEmail(supabase, userId, params);
      return { success: true, action: "sent", message: `Successfully sent email to ${params.to}`, data: { message: sentMsg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const replyGmailTool: AITool = {
  id: "gmail_reply",
  name: "Reply to Email",
  description: "Send or draft an email response to an existing thread.",
  parameters: z.object({
    threadId: z.string().describe("Thread ID of the email conversation"),
    messageId: z.string().describe("Original message ID being replied to"),
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Subject line"),
    body: z.string().describe("Body content of the reply"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const sentMsg = await GmailService.sendReply(supabase, userId, params);
      return { success: true, message: `Sent reply to ${params.to}`, data: { message: sentMsg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const createDraftGmailTool: AITool = {
  id: "gmail_create_draft",
  name: "Create Email Draft",
  description: "Create a new draft email in Gmail without sending it immediately.",
  parameters: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Subject line"),
    body: z.string().describe("Draft email body text"),
    threadId: z.string().optional().describe("Optional thread ID if drafting a reply"),
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const draft = await GmailService.createDraft(supabase, userId, params);
      return { success: true, message: `Draft saved for ${params.to}`, data: draft };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const archiveGmailTool: AITool = {
  id: "gmail_archive",
  name: "Archive Email",
  description: "Archive an email message (remove it from INBOX).",
  parameters: z.object({
    messageId: z.string().describe("Message ID to archive"),
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, [], ["INBOX"]);
      return { success: true, message: "Archived email message." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const markReadGmailTool: AITool = {
  id: "gmail_mark_read",
  name: "Mark Email as Read",
  description: "Mark an email message as read (remove UNREAD label).",
  parameters: z.object({
    messageId: z.string().describe("Message ID to mark as read"),
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, [], ["UNREAD"]);
      return { success: true, message: "Marked message as read." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const markUnreadGmailTool: AITool = {
  id: "gmail_mark_unread",
  name: "Mark Email as Unread",
  description: "Mark an email message as unread (add UNREAD label).",
  parameters: z.object({
    messageId: z.string().describe("Message ID to mark as unread"),
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, ["UNREAD"], []);
      return { success: true, message: "Marked message as unread." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const listLabelsGmailTool: AITool = {
  id: "gmail_labels",
  name: "List Gmail Labels",
  description: "List all user Gmail mailbox labels and unread message counts.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const labels = await GmailService.listLabels(supabase, userId);
      return { success: true, data: { labels } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const getThreadGmailTool: AITool = {
  id: "gmail_thread",
  name: "Get Conversation Thread",
  description: "Retrieve all messages in a full Gmail conversation thread by thread ID.",
  parameters: z.object({
    threadId: z.string().describe("Thread ID to retrieve"),
  }),
  execute: async ({ threadId }, { supabase, userId }) => {
    try {
      const thread = await GmailService.getThread(supabase, userId, threadId);
      return { success: true, data: { thread } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
