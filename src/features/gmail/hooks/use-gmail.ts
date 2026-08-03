import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchGmailMessages,
  fetchGmailMessage,
  fetchGmailThread,
  markGmailRead,
  markGmailUnread,
  archiveGmailMessage,
  createGmailDraft,
  sendGmailReply,
} from "@/lib/assistant.functions";
import type { CreateDraftInput, ReplyInput, ListMessagesOptions } from "../types";

export function useGmailMessages(options: ListMessagesOptions = {}) {
  return useQuery({
    queryKey: ["gmail-messages", options.q, options.labelIds, options.pageToken],
    queryFn: () => fetchGmailMessages(options),
    staleTime: 60 * 1000,
  });
}

export function useGmailMessage(messageId: string | null) {
  return useQuery({
    queryKey: ["gmail-message", messageId],
    queryFn: () => (messageId ? fetchGmailMessage(messageId) : null),
    enabled: Boolean(messageId),
  });
}

export function useGmailThread(threadId: string | null) {
  return useQuery({
    queryKey: ["gmail-thread", threadId],
    queryFn: () => (threadId ? fetchGmailThread(threadId) : null),
    enabled: Boolean(threadId),
  });
}

export function useGmailMutations() {
  const queryClient = useQueryClient();

  const invalidateGmail = () => {
    queryClient.invalidateQueries({ queryKey: ["gmail-messages"] });
    queryClient.invalidateQueries({ queryKey: ["gmail-thread"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const markReadMutation = useMutation({
    mutationFn: (messageId: string) => markGmailRead(messageId),
    onSuccess: () => {
      toast.success("Marked as read");
      invalidateGmail();
    },
    onError: (err: Error) => toast.error("Action failed", { description: err.message }),
  });

  const markUnreadMutation = useMutation({
    mutationFn: (messageId: string) => markGmailUnread(messageId),
    onSuccess: () => {
      toast.success("Marked as unread");
      invalidateGmail();
    },
    onError: (err: Error) => toast.error("Action failed", { description: err.message }),
  });

  const archiveMutation = useMutation({
    mutationFn: (messageId: string) => archiveGmailMessage(messageId),
    onSuccess: () => {
      toast.success("Archived email");
      invalidateGmail();
    },
    onError: (err: Error) => toast.error("Failed to archive email", { description: err.message }),
  });

  const createDraftMutation = useMutation({
    mutationFn: (input: CreateDraftInput) => createGmailDraft(input),
    onSuccess: () => {
      toast.success("Draft saved");
      invalidateGmail();
    },
    onError: (err: Error) => toast.error("Failed to save draft", { description: err.message }),
  });

  const sendReplyMutation = useMutation({
    mutationFn: (input: ReplyInput) => sendGmailReply(input),
    onSuccess: () => {
      toast.success("Reply sent");
      invalidateGmail();
    },
    onError: (err: Error) => toast.error("Failed to send reply", { description: err.message }),
  });

  return {
    markRead: markReadMutation,
    markUnread: markUnreadMutation,
    archive: archiveMutation,
    createDraft: createDraftMutation,
    sendReply: sendReplyMutation,
  };
}
