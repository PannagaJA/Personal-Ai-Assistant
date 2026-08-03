import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleAuthService } from "@/services/google-auth.server";
import { logger } from "@/services/logger";
import type {
  GmailMessage,
  GmailThread,
  GmailLabel,
  CreateDraftInput,
  ReplyInput,
  ListMessagesOptions,
} from "./types";
import {
  extractHeader,
  parseMessagePayload,
  encodeBase64Url,
} from "./utils";

export class GmailService {
  private static async fetchGmailApi(
    supabase: SupabaseClient,
    userId: string,
    endpoint: string,
    options: RequestInit = {},
  ) {
    const startTime = Date.now();
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      logger.error("system", "Gmail access token missing or expired", {}, userId);
      throw new Error("Gmail access token is missing or expired. Please re-authenticate with Google.");
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${endpoint}`, {
        ...options,
        headers,
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `Gmail API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId,
        );
        throw new Error(`Gmail API Error (${response.status}): ${errorText}`);
      }

      logger.info(
        "provider",
        `Gmail API request success: ${endpoint}`,
        { durationMs, status: response.status },
        userId,
      );

      return response.status === 204 ? null : response.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Gmail API request timed out.");
      }
      throw err;
    }
  }

  static async listMessages(
    supabase: SupabaseClient,
    userId: string,
    options: ListMessagesOptions = {},
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    try {
      const params = new URLSearchParams();
      if (options.q) params.append("q", options.q);
      if (options.maxResults) params.append("maxResults", String(options.maxResults));
      else params.append("maxResults", "20");
      if (options.pageToken) params.append("pageToken", options.pageToken);

      if (options.labelIds && options.labelIds.length > 0) {
        options.labelIds.forEach((id) => params.append("labelIds", id));
      }

      const data = await this.fetchGmailApi(supabase, userId, `/messages?${params}`);
      const rawList: any[] = data?.messages ?? [];
      const nextPageToken = data?.nextPageToken ?? undefined;

      // Fetch metadata headers for each message in parallel
      const messages = await Promise.all(
        rawList.map((item) => this.getMessage(supabase, userId, item.id, false))
      );

      return { messages, nextPageToken };
    } catch (err) {
      logger.error("provider", "Failed to list Gmail messages", { error: String(err) }, userId);
      throw err;
    }
  }

  static async getMessage(
    supabase: SupabaseClient,
    userId: string,
    messageId: string,
    fullBody: boolean = true,
  ): Promise<GmailMessage> {
    try {
      const format = fullBody ? "full" : "metadata";
      const item = await this.fetchGmailApi(
        supabase,
        userId,
        `/messages/${messageId}?format=${format}`
      );

      const headers = item.payload?.headers ?? [];
      const labelIds: string[] = item.labelIds ?? [];
      const { bodyText, bodyHtml, attachments } = parseMessagePayload(item);

      return {
        id: item.id!,
        threadId: item.threadId!,
        snippet: item.snippet ?? "",
        subject: extractHeader(headers, "Subject") || "(No Subject)",
        from: extractHeader(headers, "From") || "Unknown Sender",
        to: extractHeader(headers, "To") || "",
        date: extractHeader(headers, "Date") || new Date().toISOString(),
        isUnread: labelIds.includes("UNREAD"),
        isImportant: labelIds.includes("IMPORTANT"),
        isStarred: labelIds.includes("STARRED"),
        labelIds,
        ...(fullBody ? { bodyText, bodyHtml, attachments } : {}),
      };
    } catch (err) {
      logger.error("provider", `Failed to get Gmail message ${messageId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async getThread(
    supabase: SupabaseClient,
    userId: string,
    threadId: string,
  ): Promise<GmailThread> {
    try {
      const item = await this.fetchGmailApi(supabase, userId, `/threads/${threadId}?format=full`);
      const messages: GmailMessage[] = (item.messages ?? []).map((msg: any) => {
        const headers = msg.payload?.headers ?? [];
        const labelIds: string[] = msg.labelIds ?? [];
        const { bodyText, bodyHtml, attachments } = parseMessagePayload(msg);

        return {
          id: msg.id!,
          threadId: msg.threadId!,
          snippet: msg.snippet ?? "",
          subject: extractHeader(headers, "Subject") || "(No Subject)",
          from: extractHeader(headers, "From") || "Unknown Sender",
          to: extractHeader(headers, "To") || "",
          date: extractHeader(headers, "Date") || new Date().toISOString(),
          isUnread: labelIds.includes("UNREAD"),
          isImportant: labelIds.includes("IMPORTANT"),
          isStarred: labelIds.includes("STARRED"),
          labelIds,
          bodyText,
          bodyHtml,
          attachments,
        };
      });

      return {
        id: item.id!,
        historyId: item.historyId,
        messages,
      };
    } catch (err) {
      logger.error("provider", `Failed to get Gmail thread ${threadId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async sendEmail(
    supabase: SupabaseClient,
    userId: string,
    input: { to: string; subject: string; body: string },
  ): Promise<GmailMessage> {
    try {
      const nowGmt = new Date().toUTCString();
      const rawMessage = [
        "MIME-Version: 1.0",
        `Date: ${nowGmt}`,
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        input.body,
      ].join("\r\n");

      const encodedMessage = encodeBase64Url(rawMessage);

      const res = await this.fetchGmailApi(supabase, userId, "/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw: encodedMessage }),
      });

      logger.info("tool_call", `Sent direct Gmail to ${input.to}`, { messageId: res.id }, userId);
      return this.getMessage(supabase, userId, res.id, true);
    } catch (err) {
      logger.error("provider", "Failed to send direct Gmail", { error: String(err) }, userId);
      throw err;
    }
  }

  static async createDraft(
    supabase: SupabaseClient,
    userId: string,
    draftInput: CreateDraftInput,
  ): Promise<{ id: string; threadId: string }> {
    try {
      const nowGmt = new Date().toUTCString();
      const rawMessage = [
        "MIME-Version: 1.0",
        `Date: ${nowGmt}`,
        `To: ${draftInput.to}`,
        `Subject: ${draftInput.subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        draftInput.body,
      ].join("\r\n");

      const encodedMessage = encodeBase64Url(rawMessage);
      const payload: any = { message: { raw: encodedMessage } };
      if (draftInput.threadId) {
        payload.message.threadId = draftInput.threadId;
      }

      const res = await this.fetchGmailApi(supabase, userId, "/drafts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      logger.info("tool_call", `Created Gmail draft for ${draftInput.to}`, { draftId: res.id }, userId);
      return { id: res.id, threadId: res.message?.threadId ?? "" };
    } catch (err) {
      logger.error("provider", "Failed to create Gmail draft", { error: String(err) }, userId);
      throw err;
    }
  }

  static async sendReply(
    supabase: SupabaseClient,
    userId: string,
    replyInput: ReplyInput,
  ): Promise<GmailMessage> {
    try {
      const nowGmt = new Date().toUTCString();
      const cleanSubject = replyInput.subject.replace(/^Re:\s*/i, "");
      const rawMessage = [
        "MIME-Version: 1.0",
        `Date: ${nowGmt}`,
        `To: ${replyInput.to}`,
        `Subject: Re: ${cleanSubject}`,
        `In-Reply-To: ${replyInput.messageId}`,
        `References: ${replyInput.messageId}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        replyInput.body,
      ].join("\r\n");

      const encodedMessage = encodeBase64Url(rawMessage);

      const res = await this.fetchGmailApi(supabase, userId, "/messages/send", {
        method: "POST",
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: replyInput.threadId,
        }),
      });

      logger.info("tool_call", `Sent Gmail reply to ${replyInput.to}`, { messageId: res.id }, userId);
      return this.getMessage(supabase, userId, res.id, true);
    } catch (err) {
      logger.error("provider", "Failed to send Gmail reply", { error: String(err) }, userId);
      throw err;
    }
  }

  static async modifyLabels(
    supabase: SupabaseClient,
    userId: string,
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = [],
  ): Promise<boolean> {
    try {
      await this.fetchGmailApi(supabase, userId, `/messages/${messageId}/modify`, {
        method: "POST",
        body: JSON.stringify({ addLabelIds, removeLabelIds }),
      });
      logger.info("tool_call", `Modified Gmail labels on ${messageId}`, { addLabelIds, removeLabelIds }, userId);
      return true;
    } catch (err) {
      logger.error("provider", `Failed to modify Gmail labels on ${messageId}`, { error: String(err) }, userId);
      throw err;
    }
  }

  static async listLabels(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<GmailLabel[]> {
    try {
      const data = await this.fetchGmailApi(supabase, userId, "/labels");
      return (data?.labels ?? []).map((lbl: any) => ({
        id: lbl.id,
        name: lbl.name,
        type: lbl.type,
        messagesUnread: lbl.messagesUnread ?? 0,
        threadsUnread: lbl.threadsUnread ?? 0,
      }));
    } catch (err) {
      logger.error("provider", "Failed to list Gmail labels", { error: String(err) }, userId);
      throw err;
    }
  }
}
