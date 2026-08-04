import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createThread, deleteThread, getThread, listThreads, sendDirectGmail } from "@/lib/assistant.functions";
import { AppShell } from "@/components/app-shell";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import jarvisMark from "@/assets/jarvis-mark.png";
import { EmailDraftApprovalCard } from "@/features/gmail/components/EmailDraftApprovalCard";
import { ContactCallCard } from "@/features/contacts/components/ContactCallCard";

const suggestions = [
  "What should I focus on today?",
  "Remind me to review the roadmap tomorrow at 9am",
  "Remember: Sara prefers async updates over calls",
];

function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return supabase.auth.getSession().then(async ({ data }) => {
    const headers = new Headers(init?.headers);
    if (data.session?.access_token) {
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    const response = await fetch(input, { ...init, headers });
    if (!response.ok) {
      const text = await response.text();
      let errorMsg = response.statusText;
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {
        errorMsg = text || response.statusText;
      }
      throw new Error(`[${response.status}] ${errorMsg}`);
    }
    return response;
  });
}

export default function ChatPage() {
  const params = useParams();
  const threadId = params["threadId"] ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => listThreads() });
  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getThread({ threadId }),
    enabled: Boolean(threadId),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    const rows = thread.data?.messages ?? [];
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      parts: JSON.parse(row.partsJson) as UIMessage["parts"],
    }));
  }, [thread.data]);

  if (thread.isLoading) {
    return (
      <AppShell>
        <div className="h-screen" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex h-screen">
        <div className="hidden w-[240px] shrink-0 flex-col border-r px-3 py-4 lg:flex">
          <Button
            size="sm"
            variant="secondary"
            className="justify-start gap-2"
            onClick={async () => {
              const created = await createThread();
              await queryClient.invalidateQueries({ queryKey: ["threads"] });
              navigate(`/chat/${created.id}`);
            }}
          >
            <Plus className="size-4" />
            New conversation
          </Button>
          <ul className="mt-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {(threads.data ?? []).map((item) => (
              <li key={item.id} className="group relative">
                <Link
                  to={`/chat/${item.id}`}
                  className={cn(
                    "block truncate rounded-md py-1.5 pr-8 pl-2.5 text-sm transition-colors",
                    item.id === threadId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {item.title}
                </Link>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  onClick={async () => {
                    await deleteThread({ threadId: item.id });
                    await queryClient.invalidateQueries({ queryKey: ["threads"] });
                    if (item.id === threadId) navigate("/chat");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <ChatWindow key={threadId} threadId={threadId} initialMessages={initialMessages} />
      </div>
    </AppShell>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [sentDraftIds, setSentDraftIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: authedFetch,
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error("Jarvis hit an error", { description: error.message }),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy, threadId]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  const handleEditDraft = (to: string, subject: string) => {
    setInput(`Please edit the draft for ${to} (Subject: "${subject}"). I want to change: `);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleApproveSend = async (to: string, subject: string, body: string, cardKey: string) => {
    try {
      setSendingDraftId(cardKey);
      await sendDirectGmail({ to, subject, body });
      toast.success(`Email sent successfully to ${to}`);
      setSentDraftIds((prev) => new Set(prev).add(cardKey));
    } catch (err) {
      toast.error("Failed to send email", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSendingDraftId(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <img src={jarvisMark} alt="Jarvis" className="size-10 rounded-lg" />
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">How can I help?</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Ask about your day, capture something to remember, or hand over a task.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => {
            const hasPhoneResults = message.parts.some((p) => {
              const t = p as any;
              const inv = t.toolInvocation || t;
              const tName = (inv.toolName || inv.name || t.toolName || t.name || t.type?.replace(/^tool-/, "") || "").toLowerCase();
              const isP =
                tName.includes("contacts") ||
                tName.includes("phone") ||
                tName.includes("contact");
              const output = inv.result?.data || inv.result || inv.output?.data || inv.output || t.output?.data || t.output;
              return isP && output;
            });

            return (
              <Message from={message.role} key={message.id}>
                <MessageContent
                  className={cn(
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent p-0",
                  )}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      if (message.role === "user") {
                        return (
                          <p key={index} className="text-sm whitespace-pre-wrap">
                            {part.text}
                          </p>
                        );
                      }

                      // Parse text to see if it contains contact details (e.g. Ritesh Amc – Phone Numbers or Mobile: 866-014-4040)
                      const text = part.text || "";
                      const lines = text.split("\n");
                      let parsedName = "";
                      const parsedPhones: Array<{ type: string; value: string }> = [];
                      const remainingLines: string[] = [];

                      for (const line of lines) {
                        // Strip emojis, markdown symbols, and bullets
                        const clean = line.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}[*#_•]/gu, "").trim();
                        if (!clean) continue;

                        const contactMatch = clean.match(/^contact:\s*(.+)$/i);
                        const titleNameMatch = clean.match(/^(.+?)\s*[–\-—]\s*(phone|contact|number)s?/i);
                        const phoneMatch = clean.match(/(mobile|work|home|phone|cell):\s*(.+)/i);
                        const numMatches = clean.match(/\+?\d{1,4}[-\s]?\d{3,5}[-\s]?\d{4,5}|\b\d{10}\b/g);

                        if (contactMatch) {
                          parsedName = contactMatch[1].trim();
                        } else if (titleNameMatch) {
                          parsedName = titleNameMatch[1].trim();
                        } else if (phoneMatch) {
                          const pType = phoneMatch[1].charAt(0).toUpperCase() + phoneMatch[1].slice(1).toLowerCase();
                          const pVal = phoneMatch[2].replace(/^call\s+/i, "").trim();
                          if (!parsedPhones.some((p) => p.value === pVal)) {
                            parsedPhones.push({ type: pType, value: pVal });
                          }
                        } else if (numMatches && (clean.toLowerCase().includes("call") || parsedName)) {
                          numMatches.forEach((num) => {
                            if (!parsedPhones.some((p) => p.value === num)) {
                              parsedPhones.push({ type: "Mobile", value: num });
                            }
                          });
                        } else {
                          remainingLines.push(line);
                        }
                      }

                      const hasContactInfo = Boolean(parsedName) || parsedPhones.length > 0;
                      const remainingText = remainingLines.join("\n").trim();

                      return (
                        <div key={index} className="space-y-2">
                          {remainingText ? <MessageResponse>{remainingText}</MessageResponse> : null}
                          {hasContactInfo ? (
                            <ContactCallCard
                              name={parsedName || "Contact"}
                              phones={parsedPhones}
                              phone={parsedPhones[0]?.value}
                            />
                          ) : null}
                        </div>
                      );
                    }

                    const isToolPart =
                      part.type === "tool-invocation" ||
                      part.type.startsWith("tool-") ||
                      part.type === "dynamic-tool" ||
                      Boolean((part as any).toolInvocation) ||
                      Boolean((part as any).toolName);

                    if (isToolPart) {
                      const t = part as any;
                      const inv = t.toolInvocation || t;
                      const tName = (
                        inv.toolName ||
                        inv.name ||
                        t.toolName ||
                        t.name ||
                        (typeof t.type === "string" ? t.type.replace(/^tool-/, "") : "")
                      ).toLowerCase();

                      const isDraftTool =
                        tName.includes("gmail_create_draft") ||
                        tName.includes("gmail_send");

                      const isPhoneTool =
                        tName.includes("contacts_phone") ||
                        tName.includes("get_contact_phone") ||
                        tName.includes("contacts_search") ||
                        tName.includes("search_contacts") ||
                        tName.includes("contacts_details") ||
                        tName.includes("get_contact_details") ||
                        tName.includes("contact");

                      const input = inv.args || inv.input || t.input || {};
                      const rawOutput = inv.result ?? inv.output ?? t.output ?? t.result;
                      const phoneOutputData = rawOutput?.data ?? rawOutput;

                      const draftTo = input.to || rawOutput?.to || "";
                      const draftSubject = input.subject || rawOutput?.subject || "";
                      const draftBody = input.body || rawOutput?.body || "";

                      const phoneResults: Array<{ name: string; phone?: string; phones?: Array<{ type: string; value: string }> }> = [];
                      if (Array.isArray(phoneOutputData)) {
                        phoneResults.push(...phoneOutputData.filter((r) => r && (r.name || r.phone || r.phones)));
                      } else if (phoneOutputData && (phoneOutputData.name || phoneOutputData.phone || phoneOutputData.phones)) {
                        phoneResults.push(phoneOutputData);
                      }

                      // Fallback: if phone tool was invoked, extract phone numbers directly to guarantee card display
                      if (isPhoneTool && phoneResults.length === 0) {
                        const targetName = input.name || "Contact";
                        const matches = (message.parts.map((p: any) => p.text).join(" ") || "").match(/\b\d{5}[-\s]?\d{5}\b|\b\d{10}\b/g);
                        if (matches && matches.length > 0) {
                          phoneResults.push({
                            name: targetName,
                            phones: Array.from(new Set(matches)).map((val) => ({ type: "Mobile", value: val })),
                          });
                        }
                      }

                      return (
                        <div key={index} className="space-y-2">
                          {isDraftTool && draftTo ? (
                            <EmailDraftApprovalCard
                              to={draftTo}
                              subject={draftSubject}
                              body={draftBody}
                              onApproveSend={(newTo, newSubject, newBody) =>
                                handleApproveSend(newTo, newSubject, newBody, `${message.id}-${index}`)
                              }
                              onEdit={() => handleEditDraft(draftTo, draftSubject)}
                              isSending={sendingDraftId === `${message.id}-${index}`}
                              isSent={sentDraftIds.has(`${message.id}-${index}`)}
                            />
                          ) : null}

                          {isPhoneTool && phoneResults.length > 0
                            ? phoneResults.map((res, pIdx) => (
                                <ContactCallCard
                                  key={pIdx}
                                  name={res.name || "Contact"}
                                  phone={res.phone}
                                  phones={res.phones}
                                />
                              ))
                            : null}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            );
          })}

          {status === "submitted" ? <Shimmer className="text-sm">Thinking…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask Jarvis anything…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() && !busy} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
