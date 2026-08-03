import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Search,
  Plus,
  Inbox,
  Sparkles,
  Star,
  Send,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useGmailMessages,
  useGmailThread,
  useGmailMutations,
} from "@/features/gmail/hooks/use-gmail";
import { EmailCard } from "@/features/gmail/components/EmailCard";
import { EmailThreadView } from "@/features/gmail/components/EmailThreadView";
import { EmailComposeDialog } from "@/features/gmail/components/EmailComposeDialog";
import type { GmailMessage, CreateDraftInput, ReplyInput } from "@/features/gmail/types";

type GmailCategoryTab = "inbox" | "unread" | "important" | "starred" | "sent" | "drafts";

export default function GmailPage() {
  const [activeTab, setActiveTab] = useState<GmailCategoryTab>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // Compute label filters based on active category tab
  const labelIds =
    activeTab === "inbox"
      ? ["INBOX"]
      : activeTab === "unread"
      ? ["UNREAD", "INBOX"]
      : activeTab === "important"
      ? ["IMPORTANT"]
      : activeTab === "starred"
      ? ["STARRED"]
      : activeTab === "sent"
      ? ["SENT"]
      : activeTab === "drafts"
      ? ["DRAFT"]
      : ["INBOX"];

  const { data, isLoading, isError, error } = useGmailMessages({
    q: searchQuery,
    labelIds,
    maxResults: 25,
  });

  const messages = data?.messages ?? [];

  const { data: threadData } = useGmailThread(selectedMessage?.threadId ?? null);
  const { markRead, markUnread, archive, createDraft, sendReply } = useGmailMutations();

  const handleSelectMessage = (msg: GmailMessage) => {
    setSelectedMessage(msg);
    if (msg.isUnread) {
      markRead.mutate(msg.id);
    }
  };

  const handleSaveDraft = (input: CreateDraftInput) => {
    createDraft.mutate(input);
  };

  const handleSendReply = (input: ReplyInput) => {
    sendReply.mutate(input);
  };

  const tabs: Array<{ id: GmailCategoryTab; label: string; icon: any }> = [
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "unread", label: "Unread", icon: Mail },
    { id: "important", label: "Important", icon: AlertCircle },
    { id: "starred", label: "Starred", icon: Star },
    { id: "sent", label: "Sent", icon: Send },
    { id: "drafts", label: "Drafts", icon: FileText },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-5"
        >
          <div>
            <div className="flex items-center gap-2">
              <Mail className="size-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Google Gmail</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Synced directly with your Google Account
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails…"
                className="pl-9 text-xs"
              />
            </div>

            <Button onClick={() => setComposeOpen(true)} className="gap-1.5 text-xs font-semibold">
              <Plus className="size-4" />
              Compose Draft
            </Button>
          </div>
        </motion.header>

        {/* Category Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedMessage(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Content Area: Split View when message is selected */}
        <div className="mt-6">
          {selectedMessage && threadData ? (
            <div className="h-[600px]">
              <EmailThreadView
                thread={threadData}
                onBack={() => setSelectedMessage(null)}
                onSendReply={handleSendReply}
                onArchiveMessage={(id) => {
                  archive.mutate(id);
                  setSelectedMessage(null);
                }}
                isSending={sendReply.isPending}
              />
            </div>
          ) : isLoading ? (
            <div className="glass-panel flex h-64 items-center justify-center rounded-xl p-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                Syncing Gmail mailbox…
              </div>
            </div>
          ) : isError ? (
            <div className="glass-panel rounded-xl p-6 text-center">
              <p className="text-sm text-destructive font-semibold">Gmail Sync Error</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Failed to load emails."}
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="glass-panel rounded-xl p-12 text-center text-muted-foreground">
              <Mail className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No messages found in this category.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Your mailbox is clear or search returned no matching emails.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {messages.map((msg) => (
                <EmailCard
                  key={msg.id}
                  message={msg}
                  onSelect={handleSelectMessage}
                  onMarkRead={(id) => markRead.mutate(id)}
                  onMarkUnread={(id) => markUnread.mutate(id)}
                  onArchive={(id) => archive.mutate(id)}
                  onReply={(m) => handleSelectMessage(m)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Compose Email Modal */}
        <EmailComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onSaveDraft={handleSaveDraft}
          isSubmitting={createDraft.isPending}
        />
      </div>
    </AppShell>
  );
}
