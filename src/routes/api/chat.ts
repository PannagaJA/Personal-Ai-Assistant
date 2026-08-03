import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { getAIModel } from "@/lib/ai-provider.server";
import { getUserClientFromRequest } from "@/lib/supabase-request.server";
import { registry, type ToolExecutionContext } from "@/features/ai/tools/registry";
import { initializeToolRegistry } from "@/features/ai/tools";
import { buildAIContext } from "@/features/ai/context-builder";
import { systemPrompt } from "@/features/ai/prompts";
import { logger } from "@/services/logger";

initializeToolRegistry();

type ChatBody = { messages?: UIMessage[]; threadId?: string };

function messageText(message: UIMessage) {
  return (message.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

function sanitizeModelMessages(messages: any[]) {
  return messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      const sanitizedContent = msg.content.map((part: any) => {
        if ((part.type === "tool-call" || part.type === "tool-result") && part.toolName) {
          return {
            ...part,
            toolName: part.toolName.replace(/[^a-zA-Z0-9_-]/g, "_"),
          };
        }
        return part;
      });
      return { ...msg, content: sanitizedContent };
    }
    return msg;
  });
}

export async function handleChatPost(request: Request) {
  const auth = await getUserClientFromRequest(request);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { supabase, userId } = auth;

  const body = (await request.json()) as ChatBody;
  const messages = body.messages;
  const threadId = body.threadId;
  if (!Array.isArray(messages) || !threadId) {
    return new Response("messages and threadId are required", { status: 400 });
  }

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, title")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!thread) return new Response("Thread not found", { status: 404 });

  // Persist user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "user",
      parts: lastMessage.parts as unknown as never,
      text_content: messageText(lastMessage),
      client_message_id: lastMessage.id ?? null,
    });
    if (error) logger.error("database", "Failed to save user message", { error: error.message }, userId);

    if (thread.title === "New conversation") {
      const title = messageText(lastMessage).slice(0, 60) || "New conversation";
      await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    } else {
      await supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    }
  }

  let model;
  try {
    model = getAIModel();
  } catch (e) {
    const err = e instanceof Error ? e.message : "AI Provider error";
    logger.error("provider", "Failed to get AI model", { error: err }, userId);
    return new Response(err, { status: 500 });
  }

  const userQuery = lastMessage ? messageText(lastMessage) : "";
  const aiContext = await buildAIContext(supabase, userId, userQuery);

  const toolCtx: ToolExecutionContext = {
    supabase,
    userId,
    threadId,
  };

  const tools = registry.toVercelTools(toolCtx);
  const rawModelMessages = await convertToModelMessages(messages);
  const modelMessages = sanitizeModelMessages(rawModelMessages);

  try {
    logger.info("ai_request", "Starting streamText execution", { threadId }, userId);

    const result = streamText({
      model,
      maxOutputTokens: 2048,
      stopWhen: stepCountIs(12),
      tools,
      system: systemPrompt(aiContext),
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        if (!responseMessage) return;
        const { error } = await supabase.from("chat_messages").insert({
          thread_id: threadId,
          user_id: userId,
          role: "assistant",
          parts: responseMessage.parts as unknown as never,
          text_content: messageText(responseMessage),
          client_message_id: responseMessage.id ?? null,
        });
        if (error) logger.error("database", "Failed to save assistant message", { error: error.message }, userId);
      },
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error("provider", "AI stream execution error", { error: errorMsg }, userId);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: err?.statusCode || 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
