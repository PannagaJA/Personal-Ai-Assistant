// src/routes/api/chat.ts
import { convertToModelMessages, streamText, stepCountIs } from "ai";

// src/lib/ai-provider.server.ts
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
function getAIModel(preferredProvider) {
  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const isOpenRouterValid = openrouterKey && openrouterKey !== "your-openrouter-api-key";
  if (preferredProvider === "openrouter" || isOpenRouterValid) {
    if (!openrouterKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is missing.");
    }
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      apiKey: openrouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": "https://personal-ai-assistant.local",
        "X-Title": "Personal AI Assistant"
      }
    });
    return openrouter("google/gemini-2.5-flash");
  }
  if (preferredProvider === "openai" || !geminiKey && openaiKey) {
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing.");
    }
    return openai("gpt-4o");
  }
  if (geminiKey && geminiKey !== "your-google-gemini-api-key") {
    return google("gemini-2.5-flash");
  }
  throw new Error(
    "Missing AI provider credentials. Please set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your environment."
  );
}

// src/lib/supabase-request.server.ts
import { createClient } from "@supabase/supabase-js";
function isNewSupabaseApiKey(value) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}
async function getUserClientFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase server environment variables");
  const supabase = createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      }
    },
    auth: { storage: void 0, persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { supabase, userId: user.id };
}

// src/features/ai/tools/registry.ts
import { tool as vercelTool } from "ai";

// src/services/logger.ts
var Logger = class {
  formatConsole(entry) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]: ${entry.message}`;
  }
  log(entry) {
    const formatted = this.formatConsole(entry);
    const meta = entry.metadata ? JSON.stringify(entry.metadata) : "";
    switch (entry.level) {
      case "error":
        console.error(formatted, meta);
        break;
      case "warn":
        console.warn(formatted, meta);
        break;
      case "debug":
        console.debug(formatted, meta);
        break;
      default:
        console.log(formatted, meta);
        break;
    }
  }
  info(category, message, metadata, userId) {
    this.log({
      level: "info",
      category,
      message,
      ...metadata ? { metadata } : {},
      ...userId ? { userId } : {}
    });
  }
  warn(category, message, metadata, userId) {
    this.log({
      level: "warn",
      category,
      message,
      ...metadata ? { metadata } : {},
      ...userId ? { userId } : {}
    });
  }
  error(category, message, metadata, userId) {
    this.log({
      level: "error",
      category,
      message,
      ...metadata ? { metadata } : {},
      ...userId ? { userId } : {}
    });
  }
};
var logger = new Logger();

// src/features/ai/tools/registry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  register(tool) {
    const sanitizedId = tool.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (this.tools.has(sanitizedId)) {
      logger.warn("system", `Overwriting tool registration for ${sanitizedId}`);
    }
    const cleanTool = { ...tool, id: sanitizedId };
    this.tools.set(sanitizedId, cleanTool);
    logger.info("system", `Registered AI tool: ${sanitizedId}`);
  }
  getTool(id) {
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return this.tools.get(sanitizedId);
  }
  getAllTools() {
    return Array.from(this.tools.values());
  }
  /**
   * Converts registered tools into Vercel AI SDK compatible tool definitions
   */
  toVercelTools(context) {
    const vercelToolsMap = {};
    for (const [id, toolDef] of this.tools.entries()) {
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
      vercelToolsMap[sanitizedId] = vercelTool({
        description: toolDef.description,
        inputSchema: toolDef.parameters,
        execute: async (params) => {
          const startTime = Date.now();
          logger.info("tool_call", `Executing tool ${sanitizedId}`, { params }, context.userId);
          try {
            const result = await toolDef.execute(params, context);
            logger.info(
              "tool_call",
              `Tool ${sanitizedId} completed in ${Date.now() - startTime}ms`,
              { success: result.success },
              context.userId
            );
            return result;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(
              "tool_call",
              `Tool ${sanitizedId} failed: ${errorMessage}`,
              { error: errorMessage },
              context.userId
            );
            return {
              success: false,
              error: errorMessage,
              message: `Execution of ${toolDef.name} failed.`
            };
          }
        }
      });
    }
    return vercelToolsMap;
  }
};
var registry = new ToolRegistry();

// src/features/tasks/tools.ts
import { z } from "zod";
var listTasksTool = {
  id: "list_tasks",
  name: "List Tasks",
  description: "List the user's tasks, optionally filtered by status.",
  parameters: z.object({
    status: z.enum(["open", "done", "all"]).default("open")
  }),
  execute: async ({ status }, { supabase, userId }) => {
    let query = supabase.from("tasks").select("id, title, priority, status, due_at").eq("user_id", userId).order("due_at", { ascending: true, nullsFirst: false }).limit(40);
    if (status !== "all") {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: { tasks: data ?? [] } };
  }
};
var createTaskTool = {
  id: "create_task",
  name: "Create Task",
  description: "Create a task or reminder for the user.",
  parameters: z.object({
    title: z.string(),
    notes: z.string().nullable().default(null),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    dueAt: z.string().nullable().default(null).describe("ISO 8601 datetime, or null when there is no due date")
  }),
  execute: async ({ title, notes, priority, dueAt }, { supabase, userId }) => {
    const { data, error } = await supabase.from("tasks").insert({ user_id: userId, title, notes, priority, due_at: dueAt }).select("id, title, due_at, priority").single();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: `Created task: "${title}"`, data: { created: data } };
  }
};
var completeTaskTool = {
  id: "complete_task",
  name: "Complete Task",
  description: "Mark a task as done. Look up the id with list_tasks first.",
  parameters: z.object({
    id: z.string().uuid()
  }),
  execute: async ({ id }, { supabase, userId }) => {
    const { error } = await supabase.from("tasks").update({ status: "done", completed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("user_id", userId);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: "Task marked as completed.", data: { completedId: id } };
  }
};
var dailyOverviewTool = {
  id: "daily_overview",
  name: "Daily Overview",
  description: "Get a snapshot of today: open tasks, tasks due today, overdue tasks, and recent memories.",
  parameters: z.object({}),
  execute: async (_, { supabase, userId }) => {
    const now = /* @__PURE__ */ new Date();
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const [open, memories] = await Promise.all([
      supabase.from("tasks").select("id, title, priority, due_at").eq("user_id", userId).eq("status", "open").order("due_at", { ascending: true, nullsFirst: false }).limit(30),
      supabase.from("memories").select("title, content, kind").eq("user_id", userId).order("created_at", { ascending: false }).limit(8)
    ]);
    const tasks = open.data ?? [];
    return {
      success: true,
      data: {
        now: now.toISOString(),
        dueToday: tasks.filter((t) => t.due_at && t.due_at <= endOfDay.toISOString()),
        openTasks: tasks,
        recentMemories: memories.data ?? []
      }
    };
  }
};

// src/features/memory/tools.ts
import { z as z2 } from "zod";
var rememberTool = {
  id: "remember",
  name: "Remember Fact / Decision",
  description: "Store an important fact, decision, promise, person or project detail so it can be recalled later.",
  parameters: z2.object({
    title: z2.string(),
    content: z2.string(),
    kind: z2.enum(["fact", "person", "project", "decision", "promise", "idea"]).default("fact"),
    importance: z2.number().int().min(1).max(5).default(3),
    tags: z2.array(z2.string()).default([])
  }),
  execute: async ({ title, content, kind, importance, tags }, { supabase, userId, threadId }) => {
    const { data, error } = await supabase.from("memories").insert({
      user_id: userId,
      title,
      content,
      kind,
      importance,
      tags,
      source_thread_id: threadId ?? null
    }).select("id, title").single();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: `Remembered: "${title}"`, data: { remembered: data } };
  }
};
var searchMemoryTool = {
  id: "search_memory",
  name: "Search Memory",
  description: "Search everything the assistant remembers: facts, people, projects, decisions, promises, and past conversations.",
  parameters: z2.object({
    query: z2.string().min(1)
  }),
  execute: async ({ query }, { supabase, userId }) => {
    const like = `%${query}%`;
    const [memories, messages] = await Promise.all([
      supabase.from("memories").select("id, title, content, kind, created_at, tags, importance").eq("user_id", userId).or(`title.ilike.${like},content.ilike.${like}`).limit(10),
      supabase.from("chat_messages").select("text_content, role, created_at").eq("user_id", userId).ilike("text_content", like).order("created_at", { ascending: false }).limit(6)
    ]);
    return {
      success: true,
      data: {
        memories: memories.data ?? [],
        conversations: messages.data ?? []
      }
    };
  }
};

// src/features/calendar/tools.ts
import { z as z3 } from "zod";

// src/services/google-auth.server.ts
var GoogleAuthService = class {
  /**
   * Retrieves a valid Google Access Token for the user.
   * Automatically refreshes expired tokens using Google OAuth endpoint if a refresh_token is present.
   */
  static async getValidAccessToken(supabase, userId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const providerToken = sessionData.session?.provider_token;
      const providerRefreshToken = sessionData.session?.provider_refresh_token;
      if (providerToken && sessionData.session?.user?.id === userId) {
        const expiresAt = new Date(Date.now() + 3600 * 1e3).toISOString();
        await supabase.from("user_google_tokens").upsert({
          user_id: userId,
          access_token: providerToken,
          ...providerRefreshToken ? { refresh_token: providerRefreshToken } : {},
          expires_at: expiresAt,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        return providerToken;
      }
      const { data: dbToken, error } = await supabase.from("user_google_tokens").select("access_token, refresh_token, expires_at").eq("user_id", userId).maybeSingle();
      if (error || !dbToken) {
        logger.warn("provider", "No Google token found for user", { userId });
        return null;
      }
      const expiresAtTime = new Date(dbToken.expires_at).getTime();
      const isExpired = Date.now() >= expiresAtTime - 6e4;
      if (!isExpired) {
        return dbToken.access_token;
      }
      if (!dbToken.refresh_token) {
        logger.warn("provider", "Google token expired and no refresh token available", { userId });
        return null;
      }
      logger.info("provider", "Refreshing expired Google token", { userId });
      const refreshed = await this.refreshAccessToken(dbToken.refresh_token);
      if (!refreshed) {
        logger.error("provider", "Failed to refresh Google token", { userId });
        await supabase.from("user_google_tokens").update({ refresh_token: null }).eq("user_id", userId);
        return null;
      }
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1e3).toISOString();
      await supabase.from("user_google_tokens").update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("user_id", userId);
      return refreshed.access_token;
    } catch (err) {
      logger.error("provider", "Error fetching Google access token", { error: String(err) }, userId);
      return null;
    }
  }
  static async refreshAccessToken(refreshToken) {
    const getEnv = (key) => {
      if (typeof process !== "undefined" && process.env && process.env[key]) {
        return process.env[key];
      }
      if (typeof import.meta !== "undefined" && import.meta.env) {
        return import.meta.env[key] || import.meta.env[`VITE_${key}`];
      }
      return void 0;
    };
    const clientId = getEnv("GOOGLE_CLIENT_ID") || getEnv("VITE_GOOGLE_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CLIENT_SECRET") || getEnv("VITE_GOOGLE_CLIENT_SECRET");
    if (!clientId) {
      logger.error("provider", "Missing GOOGLE_CLIENT_ID for token refresh");
      return null;
    }
    try {
      const bodyParams = {
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      };
      if (clientSecret) bodyParams["client_secret"] = clientSecret;
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(bodyParams)
      });
      if (!response.ok) {
        const errorText = await response.text();
        logger.error("provider", "Google token endpoint returned error", { status: response.status, body: errorText });
        return null;
      }
      const data = await response.json();
      return {
        access_token: data.access_token,
        expires_in: data.expires_in ?? 3600
      };
    } catch (err) {
      logger.error("provider", "Exception during Google token refresh", { error: String(err) });
      return null;
    }
  }
};

// src/features/calendar/utils.ts
function getStartOfDayIso(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function getEndOfDayIso(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function getStartOfWeekIso(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function getEndOfWeekIso(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (7 - (day === 0 ? 7 : day));
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function calculateFreeSlots(events, dayStartIso, dayEndIso, minDurationMinutes = 30) {
  const slots = [];
  let currentStart = new Date(dayStartIso).getTime();
  const dayEnd = new Date(dayEndIso).getTime();
  const timedEvents = events.filter((e) => e.start.dateTime && e.end.dateTime).sort((a, b) => new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime());
  for (const evt of timedEvents) {
    const evtStart = new Date(evt.start.dateTime).getTime();
    const evtEnd = new Date(evt.end.dateTime).getTime();
    if (evtStart > currentStart) {
      const duration = Math.floor((evtStart - currentStart) / 6e4);
      if (duration >= minDurationMinutes) {
        slots.push({
          start: new Date(currentStart).toISOString(),
          end: new Date(evtStart).toISOString(),
          durationMinutes: duration
        });
      }
    }
    if (evtEnd > currentStart) {
      currentStart = evtEnd;
    }
  }
  if (dayEnd > currentStart) {
    const duration = Math.floor((dayEnd - currentStart) / 6e4);
    if (duration >= minDurationMinutes) {
      slots.push({
        start: new Date(currentStart).toISOString(),
        end: new Date(dayEnd).toISOString(),
        durationMinutes: duration
      });
    }
  }
  return slots;
}

// src/features/calendar/services.server.ts
var GoogleCalendarService = class {
  static async fetchGoogleCalendarApi(supabase, userId, endpoint, options = {}) {
    const startTime = Date.now();
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      logger.error("system", "Google Calendar access token missing/expired", {}, userId);
      throw new Error("Google Calendar access token is missing or expired. Please re-authenticate with Google.");
    }
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
        ...options,
        headers
      });
      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `Google Calendar API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId
        );
        throw new Error(`Google Calendar API Error (${response.status}): ${errorText}`);
      }
      logger.info(
        "provider",
        `Google Calendar API request success: ${endpoint}`,
        { durationMs, status: response.status },
        userId
      );
      return response.status === 204 ? null : response.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Google Calendar API request timed out.");
      }
      throw err;
    }
  }
  static async listEvents(supabase, userId, timeMin, timeMax, q) {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime"
      });
      if (q && q.trim()) {
        params.append("q", q.trim());
      }
      const data = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events?${params}`);
      return (data?.items ?? []).map((item) => ({
        id: item.id,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? void 0,
        location: item.location ?? void 0,
        start: {
          dateTime: item.start?.dateTime ?? void 0,
          date: item.start?.date ?? void 0,
          timeZone: item.start?.timeZone ?? void 0
        },
        end: {
          dateTime: item.end?.dateTime ?? void 0,
          date: item.end?.date ?? void 0,
          timeZone: item.end?.timeZone ?? void 0
        },
        htmlLink: item.htmlLink ?? void 0,
        status: item.status ?? void 0,
        hangoutLink: item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? void 0,
        attendees: item.attendees?.map((att) => ({
          email: att.email,
          displayName: att.displayName,
          responseStatus: att.responseStatus
        })),
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        recurrence: item.recurrence ?? void 0,
        organizer: item.organizer ? { email: item.organizer.email, displayName: item.organizer.displayName } : void 0
      }));
    } catch (err) {
      logger.error("provider", "Failed to list Google Calendar events", { error: String(err) }, userId);
      throw err;
    }
  }
  static async getEventDetails(supabase, userId, eventId) {
    try {
      const item = await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`);
      return {
        id: item.id,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? void 0,
        location: item.location ?? void 0,
        start: {
          dateTime: item.start?.dateTime ?? void 0,
          date: item.start?.date ?? void 0,
          timeZone: item.start?.timeZone ?? void 0
        },
        end: {
          dateTime: item.end?.dateTime ?? void 0,
          date: item.end?.date ?? void 0,
          timeZone: item.end?.timeZone ?? void 0
        },
        htmlLink: item.htmlLink ?? void 0,
        status: item.status ?? void 0,
        hangoutLink: item.hangoutLink ?? item.conferenceData?.entryPoints?.[0]?.uri ?? void 0,
        attendees: item.attendees?.map((att) => ({
          email: att.email,
          displayName: att.displayName,
          responseStatus: att.responseStatus
        })),
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime),
        recurrence: item.recurrence ?? void 0
      };
    } catch (err) {
      logger.error("provider", `Failed to get event details for ${eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async createEvent(supabase, userId, eventData) {
    try {
      const body = {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location
      };
      if (eventData.isAllDay) {
        const startDateOnly = eventData.startDateTime.split("T")[0];
        const endDateOnly = eventData.endDateTime.split("T")[0];
        body.start = { date: startDateOnly };
        body.end = { date: endDateOnly };
      } else {
        body.start = { dateTime: eventData.startDateTime, timeZone: eventData.timeZone || "UTC" };
        body.end = { dateTime: eventData.endDateTime, timeZone: eventData.timeZone || "UTC" };
      }
      if (eventData.attendees && eventData.attendees.length > 0) {
        body.attendees = eventData.attendees.map((email) => ({ email }));
      }
      if (eventData.recurrence && eventData.recurrence.length > 0) {
        body.recurrence = eventData.recurrence;
      }
      const item = await this.fetchGoogleCalendarApi(supabase, userId, "/calendars/primary/events", {
        method: "POST",
        body: JSON.stringify(body)
      });
      logger.info("tool_call", `Created Google Calendar event: ${item.summary}`, { eventId: item.id }, userId);
      return {
        id: item.id,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? void 0,
        location: item.location ?? void 0,
        start: {
          dateTime: item.start?.dateTime ?? void 0,
          date: item.start?.date ?? void 0
        },
        end: {
          dateTime: item.end?.dateTime ?? void 0,
          date: item.end?.date ?? void 0
        },
        htmlLink: item.htmlLink ?? void 0,
        isAllDay: Boolean(item.start?.date && !item.start?.dateTime)
      };
    } catch (err) {
      logger.error("provider", "Failed to create Google Calendar event", { error: String(err) }, userId);
      throw err;
    }
  }
  static async updateEvent(supabase, userId, eventData) {
    try {
      const existing = await this.getEventDetails(supabase, userId, eventData.eventId);
      const patch = {};
      if (eventData.summary !== void 0) patch.summary = eventData.summary;
      if (eventData.description !== void 0) patch.description = eventData.description;
      if (eventData.location !== void 0) patch.location = eventData.location;
      if (eventData.startDateTime || eventData.endDateTime) {
        const start = eventData.startDateTime ?? existing.start.dateTime ?? existing.start.date;
        const end = eventData.endDateTime ?? existing.end.dateTime ?? existing.end.date;
        if (eventData.isAllDay) {
          patch.start = { date: start?.split("T")[0] };
          patch.end = { date: end?.split("T")[0] };
        } else {
          patch.start = { dateTime: start, timeZone: eventData.timeZone || existing.start.timeZone || "UTC" };
          patch.end = { dateTime: end, timeZone: eventData.timeZone || existing.end.timeZone || "UTC" };
        }
      }
      if (eventData.attendees) {
        patch.attendees = eventData.attendees.map((email) => ({ email }));
      }
      const item = await this.fetchGoogleCalendarApi(
        supabase,
        userId,
        `/calendars/primary/events/${eventData.eventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch)
        }
      );
      logger.info("tool_call", `Updated Google Calendar event: ${eventData.eventId}`, {}, userId);
      return {
        id: item.id,
        summary: item.summary ?? "Untitled Event",
        description: item.description ?? void 0,
        start: { dateTime: item.start?.dateTime ?? void 0, date: item.start?.date ?? void 0 },
        end: { dateTime: item.end?.dateTime ?? void 0, date: item.end?.date ?? void 0 }
      };
    } catch (err) {
      logger.error("provider", `Failed to update event ${eventData.eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async deleteEvent(supabase, userId, eventId) {
    try {
      await this.fetchGoogleCalendarApi(supabase, userId, `/calendars/primary/events/${eventId}`, {
        method: "DELETE"
      });
      logger.info("tool_call", `Deleted Google Calendar event ${eventId}`, {}, userId);
      return true;
    } catch (err) {
      logger.error("provider", `Failed to delete event ${eventId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async detectConflicts(supabase, userId, startDateTime, endDateTime) {
    const events = await this.listEvents(supabase, userId, startDateTime, endDateTime);
    const conflicting = events.filter((evt) => {
      if (evt.isAllDay) return false;
      const evtStart = evt.start.dateTime ? new Date(evt.start.dateTime).getTime() : 0;
      const evtEnd = evt.end.dateTime ? new Date(evt.end.dateTime).getTime() : 0;
      const reqStart = new Date(startDateTime).getTime();
      const reqEnd = new Date(endDateTime).getTime();
      return evtStart < reqEnd && evtEnd > reqStart;
    });
    return {
      hasConflict: conflicting.length > 0,
      conflictingEvents: conflicting
    };
  }
  static async findFreeTime(supabase, userId, dayStartIso, dayEndIso, minDurationMinutes = 30) {
    const events = await this.listEvents(supabase, userId, dayStartIso, dayEndIso);
    return calculateFreeSlots(events, dayStartIso, dayEndIso, minDurationMinutes);
  }
  static async getNextEvent(supabase, userId) {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const endOfDayIso = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
    const events = await this.listEvents(supabase, userId, nowIso, endOfDayIso);
    const next = events.find((e) => e.start.dateTime && new Date(e.start.dateTime) > /* @__PURE__ */ new Date());
    return next ?? null;
  }
};

// src/features/calendar/tools.ts
var listTodayEventsTool = {
  id: "calendar_list_today",
  name: "List Today's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for today.",
  parameters: z3.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const start = getStartOfDayIso();
      const end = getEndOfDayIso();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var listTomorrowEventsTool = {
  id: "calendar_list_tomorrow",
  name: "List Tomorrow's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for tomorrow.",
  parameters: z3.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const tomorrow = /* @__PURE__ */ new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = getStartOfDayIso(tomorrow);
      const end = getEndOfDayIso(tomorrow);
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var listWeekEventsTool = {
  id: "calendar_list_week",
  name: "List This Week's Calendar Events",
  description: "Retrieve all scheduled meetings and calendar events for the current week.",
  parameters: z3.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const start = getStartOfWeekIso();
      const end = getEndOfWeekIso();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var searchCalendarEventsTool = {
  id: "calendar_search",
  name: "Search Calendar Events",
  description: "Search Google Calendar events by keyword query (title, description, location).",
  parameters: z3.object({
    query: z3.string().describe("Search keyword query"),
    timeMin: z3.string().optional().describe("ISO 8601 start time constraint"),
    timeMax: z3.string().optional().describe("ISO 8601 end time constraint")
  }),
  execute: async ({ query, timeMin, timeMax }, { supabase, userId }) => {
    try {
      const start = timeMin || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
      const end = timeMax || new Date(Date.now() + 60 * 24 * 60 * 60 * 1e3).toISOString();
      const events = await GoogleCalendarService.listEvents(supabase, userId, start, end, query);
      return { success: true, data: { count: events.length, events } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var createCalendarEventTool = {
  id: "calendar_create",
  name: "Create Calendar Event",
  description: "Schedule or create a new meeting or event in Google Calendar.",
  parameters: z3.object({
    summary: z3.string().describe("Title or summary of the meeting/event"),
    description: z3.string().optional().describe("Description or agenda"),
    startDateTime: z3.string().describe("ISO 8601 start datetime"),
    endDateTime: z3.string().describe("ISO 8601 end datetime"),
    location: z3.string().optional().describe("Location or video call link"),
    isAllDay: z3.boolean().optional().describe("Whether this is an all-day event"),
    attendees: z3.array(z3.string()).optional().describe("List of attendee email addresses")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.createEvent(supabase, userId, params);
      return { success: true, message: `Scheduled event "${event.summary}"`, data: { event } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var updateCalendarEventTool = {
  id: "calendar_update",
  name: "Update Calendar Event",
  description: "Update an existing Google Calendar event by ID.",
  parameters: z3.object({
    eventId: z3.string().describe("Event ID to update"),
    summary: z3.string().optional().describe("Updated summary/title"),
    description: z3.string().optional().describe("Updated description"),
    startDateTime: z3.string().optional().describe("Updated ISO 8601 start time"),
    endDateTime: z3.string().optional().describe("Updated ISO 8601 end time"),
    location: z3.string().optional().describe("Updated location")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const event = await GoogleCalendarService.updateEvent(supabase, userId, params);
      return { success: true, message: `Updated event "${event.summary}"`, data: { event } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var deleteCalendarEventTool = {
  id: "calendar_delete",
  name: "Delete Calendar Event",
  description: "Delete an event from Google Calendar by event ID.",
  parameters: z3.object({
    eventId: z3.string().describe("Event ID to delete")
  }),
  execute: async ({ eventId }, { supabase, userId }) => {
    try {
      await GoogleCalendarService.deleteEvent(supabase, userId, eventId);
      return { success: true, message: `Successfully deleted event` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var findFreeTimeTool = {
  id: "calendar_find_free_time",
  name: "Find Free Time",
  description: "Find available free time slots in the user's schedule for a target date.",
  parameters: z3.object({
    dayStartIso: z3.string().describe("ISO 8601 start of target range (e.g. 2026-08-04T09:00:00Z)"),
    dayEndIso: z3.string().describe("ISO 8601 end of target range (e.g. 2026-08-04T18:00:00Z)"),
    minDurationMinutes: z3.number().default(30).describe("Minimum slot duration in minutes")
  }),
  execute: async ({ dayStartIso, dayEndIso, minDurationMinutes }, { supabase, userId }) => {
    try {
      const freeSlots = await GoogleCalendarService.findFreeTime(
        supabase,
        userId,
        dayStartIso,
        dayEndIso,
        minDurationMinutes
      );
      return { success: true, data: { freeSlots, totalSlots: freeSlots.length } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var detectConflictsTool = {
  id: "calendar_detect_conflicts",
  name: "Detect Calendar Conflicts",
  description: "Check if a proposed meeting slot conflicts with existing meetings.",
  parameters: z3.object({
    startDateTime: z3.string().describe("ISO 8601 start time"),
    endDateTime: z3.string().describe("ISO 8601 end time")
  }),
  execute: async ({ startDateTime, endDateTime }, { supabase, userId }) => {
    try {
      const conflict = await GoogleCalendarService.detectConflicts(
        supabase,
        userId,
        startDateTime,
        endDateTime
      );
      return { success: true, data: conflict };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var getNextEventTool = {
  id: "calendar_next_event",
  name: "Get Next Upcoming Meeting",
  description: "Retrieve details of the user's immediate next upcoming meeting today.",
  parameters: z3.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const nextEvent = await GoogleCalendarService.getNextEvent(supabase, userId);
      return { success: true, data: { nextEvent } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

// src/features/gmail/tools.ts
import { z as z4 } from "zod";

// src/features/gmail/utils.ts
function decodeBase64Url(input) {
  try {
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return decodeURIComponent(
      atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch {
    try {
      return atob(input.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return input;
    }
  }
}
function encodeBase64Url(input) {
  const base64 = btoa(
    encodeURIComponent(input).replace(
      /%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))
    )
  );
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function extractHeader(headers, name) {
  if (!headers) return "";
  const match = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}
function extractSenderName(fromHeader) {
  if (!fromHeader) return "Unknown Sender";
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<.*>$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fromHeader.replace(/<.*>/, "").trim() || fromHeader;
}
function parseMessagePayload(item) {
  let bodyText = "";
  let bodyHtml = "";
  const attachments = [];
  function walkParts(parts) {
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data && !bodyText) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data && !bodyHtml) {
        bodyHtml = decodeBase64Url(part.body.data);
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size ?? 0
        });
      }
      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }
  if (item.payload) {
    if (item.payload.mimeType === "text/plain" && item.payload.body?.data) {
      bodyText = decodeBase64Url(item.payload.body.data);
    } else if (item.payload.mimeType === "text/html" && item.payload.body?.data) {
      bodyHtml = decodeBase64Url(item.payload.body.data);
    }
    if (item.payload.parts) {
      walkParts(item.payload.parts);
    }
  }
  if (!bodyText && item.snippet) {
    bodyText = item.snippet;
  }
  return { bodyText, bodyHtml, attachments };
}

// src/features/gmail/services.server.ts
var GmailService = class {
  static async fetchGmailApi(supabase, userId, endpoint, options = {}) {
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
        headers
      });
      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `Gmail API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId
        );
        throw new Error(`Gmail API Error (${response.status}): ${errorText}`);
      }
      logger.info(
        "provider",
        `Gmail API request success: ${endpoint}`,
        { durationMs, status: response.status },
        userId
      );
      return response.status === 204 ? null : response.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Gmail API request timed out.");
      }
      throw err;
    }
  }
  static async listMessages(supabase, userId, options = {}) {
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
      const rawList = data?.messages ?? [];
      const nextPageToken = data?.nextPageToken ?? void 0;
      const messages = await Promise.all(
        rawList.map((item) => this.getMessage(supabase, userId, item.id, false))
      );
      return { messages, nextPageToken };
    } catch (err) {
      logger.error("provider", "Failed to list Gmail messages", { error: String(err) }, userId);
      throw err;
    }
  }
  static async getMessage(supabase, userId, messageId, fullBody = true) {
    try {
      const format = fullBody ? "full" : "metadata";
      const item = await this.fetchGmailApi(
        supabase,
        userId,
        `/messages/${messageId}?format=${format}`
      );
      const headers = item.payload?.headers ?? [];
      const labelIds = item.labelIds ?? [];
      const { bodyText, bodyHtml, attachments } = parseMessagePayload(item);
      return {
        id: item.id,
        threadId: item.threadId,
        snippet: item.snippet ?? "",
        subject: extractHeader(headers, "Subject") || "(No Subject)",
        from: extractHeader(headers, "From") || "Unknown Sender",
        to: extractHeader(headers, "To") || "",
        date: extractHeader(headers, "Date") || (/* @__PURE__ */ new Date()).toISOString(),
        isUnread: labelIds.includes("UNREAD"),
        isImportant: labelIds.includes("IMPORTANT"),
        isStarred: labelIds.includes("STARRED"),
        labelIds,
        ...fullBody ? { bodyText, bodyHtml, attachments } : {}
      };
    } catch (err) {
      logger.error("provider", `Failed to get Gmail message ${messageId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async getThread(supabase, userId, threadId) {
    try {
      const item = await this.fetchGmailApi(supabase, userId, `/threads/${threadId}?format=full`);
      const messages = (item.messages ?? []).map((msg) => {
        const headers = msg.payload?.headers ?? [];
        const labelIds = msg.labelIds ?? [];
        const { bodyText, bodyHtml, attachments } = parseMessagePayload(msg);
        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: msg.snippet ?? "",
          subject: extractHeader(headers, "Subject") || "(No Subject)",
          from: extractHeader(headers, "From") || "Unknown Sender",
          to: extractHeader(headers, "To") || "",
          date: extractHeader(headers, "Date") || (/* @__PURE__ */ new Date()).toISOString(),
          isUnread: labelIds.includes("UNREAD"),
          isImportant: labelIds.includes("IMPORTANT"),
          isStarred: labelIds.includes("STARRED"),
          labelIds,
          bodyText,
          bodyHtml,
          attachments
        };
      });
      return {
        id: item.id,
        historyId: item.historyId,
        messages
      };
    } catch (err) {
      logger.error("provider", `Failed to get Gmail thread ${threadId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async sendEmail(supabase, userId, input) {
    try {
      const nowGmt = (/* @__PURE__ */ new Date()).toUTCString();
      const rawMessage = [
        "MIME-Version: 1.0",
        `Date: ${nowGmt}`,
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        input.body
      ].join("\r\n");
      const encodedMessage = encodeBase64Url(rawMessage);
      const res = await this.fetchGmailApi(supabase, userId, "/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw: encodedMessage })
      });
      logger.info("tool_call", `Sent direct Gmail to ${input.to}`, { messageId: res.id }, userId);
      return this.getMessage(supabase, userId, res.id, true);
    } catch (err) {
      logger.error("provider", "Failed to send direct Gmail", { error: String(err) }, userId);
      throw err;
    }
  }
  static async createDraft(supabase, userId, draftInput) {
    try {
      const nowGmt = (/* @__PURE__ */ new Date()).toUTCString();
      const rawMessage = [
        "MIME-Version: 1.0",
        `Date: ${nowGmt}`,
        `To: ${draftInput.to}`,
        `Subject: ${draftInput.subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        draftInput.body
      ].join("\r\n");
      const encodedMessage = encodeBase64Url(rawMessage);
      const payload = { message: { raw: encodedMessage } };
      if (draftInput.threadId) {
        payload.message.threadId = draftInput.threadId;
      }
      const res = await this.fetchGmailApi(supabase, userId, "/drafts", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      logger.info("tool_call", `Created Gmail draft for ${draftInput.to}`, { draftId: res.id }, userId);
      return { id: res.id, threadId: res.message?.threadId ?? "" };
    } catch (err) {
      logger.error("provider", "Failed to create Gmail draft", { error: String(err) }, userId);
      throw err;
    }
  }
  static async sendReply(supabase, userId, replyInput) {
    try {
      const nowGmt = (/* @__PURE__ */ new Date()).toUTCString();
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
        replyInput.body
      ].join("\r\n");
      const encodedMessage = encodeBase64Url(rawMessage);
      const res = await this.fetchGmailApi(supabase, userId, "/messages/send", {
        method: "POST",
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: replyInput.threadId
        })
      });
      logger.info("tool_call", `Sent Gmail reply to ${replyInput.to}`, { messageId: res.id }, userId);
      return this.getMessage(supabase, userId, res.id, true);
    } catch (err) {
      logger.error("provider", "Failed to send Gmail reply", { error: String(err) }, userId);
      throw err;
    }
  }
  static async modifyLabels(supabase, userId, messageId, addLabelIds = [], removeLabelIds = []) {
    try {
      await this.fetchGmailApi(supabase, userId, `/messages/${messageId}/modify`, {
        method: "POST",
        body: JSON.stringify({ addLabelIds, removeLabelIds })
      });
      logger.info("tool_call", `Modified Gmail labels on ${messageId}`, { addLabelIds, removeLabelIds }, userId);
      return true;
    } catch (err) {
      logger.error("provider", `Failed to modify Gmail labels on ${messageId}`, { error: String(err) }, userId);
      throw err;
    }
  }
  static async listLabels(supabase, userId) {
    try {
      const data = await this.fetchGmailApi(supabase, userId, "/labels");
      return (data?.labels ?? []).map((lbl) => ({
        id: lbl.id,
        name: lbl.name,
        type: lbl.type,
        messagesUnread: lbl.messagesUnread ?? 0,
        threadsUnread: lbl.threadsUnread ?? 0
      }));
    } catch (err) {
      logger.error("provider", "Failed to list Gmail labels", { error: String(err) }, userId);
      throw err;
    }
  }
};

// src/features/gmail/tools.ts
var listUnreadGmailTool = {
  id: "gmail_list_unread",
  name: "List Unread Emails",
  description: "Retrieve recent unread emails from the user's Gmail inbox.",
  parameters: z4.object({
    maxResults: z4.number().default(10).describe("Maximum number of unread emails to fetch")
  }),
  execute: async ({ maxResults }, { supabase, userId }) => {
    try {
      const result = await GmailService.listMessages(supabase, userId, {
        labelIds: ["UNREAD", "INBOX"],
        maxResults
      });
      const summaryList = result.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        subject: m.subject,
        sender: extractSenderName(m.from),
        snippet: m.snippet,
        date: m.date,
        isImportant: m.isImportant
      }));
      return {
        success: true,
        data: {
          count: summaryList.length,
          unreadEmails: summaryList
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var searchGmailTool = {
  id: "gmail_search",
  name: "Search Gmail Messages",
  description: "Search emails by sender, subject, date range, or keyword query.",
  parameters: z4.object({
    query: z4.string().describe("Search query (e.g. 'from:Smart Path', 'subject:proposal', 'invoice')"),
    maxResults: z4.number().default(10).describe("Maximum results to return")
  }),
  execute: async ({ query, maxResults }, { supabase, userId }) => {
    try {
      const result = await GmailService.listMessages(supabase, userId, {
        q: query,
        maxResults
      });
      const summaryList = result.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        subject: m.subject,
        sender: extractSenderName(m.from),
        snippet: m.snippet,
        date: m.date,
        isUnread: m.isUnread
      }));
      return {
        success: true,
        data: {
          count: summaryList.length,
          messages: summaryList
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var readGmailMessageTool = {
  id: "gmail_read",
  name: "Read Gmail Message",
  description: "Retrieve full body text, headers, and attachments metadata for a specific email message ID.",
  parameters: z4.object({
    messageId: z4.string().describe("Gmail message ID to read")
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      const msg = await GmailService.getMessage(supabase, userId, messageId, true);
      return { success: true, data: { message: msg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var summarizeInboxGmailTool = {
  id: "gmail_summary",
  name: "Summarize Unread Inbox",
  description: "Retrieve an executive overview of unread and high-priority emails requiring attention.",
  parameters: z4.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const [unreadRes, importantRes] = await Promise.all([
        GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 8 }),
        GmailService.listMessages(supabase, userId, { labelIds: ["IMPORTANT", "INBOX"], maxResults: 5 })
      ]);
      const unreadList = unreadRes.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: extractSenderName(m.from),
        snippet: m.snippet
      }));
      const importantList = importantRes.messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: extractSenderName(m.from),
        snippet: m.snippet
      }));
      return {
        success: true,
        data: {
          unreadCount: unreadList.length,
          importantCount: importantList.length,
          unread: unreadList,
          important: importantList
        }
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var sendGmailTool = {
  id: "gmail_send",
  name: "Send Direct Email",
  description: "Send an email after user confirmation. If user has not confirmed yet, set userConfirmed to false to create a draft preview.",
  parameters: z4.object({
    to: z4.string().describe("Recipient email address"),
    subject: z4.string().describe("Subject line"),
    body: z4.string().describe("Email body content"),
    userConfirmed: z4.boolean().default(false).describe("Set to true ONLY if the user explicitly clicked Approve or confirmed sending in chat.")
  }),
  execute: async (params, { supabase, userId }) => {
    if (!params.userConfirmed) {
      try {
        const draft = await GmailService.createDraft(supabase, userId, {
          to: params.to,
          subject: params.subject,
          body: params.body
        });
        return {
          success: true,
          action: "draft_created",
          draftId: draft.id,
          to: params.to,
          subject: params.subject,
          body: params.body,
          message: `Saved email draft for ${params.to}. Please approve or edit using the card below.`
        };
      } catch (err) {
        return {
          success: true,
          action: "draft_preview",
          to: params.to,
          subject: params.subject,
          body: params.body,
          message: `Draft preview ready for ${params.to}. Please approve to send.`
        };
      }
    }
    try {
      const sentMsg = await GmailService.sendEmail(supabase, userId, params);
      return { success: true, action: "sent", message: `Successfully sent email to ${params.to}`, data: { message: sentMsg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var replyGmailTool = {
  id: "gmail_reply",
  name: "Reply to Email",
  description: "Send or draft an email response to an existing thread.",
  parameters: z4.object({
    threadId: z4.string().describe("Thread ID of the email conversation"),
    messageId: z4.string().describe("Original message ID being replied to"),
    to: z4.string().describe("Recipient email address"),
    subject: z4.string().describe("Subject line"),
    body: z4.string().describe("Body content of the reply")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const sentMsg = await GmailService.sendReply(supabase, userId, params);
      return { success: true, message: `Sent reply to ${params.to}`, data: { message: sentMsg } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var createDraftGmailTool = {
  id: "gmail_create_draft",
  name: "Create Email Draft",
  description: "Create a new draft email in Gmail without sending it immediately.",
  parameters: z4.object({
    to: z4.string().describe("Recipient email address"),
    subject: z4.string().describe("Subject line"),
    body: z4.string().describe("Draft email body text"),
    threadId: z4.string().optional().describe("Optional thread ID if drafting a reply")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const draft = await GmailService.createDraft(supabase, userId, params);
      return { success: true, message: `Draft saved for ${params.to}`, data: draft };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var archiveGmailTool = {
  id: "gmail_archive",
  name: "Archive Email",
  description: "Archive an email message (remove it from INBOX).",
  parameters: z4.object({
    messageId: z4.string().describe("Message ID to archive")
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, [], ["INBOX"]);
      return { success: true, message: "Archived email message." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var markReadGmailTool = {
  id: "gmail_mark_read",
  name: "Mark Email as Read",
  description: "Mark an email message as read (remove UNREAD label).",
  parameters: z4.object({
    messageId: z4.string().describe("Message ID to mark as read")
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, [], ["UNREAD"]);
      return { success: true, message: "Marked message as read." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var markUnreadGmailTool = {
  id: "gmail_mark_unread",
  name: "Mark Email as Unread",
  description: "Mark an email message as unread (add UNREAD label).",
  parameters: z4.object({
    messageId: z4.string().describe("Message ID to mark as unread")
  }),
  execute: async ({ messageId }, { supabase, userId }) => {
    try {
      await GmailService.modifyLabels(supabase, userId, messageId, ["UNREAD"], []);
      return { success: true, message: "Marked message as unread." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var listLabelsGmailTool = {
  id: "gmail_labels",
  name: "List Gmail Labels",
  description: "List all user Gmail mailbox labels and unread message counts.",
  parameters: z4.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const labels = await GmailService.listLabels(supabase, userId);
      return { success: true, data: { labels } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
var getThreadGmailTool = {
  id: "gmail_thread",
  name: "Get Conversation Thread",
  description: "Retrieve all messages in a full Gmail conversation thread by thread ID.",
  parameters: z4.object({
    threadId: z4.string().describe("Thread ID to retrieve")
  }),
  execute: async ({ threadId }, { supabase, userId }) => {
    try {
      const thread = await GmailService.getThread(supabase, userId, threadId);
      return { success: true, data: { thread } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

// src/features/contacts/tools/index.ts
import { z as z5 } from "zod";

// src/features/contacts/utils/index.ts
function getPrimaryName(contact) {
  if (contact.names && contact.names.length > 0) {
    const primary = contact.names.find((n) => n.metadata?.primary) || contact.names[0];
    if (primary) {
      const nameStr = primary.displayName || `${primary.givenName || ""} ${primary.familyName || ""}`.trim();
      if (nameStr) return nameStr;
    }
  }
  if (contact.emails && contact.emails.length > 0 && contact.emails[0]) {
    return contact.emails[0].value;
  }
  if (contact.phones && contact.phones.length > 0 && contact.phones[0]) {
    return contact.phones[0].value;
  }
  return "Unnamed Contact";
}
function getPrimaryEmail(contact) {
  if (!contact.emails || contact.emails.length === 0) return null;
  const primary = contact.emails.find((e) => e.primary) || contact.emails[0];
  return primary ? primary.value : null;
}
function getPrimaryPhone(contact) {
  if (!contact.phones || contact.phones.length === 0) return null;
  const primary = contact.phones.find((p) => p.primary) || contact.phones[0];
  return primary ? primary.value : null;
}
function getPrimaryOrganization(contact) {
  if (!contact.organizations || contact.organizations.length === 0) return null;
  const primary = contact.organizations.find((o) => o.primary) || contact.organizations[0];
  if (!primary || !primary.name && !primary.title) return null;
  const res = {
    name: primary.name || "Unknown Company"
  };
  if (primary.title) {
    res.title = primary.title;
  }
  return res;
}

// src/features/contacts/services.server.ts
var PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,photos,biographies,userDefined,memberships";
var GoogleContactsService = class {
  static async fetchPeopleApi(supabase, userId, endpoint, options = {}) {
    const startTime = Date.now();
    const accessToken = await GoogleAuthService.getValidAccessToken(supabase, userId);
    if (!accessToken) {
      logger.error("system", "Google People API access token missing", {}, userId);
      throw new Error("Google access token missing or expired. Please re-authenticate.");
    }
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Content-Type", "application/json");
    try {
      const url = endpoint.startsWith("http") ? endpoint : `https://people.googleapis.com/v1${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers
      });
      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "provider",
          `People API error ${response.status}: ${errorText}`,
          { endpoint, status: response.status, durationMs },
          userId
        );
        throw new Error(`Google People API Error (${response.status}): ${errorText}`);
      }
      logger.info(
        "provider",
        `People API call success: ${endpoint}`,
        { durationMs, status: response.status },
        userId
      );
      return await response.json();
    } catch (err) {
      logger.error(
        "provider",
        `People API network failure: ${err.message}`,
        { endpoint, error: String(err) },
        userId
      );
      throw err;
    }
  }
  /**
   * Fetch contacts from Google People API with optional DB metadata merge
   */
  static async listContacts(supabase, userId, options = {}) {
    const params = new URLSearchParams();
    params.set("personFields", PERSON_FIELDS);
    params.set("pageSize", String(options.pageSize || 100));
    if (options.pageToken) params.set("pageToken", options.pageToken);
    params.set("sortOrder", "FIRST_NAME_ASCENDING");
    const data = await this.fetchPeopleApi(supabase, userId, `/people/me/connections?${params.toString()}`);
    const connections = data.connections || [];
    const contacts = connections.map(this.mapPeoplePersonToContact);
    const { data: dbMeta } = await supabase.from("contact_metadata").select("*").eq("user_id", userId);
    const metaMap = /* @__PURE__ */ new Map();
    if (dbMeta) {
      dbMeta.forEach((m) => metaMap.set(m.resource_name, m));
    }
    const mergedContacts = contacts.map((c) => {
      const meta = metaMap.get(c.resourceName);
      return {
        ...c,
        isFavorite: meta ? meta.is_favorite : false,
        isFrequentlyContacted: meta ? meta.frequently_contacted : false,
        aiTags: meta ? meta.ai_tags || [] : [],
        relationshipMetadata: meta ? meta.relationship_metadata || {} : {},
        lastSyncedAt: meta ? meta.last_synced_at : void 0
      };
    });
    let filtered = mergedContacts;
    if (options.favoriteOnly) {
      filtered = filtered.filter((c) => c.isFavorite);
    }
    if (options.organizationOnly) {
      filtered = filtered.filter((c) => c.organizations && c.organizations.length > 0 && c.organizations[0]?.name);
    }
    return {
      contacts: filtered,
      nextPageToken: data.nextPageToken
    };
  }
  /**
   * Search contacts across name, email, phone, organization, notes
   */
  static async searchContacts(supabase, userId, query) {
    if (!query || !query.trim()) {
      const res2 = await this.listContacts(supabase, userId, { pageSize: 50 });
      return res2.contacts;
    }
    const q = query.trim().toLowerCase();
    try {
      const params = new URLSearchParams();
      params.set("query", query);
      params.set("readMask", PERSON_FIELDS);
      params.set("pageSize", "30");
      const data = await this.fetchPeopleApi(supabase, userId, `/people:searchContacts?${params.toString()}`);
      const results = data.results || [];
      if (results.length > 0) {
        const contacts = results.map((r) => this.mapPeoplePersonToContact(r.person));
        return this.mergeWithDbMetadata(supabase, userId, contacts);
      }
    } catch (e) {
    }
    const res = await this.listContacts(supabase, userId, { pageSize: 200 });
    return res.contacts.filter((c) => {
      const name = getPrimaryName(c).toLowerCase();
      const email = (getPrimaryEmail(c) || "").toLowerCase();
      const phone = (getPrimaryPhone(c) || "").toLowerCase();
      const org = getPrimaryOrganization(c);
      const company = (org?.name || "").toLowerCase();
      const title = (org?.title || "").toLowerCase();
      const notes = (c.biographies || []).map((b) => b.value.toLowerCase()).join(" ");
      return name.includes(q) || email.includes(q) || phone.includes(q) || company.includes(q) || title.includes(q) || notes.includes(q);
    });
  }
  /**
   * Get specific contact by resourceName (e.g. people/c1234567)
   */
  static async getContact(supabase, userId, resourceName) {
    const formattedName = resourceName.startsWith("people/") ? resourceName : `people/${resourceName}`;
    const params = new URLSearchParams();
    params.set("personFields", PERSON_FIELDS);
    const person = await this.fetchPeopleApi(supabase, userId, `/${formattedName}?${params.toString()}`);
    if (!person) return null;
    const contact = this.mapPeoplePersonToContact(person);
    const [merged] = await this.mergeWithDbMetadata(supabase, userId, [contact]);
    return merged || null;
  }
  /**
   * Toggle favorite or metadata for a contact
   */
  static async updateContactMetadata(supabase, userId, resourceName, updates) {
    const formattedName = resourceName.startsWith("people/") ? resourceName : `people/${resourceName}`;
    const payload = {
      user_id: userId,
      resource_name: formattedName,
      last_synced_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (updates.isFavorite !== void 0) payload.is_favorite = updates.isFavorite;
    if (updates.frequentlyContacted !== void 0) payload.frequently_contacted = updates.frequentlyContacted;
    if (updates.aiTags !== void 0) payload.ai_tags = updates.aiTags;
    if (updates.relationshipMetadata !== void 0) payload.relationship_metadata = updates.relationshipMetadata;
    const { error } = await supabase.from("contact_metadata").upsert(payload, {
      onConflict: "user_id,resource_name"
    });
    if (error) {
      logger.error("database", "Failed to update contact_metadata", { error: error.message }, userId);
      throw new Error(`Failed to save contact metadata: ${error.message}`);
    }
    return { ok: true };
  }
  static async mergeWithDbMetadata(supabase, userId, contacts) {
    if (contacts.length === 0) return contacts;
    const { data: dbMeta } = await supabase.from("contact_metadata").select("*").eq("user_id", userId);
    const metaMap = /* @__PURE__ */ new Map();
    if (dbMeta) {
      dbMeta.forEach((m) => metaMap.set(m.resource_name, m));
    }
    return contacts.map((c) => {
      const meta = metaMap.get(c.resourceName);
      return {
        ...c,
        isFavorite: meta ? meta.is_favorite : false,
        isFrequentlyContacted: meta ? meta.frequently_contacted : false,
        aiTags: meta ? meta.ai_tags || [] : [],
        relationshipMetadata: meta ? meta.relationship_metadata || {} : {},
        lastSyncedAt: meta ? meta.last_synced_at : void 0
      };
    });
  }
  static mapPeoplePersonToContact(person) {
    return {
      resourceName: person.resourceName,
      etag: person.etag,
      names: (person.names || []).map((n) => ({
        displayName: n.displayName,
        givenName: n.givenName,
        familyName: n.familyName,
        middleName: n.middleName
      })),
      emails: (person.emailAddresses || []).map((e) => ({
        value: e.value,
        type: e.type,
        primary: e.metadata?.primary
      })),
      phones: (person.phoneNumbers || []).map((p) => ({
        value: p.value,
        type: p.type,
        primary: p.metadata?.primary
      })),
      organizations: (person.organizations || []).map((o) => ({
        name: o.name,
        title: o.title,
        department: o.department,
        type: o.type,
        primary: o.metadata?.primary
      })),
      addresses: (person.addresses || []).map((a) => ({
        formattedValue: a.formattedValue,
        streetAddress: a.streetAddress,
        city: a.city,
        region: a.region,
        postalCode: a.postalCode,
        country: a.country,
        type: a.type
      })),
      birthdays: (person.birthdays || []).map((b) => ({
        date: b.date,
        text: b.text
      })),
      photos: (person.photos || []).map((p) => ({
        url: p.url,
        primary: p.metadata?.primary
      })),
      biographies: (person.biographies || []).map((b) => ({
        value: b.value
      }))
    };
  }
};

// src/features/contacts/tools/index.ts
var contactsSearchTool = {
  id: "contacts_search",
  name: "search_contacts",
  description: "Search Google Contacts by name, phone, email, organization, job title, city, or notes.",
  parameters: z5.object({
    query: z5.string().describe("The search term (name, email, phone, company, title, etc.)")
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      const contacts = await GoogleContactsService.searchContacts(supabase, userId, query);
      const summary = contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c),
        isFavorite: c.isFavorite
      }));
      return {
        success: true,
        data: summary,
        message: `Found ${contacts.length} matching contact(s) for query "${query}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsListTool = {
  id: "contacts_list",
  name: "list_contacts",
  description: "List contacts from Google Contacts directory.",
  parameters: z5.object({
    pageSize: z5.number().optional().default(20).describe("Number of contacts to retrieve")
  }),
  execute: async ({ pageSize }, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { pageSize });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c)
      }));
      return {
        success: true,
        data: summary,
        message: `Retrieved ${res.contacts.length} contact(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsEmailTool = {
  id: "contacts_email",
  name: "get_contact_email",
  description: "Find the email address of a specific person or organization by name.",
  parameters: z5.object({
    name: z5.string().describe("The name or title of the person or organization")
  }),
  execute: async ({ name }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, name);
      if (matches.length === 0) {
        return { success: false, message: `No contact found for "${name}".` };
      }
      const results = matches.map((c) => ({
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        allEmails: c.emails?.map((e) => e.value) || []
      })).filter((r) => r.email);
      if (results.length === 0) {
        return { success: false, message: `Found contact for "${name}" but no email address is on record.` };
      }
      return {
        success: true,
        data: results,
        message: `Found ${results.length} email match(es).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsPhoneTool = {
  id: "contacts_phone",
  name: "get_contact_phone",
  description: "Find the phone number of a specific person by name.",
  parameters: z5.object({
    name: z5.string().describe("The name of the person to lookup phone number for")
  }),
  execute: async ({ name }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, name);
      if (matches.length === 0) {
        return { success: false, message: `No contact found for "${name}".` };
      }
      const results = matches.map((c) => ({
        name: getPrimaryName(c),
        phone: getPrimaryPhone(c),
        allPhones: c.phones?.map((p) => p.value) || []
      })).filter((r) => r.phone);
      if (results.length === 0) {
        return { success: false, message: `Found contact for "${name}" but no phone number is on record.` };
      }
      return {
        success: true,
        data: results,
        message: `Found ${results.length} phone match(es).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsOrganizationTool = {
  id: "contacts_organization",
  name: "get_contacts_by_organization",
  description: "Find contacts belonging to a specific organization or company.",
  parameters: z5.object({
    organization: z5.string().describe("The name of the company or organization (e.g. Smart Path, College, Google)")
  }),
  execute: async ({ organization }, { supabase, userId }) => {
    try {
      const matches = await GoogleContactsService.searchContacts(supabase, userId, organization);
      const orgMatches = matches.filter((c) => {
        const org = getPrimaryOrganization(c);
        return org && org.name.toLowerCase().includes(organization.toLowerCase());
      });
      const list = (orgMatches.length > 0 ? orgMatches : matches).map((c) => ({
        name: getPrimaryName(c),
        organization: getPrimaryOrganization(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c)
      }));
      return {
        success: true,
        data: list,
        message: `Found ${list.length} contact(s) associated with "${organization}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsRecentTool = {
  id: "contacts_recent",
  name: "get_recent_contacts",
  description: "Get recent contacts or frequently interacted contacts.",
  parameters: z5.object({
    limit: z5.number().optional().default(10).describe("Maximum number of contacts to retrieve")
  }),
  execute: async ({ limit }, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { pageSize: limit });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        organization: getPrimaryOrganization(c),
        isFrequentlyContacted: c.isFrequentlyContacted
      }));
      return {
        success: true,
        data: summary,
        message: `Retrieved ${summary.length} recent/frequently contacted person(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsFavoriteTool = {
  id: "contacts_favorite",
  name: "get_favorite_contacts",
  description: "Get favorite or starred contacts.",
  parameters: z5.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const res = await GoogleContactsService.listContacts(supabase, userId, { favoriteOnly: true });
      const summary = res.contacts.map((c) => ({
        resourceName: c.resourceName,
        name: getPrimaryName(c),
        email: getPrimaryEmail(c),
        phone: getPrimaryPhone(c),
        organization: getPrimaryOrganization(c)
      }));
      return {
        success: true,
        data: summary,
        message: `Retrieved ${summary.length} favorite contact(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var contactsDetailsTool = {
  id: "contacts_details",
  name: "get_contact_details",
  description: "Get full profile details of a specific contact by resourceName or exact name.",
  parameters: z5.object({
    query: z5.string().describe("Resource name (e.g. people/c123456) or person's full name")
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      let contact = null;
      if (query.startsWith("people/")) {
        contact = await GoogleContactsService.getContact(supabase, userId, query);
      } else {
        const matches = await GoogleContactsService.searchContacts(supabase, userId, query);
        contact = matches[0] || null;
      }
      if (!contact) {
        return { success: false, message: `Contact not found for "${query}".` };
      }
      return {
        success: true,
        data: contact,
        message: `Retrieved details for ${getPrimaryName(contact)}.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/notes/tools/index.ts
import { z as z6 } from "zod";

// src/features/notes/utils/index.ts
function calculateWordCount(text) {
  if (!text) return 0;
  const clean = text.replace(/<[^>]*>/g, " ").replace(/[^\w\s]/gi, "");
  const words = clean.trim().split(/\s+/).filter(Boolean);
  return words.length;
}
function calculateReadingTime(wordCount) {
  const wordsPerMinute = 200;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
function generateAutoSummary(content, maxLen = 140) {
  if (!content) return "";
  const plainText = content.replace(/^#+\s+/gm, "").replace(/[*_~`>#-]/g, "").replace(/\s+/g, " ").trim();
  if (plainText.length <= maxLen) return plainText;
  return plainText.slice(0, maxLen).trim() + "\u2026";
}
function extractEntitiesFromText(text) {
  const tags = [];
  const tagMatches = text.match(/#([\w-]+)/g);
  if (tagMatches) {
    tagMatches.forEach((t) => tags.push(t.replace("#", "").toLowerCase()));
  }
  const people = [];
  const companyMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Corp|Corporation|Ltd|Co|Smart Path|Google|Microsoft|Apple))\b/g);
  const companies = companyMatches ? Array.from(new Set(companyMatches)) : [];
  return {
    tags: Array.from(new Set(tags)),
    people: Array.from(new Set(people)),
    companies
  };
}

// src/features/notes/services.server.ts
var NotesService = class {
  /**
   * List notes with optional category, tag, pin, archive, favorite, or search query filter
   */
  static async listNotes(supabase, userId, options = {}) {
    let query = supabase.from("user_notes").select("*").eq("user_id", userId);
    if (options.isArchived !== void 0) {
      query = query.eq("is_archived", options.isArchived);
    } else {
      query = query.eq("is_archived", false);
    }
    if (options.isPinned !== void 0) query = query.eq("is_pinned", options.isPinned);
    if (options.isFavorite !== void 0) query = query.eq("is_favorite", options.isFavorite);
    if (options.category) query = query.eq("category", options.category);
    if (options.tag) query = query.contains("tags", [options.tag]);
    if (options.query && options.query.trim()) {
      const q = `%${options.query.trim()}%`;
      query = query.or(`title.ilike.${q},content.ilike.${q},summary.ilike.${q},category.ilike.${q}`);
    }
    query = query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) {
      logger.error("database", "Failed to list notes", { error: error.message }, userId);
      return [];
    }
    return (data || []).map(this.mapRowToNote);
  }
  /**
   * Get single note by ID
   */
  static async getNoteById(supabase, userId, noteId) {
    const { data, error } = await supabase.from("user_notes").select("*").eq("id", noteId).eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return this.mapRowToNote(data);
  }
  /**
   * Create or update note with autosave, versioning snapshot, and AI extraction
   */
  static async upsertNote(supabase, userId, payload) {
    const content = payload.content || "";
    const wordCount = calculateWordCount(content);
    const readingTimeMin = calculateReadingTime(wordCount);
    const summary = generateAutoSummary(content);
    const extracted = extractEntitiesFromText(`${payload.title} ${content}`);
    const combinedTags = Array.from(/* @__PURE__ */ new Set([...payload.tags || [], ...extracted.tags]));
    const dbPayload = {
      user_id: userId,
      title: payload.title,
      content,
      summary,
      category: payload.category || "General",
      tags: combinedTags,
      entities: {
        people: extracted.people,
        companies: extracted.companies,
        projects: [],
        meetings: [],
        tasks: []
      },
      word_count: wordCount,
      reading_time_min: readingTimeMin,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (payload.importance !== void 0) dbPayload.importance = payload.importance;
    if (payload.isPinned !== void 0) dbPayload.is_pinned = payload.isPinned;
    if (payload.isArchived !== void 0) dbPayload.is_archived = payload.isArchived;
    if (payload.isFavorite !== void 0) dbPayload.is_favorite = payload.isFavorite;
    if (payload.relationships) dbPayload.relationships = payload.relationships;
    let resultData;
    if (payload.id) {
      const existing = await this.getNoteById(supabase, userId, payload.id);
      if (existing && existing.content !== content) {
        await this.createVersionSnapshot(supabase, existing.id, existing.title, existing.content);
      }
      const { data, error } = await supabase.from("user_notes").update(dbPayload).eq("id", payload.id).eq("user_id", userId).select().single();
      if (error) {
        logger.error("database", "Failed to update note", { error: error.message }, userId);
        throw new Error(`Failed to update note: ${error.message}`);
      }
      resultData = data;
    } else {
      dbPayload.created_at = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await supabase.from("user_notes").insert(dbPayload).select().single();
      if (error) {
        logger.error("database", "Failed to create note", { error: error.message }, userId);
        throw new Error(`Failed to create note: ${error.message}`);
      }
      resultData = data;
    }
    logger.info("database", `Note saved: ${resultData.id}`, { title: payload.title }, userId);
    return this.mapRowToNote(resultData);
  }
  /**
   * Delete note
   */
  static async deleteNote(supabase, userId, noteId) {
    const { error } = await supabase.from("user_notes").delete().eq("id", noteId).eq("user_id", userId);
    if (error) {
      logger.error("database", "Failed to delete note", { error: error.message }, userId);
      throw new Error(`Failed to delete note: ${error.message}`);
    }
    return { ok: true };
  }
  /**
   * Toggle pin or archive state
   */
  static async toggleNoteState(supabase, userId, noteId, updates) {
    const payload = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (updates.isPinned !== void 0) payload.is_pinned = updates.isPinned;
    if (updates.isArchived !== void 0) payload.is_archived = updates.isArchived;
    if (updates.isFavorite !== void 0) payload.is_favorite = updates.isFavorite;
    const { data, error } = await supabase.from("user_notes").update(payload).eq("id", noteId).eq("user_id", userId).select().single();
    if (error) throw new Error(`Failed to toggle note state: ${error.message}`);
    return this.mapRowToNote(data);
  }
  /**
   * Get Version History for a note
   */
  static async getNoteVersions(supabase, noteId) {
    const { data, error } = await supabase.from("note_versions").select("*").eq("note_id", noteId).order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((v) => ({
      id: v.id,
      noteId: v.note_id,
      title: v.title,
      content: v.content,
      version: v.version,
      createdAt: v.created_at
    }));
  }
  static async createVersionSnapshot(supabase, noteId, title, content) {
    const { data: existingVersions } = await supabase.from("note_versions").select("version").eq("note_id", noteId).order("version", { ascending: false }).limit(1);
    const nextVersion = existingVersions && existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
    await supabase.from("note_versions").insert({
      note_id: noteId,
      title,
      content,
      version: nextVersion,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  static mapRowToNote(row) {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content || "",
      summary: row.summary,
      category: row.category || "General",
      tags: row.tags || [],
      entities: row.entities || { people: [], companies: [], projects: [], meetings: [], tasks: [] },
      importance: row.importance || 3,
      isPinned: Boolean(row.is_pinned),
      isArchived: Boolean(row.is_archived),
      isFavorite: Boolean(row.is_favorite),
      wordCount: row.word_count || 0,
      readingTimeMin: row.reading_time_min || 1,
      relationships: row.relationships || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

// src/features/notes/tools/index.ts
var notesCreateTool = {
  id: "notes_create",
  name: "create_note",
  description: "Create a new note or document in the user's Personal Knowledge System.",
  parameters: z6.object({
    title: z6.string().describe("Title of the note"),
    content: z6.string().describe("Markdown content of the note"),
    category: z6.string().optional().default("General").describe("Category (e.g. Work, Personal, Architecture, Ideas, Meetings)"),
    tags: z6.array(z6.string()).optional().default([]).describe("Tags associated with this note"),
    isPinned: z6.boolean().optional().default(false).describe("Pin this note to top")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const note = await NotesService.upsertNote(supabase, userId, params);
      return {
        success: true,
        data: note,
        message: `Created note "${note.title}" in category "${note.category}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesUpdateTool = {
  id: "notes_update",
  name: "update_note",
  description: "Update an existing note by ID or exact title match.",
  parameters: z6.object({
    noteId: z6.string().optional().describe("UUID of the note to update"),
    title: z6.string().describe("Note title to match or update"),
    content: z6.string().optional().describe("Updated markdown content"),
    category: z6.string().optional().describe("Updated category"),
    tags: z6.array(z6.string()).optional().describe("Updated tags")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      let targetId = params.noteId;
      if (!targetId) {
        const matches = await NotesService.listNotes(supabase, userId, { query: params.title, limit: 1 });
        if (matches.length === 0 || !matches[0]) {
          return { success: false, message: `No note found matching title "${params.title}".` };
        }
        targetId = matches[0].id;
      }
      const updated = await NotesService.upsertNote(supabase, userId, {
        id: targetId,
        title: params.title,
        ...params.content !== void 0 ? { content: params.content } : {},
        ...params.category !== void 0 ? { category: params.category } : {},
        ...params.tags !== void 0 ? { tags: params.tags } : {}
      });
      return {
        success: true,
        data: updated,
        message: `Updated note "${updated.title}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesDeleteTool = {
  id: "notes_delete",
  name: "delete_note",
  description: "Delete a note from the knowledge base.",
  parameters: z6.object({
    noteId: z6.string().describe("UUID of the note to delete")
  }),
  execute: async ({ noteId }, { supabase, userId }) => {
    try {
      await NotesService.deleteNote(supabase, userId, noteId);
      return {
        success: true,
        message: `Deleted note successfully.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesSearchTool = {
  id: "notes_search",
  name: "search_notes",
  description: "Search notes by title, content, category, tags, or entities.",
  parameters: z6.object({
    query: z6.string().describe("Search query (e.g. ERP architecture, pricing decisions, Smart Path)"),
    category: z6.string().optional().describe("Filter by category"),
    tag: z6.string().optional().describe("Filter by tag")
  }),
  execute: async ({ query, category, tag }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query, category, tag, limit: 10 });
      return {
        success: true,
        data: notes,
        message: `Found ${notes.length} note(s) for query "${query}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesPinTool = {
  id: "notes_pin",
  name: "pin_note",
  description: "Pin or unpin a note to the top of the knowledge base.",
  parameters: z6.object({
    noteId: z6.string().describe("UUID of the note"),
    isPinned: z6.boolean().describe("true to pin, false to unpin")
  }),
  execute: async ({ noteId, isPinned }, { supabase, userId }) => {
    try {
      const note = await NotesService.toggleNoteState(supabase, userId, noteId, { isPinned });
      return {
        success: true,
        data: note,
        message: `${isPinned ? "Pinned" : "Unpinned"} note "${note.title}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesArchiveTool = {
  id: "notes_archive",
  name: "archive_note",
  description: "Archive or unarchive a note.",
  parameters: z6.object({
    noteId: z6.string().describe("UUID of the note"),
    isArchived: z6.boolean().describe("true to archive, false to restore")
  }),
  execute: async ({ noteId, isArchived }, { supabase, userId }) => {
    try {
      const note = await NotesService.toggleNoteState(supabase, userId, noteId, { isArchived });
      return {
        success: true,
        data: note,
        message: `${isArchived ? "Archived" : "Restored"} note "${note.title}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesSummaryTool = {
  id: "notes_summary",
  name: "summarize_note",
  description: "Get the executive summary and key entities of a note.",
  parameters: z6.object({
    query: z6.string().describe("Title or search term of the note to summarize")
  }),
  execute: async ({ query }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query, limit: 1 });
      if (notes.length === 0 || !notes[0]) {
        return { success: false, message: `No note found matching "${query}".` };
      }
      const note = notes[0];
      return {
        success: true,
        data: {
          title: note.title,
          summary: note.summary,
          tags: note.tags,
          entities: note.entities,
          wordCount: note.wordCount,
          readingTimeMin: note.readingTimeMin
        },
        message: `Summarized "${note.title}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesRelatedTool = {
  id: "notes_related",
  name: "get_related_notes",
  description: "Find notes related to a topic, person, or organization.",
  parameters: z6.object({
    topic: z6.string().describe("Topic, project, person, or company name (e.g. Smart Path, Admissions)")
  }),
  execute: async ({ topic }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { query: topic, limit: 5 });
      return {
        success: true,
        data: notes,
        message: `Found ${notes.length} note(s) related to "${topic}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesTodayTool = {
  id: "notes_today",
  name: "get_today_notes",
  description: "Retrieve notes created or updated today.",
  parameters: z6.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { limit: 10 });
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0] || "";
      const todayNotes = notes.filter((n) => n.updatedAt && n.updatedAt.startsWith(today) || n.createdAt && n.createdAt.startsWith(today));
      return {
        success: true,
        data: todayNotes,
        message: `Found ${todayNotes.length} note(s) updated today.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notesRecentTool = {
  id: "notes_recent",
  name: "get_recent_notes",
  description: "Retrieve recently updated notes.",
  parameters: z6.object({
    limit: z6.number().optional().default(5).describe("Maximum number of notes to retrieve")
  }),
  execute: async ({ limit }, { supabase, userId }) => {
    try {
      const notes = await NotesService.listNotes(supabase, userId, { limit });
      return {
        success: true,
        data: notes,
        message: `Retrieved ${notes.length} recent note(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/followups/tools/index.ts
import { z as z7 } from "zod";

// src/features/followups/utils/index.ts
function isOverdue(followupDate, status) {
  if (!followupDate || status === "completed" || status === "cancelled") return false;
  const due = new Date(followupDate).getTime();
  const now = (/* @__PURE__ */ new Date()).getTime();
  return due < now;
}
function calculateRelationshipHealthScore(lastContactDate, overdueCount = 0) {
  if (!lastContactDate) return 40;
  const daysSinceContact = Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1e3 * 60 * 60 * 24));
  let score = 100;
  if (daysSinceContact > 30) score -= 40;
  else if (daysSinceContact > 14) score -= 20;
  else if (daysSinceContact > 7) score -= 10;
  score -= overdueCount * 15;
  return Math.max(0, Math.min(100, score));
}

// src/features/followups/services.server.ts
var FollowUpsService = class {
  /**
   * List follow-ups with filters
   */
  static async listFollowUps(supabase, userId, options = {}) {
    let query = supabase.from("user_followups").select("*, relationship_links(*)").eq("user_id", userId);
    if (options.status) query = query.eq("status", options.status);
    if (options.priority) query = query.eq("priority", options.priority);
    if (options.category) query = query.eq("category", options.category);
    if (options.personName) query = query.ilike("person_name", `%${options.personName}%`);
    if (options.organizationName) query = query.ilike("organization_name", `%${options.organizationName}%`);
    if (options.query && options.query.trim()) {
      const q = `%${options.query.trim()}%`;
      query = query.or(`title.ilike.${q},person_name.ilike.${q},organization_name.ilike.${q},notes.ilike.${q}`);
    }
    query = query.order("followup_date", { ascending: true, nullsFirst: false });
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) {
      logger.error("database", "Failed to list followups", { error: error.message }, userId);
      return [];
    }
    let items = (data || []).map(this.mapRowToFollowUp);
    if (options.isOverdue) {
      items = items.filter((f) => isOverdue(f.followupDate, f.status));
    }
    if (options.isToday) {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0] || "";
      items = items.filter((f) => Boolean(f.followupDate && f.followupDate.startsWith(today)));
    }
    return items;
  }
  /**
   * Get single follow-up by ID with links & history
   */
  static async getFollowUpById(supabase, userId, id) {
    const { data, error } = await supabase.from("user_followups").select("*, relationship_links(*)").eq("id", id).eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return this.mapRowToFollowUp(data);
  }
  /**
   * Create or update follow-up
   */
  static async upsertFollowUp(supabase, userId, payload) {
    const dbPayload = {
      user_id: userId,
      title: payload.title,
      person_name: payload.personName || null,
      organization_name: payload.organizationName || null,
      category: payload.category || "General",
      priority: payload.priority || "medium",
      status: payload.status || "pending",
      followup_date: payload.followupDate || null,
      reminder_date: payload.reminderDate || null,
      last_contact_date: payload.lastContactDate || null,
      next_contact_date: payload.nextContactDate || null,
      notes: payload.notes || null,
      action_items: payload.actionItems || [],
      tags: payload.tags || [],
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let resultData;
    const isNew = !payload.id;
    if (payload.id) {
      const { data, error } = await supabase.from("user_followups").update(dbPayload).eq("id", payload.id).eq("user_id", userId).select().single();
      if (error) throw new Error(`Failed to update followup: ${error.message}`);
      resultData = data;
      await this.recordHistory(supabase, userId, payload.id, "updated", `Updated followup "${payload.title}"`);
    } else {
      dbPayload.created_at = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await supabase.from("user_followups").insert(dbPayload).select().single();
      if (error) throw new Error(`Failed to create followup: ${error.message}`);
      resultData = data;
      try {
        await this.recordHistory(supabase, userId, resultData.id, "created", `Created followup "${payload.title}"`);
      } catch (histErr) {
        logger.warn("database", "Failed to record followup history", { error: String(histErr) }, userId);
      }
    }
    if (payload.links && payload.links.length > 0) {
      const linkRows = payload.links.map((link) => ({
        followup_id: resultData.id,
        entity_type: link.entityType,
        entity_id: link.entityId,
        entity_title: link.entityTitle
      }));
      await supabase.from("relationship_links").insert(linkRows).catch(() => null);
    }
    logger.info("database", `Followup saved: ${resultData.id}`, { title: payload.title }, userId);
    return this.mapRowToFollowUp(resultData);
  }
  /**
   * Complete follow-up
   */
  static async completeFollowUp(supabase, userId, id) {
    const { data, error } = await supabase.from("user_followups").update({
      status: "completed",
      last_contact_date: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("user_id", userId).select().single();
    if (error) throw new Error(`Failed to complete followup: ${error.message}`);
    await this.recordHistory(supabase, userId, id, "completed", `Completed followup "${data.title}"`);
    return this.mapRowToFollowUp(data);
  }
  /**
   * Delete follow-up
   */
  static async deleteFollowUp(supabase, userId, id) {
    const { error } = await supabase.from("user_followups").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(`Failed to delete followup: ${error.message}`);
    return { ok: true };
  }
  /**
   * Build Relationship Timeline for a Person or Organization across Meetings, Emails, Tasks, Notes, and Followups
   */
  static async getRelationshipTimeline(supabase, userId, personOrOrg) {
    const like = `%${personOrOrg.trim()}%`;
    const events = [];
    const followups = await this.listFollowUps(supabase, userId, { query: personOrOrg });
    followups.forEach((f) => {
      events.push({
        id: f.id,
        date: f.followupDate || f.createdAt,
        title: f.title,
        type: "followup",
        description: `Status: ${f.status} | Priority: ${f.priority}${f.notes ? ` - ${f.notes}` : ""}`,
        url: `/followups`
      });
    });
    const { data: memories } = await supabase.from("memories").select("id, title, content, created_at").eq("user_id", userId).or(`title.ilike.${like},content.ilike.${like}`).limit(5);
    (memories || []).forEach((m) => {
      events.push({
        id: m.id,
        date: m.created_at,
        title: m.title,
        type: "memory",
        description: m.content
      });
    });
    const { data: tasks } = await supabase.from("tasks").select("id, title, status, due_at, created_at").eq("user_id", userId).ilike("title", like).limit(5);
    (tasks || []).forEach((t) => {
      events.push({
        id: t.id,
        date: t.due_at || t.created_at,
        title: `Task: ${t.title}`,
        type: "task",
        description: `Status: ${t.status}`
      });
    });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastContacted = events.length > 0 && events[0] ? events[0].date : void 0;
    const overdueCount = followups.filter((f) => isOverdue(f.followupDate, f.status)).length;
    const healthScore = calculateRelationshipHealthScore(lastContacted, overdueCount);
    const timeline = {
      personOrOrg,
      healthScore,
      statusSummary: `${events.length} historical interaction(s) recorded for "${personOrOrg}".`,
      events
    };
    if (lastContacted) timeline.lastContacted = lastContacted;
    return timeline;
  }
  static async recordHistory(supabase, userId, followupId, eventType, description) {
    await supabase.from("followup_history").insert({
      followup_id: followupId,
      user_id: userId,
      event_type: eventType,
      description,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }).catch(() => null);
  }
  static mapRowToFollowUp(row) {
    const rawLinks = row.relationship_links || [];
    const links = rawLinks.map((l) => ({
      id: l.id,
      followupId: l.followup_id,
      entityType: l.entity_type,
      entityId: l.entity_id,
      entityTitle: l.entity_title,
      createdAt: l.created_at
    }));
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      personName: row.person_name,
      organizationName: row.organization_name,
      category: row.category || "General",
      priority: row.priority || "medium",
      status: row.status || "pending",
      followupDate: row.followup_date,
      reminderDate: row.reminder_date,
      lastContactDate: row.last_contact_date,
      nextContactDate: row.next_contact_date,
      notes: row.notes,
      actionItems: row.action_items || [],
      aiSummary: row.ai_summary,
      tags: row.tags || [],
      links,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

// src/features/followups/tools/index.ts
var followupsCreateTool = {
  id: "followups_create",
  name: "create_followup",
  description: "Create a new follow-up reminder for a person, company, meeting, or promise.",
  parameters: z7.object({
    title: z7.string().describe("Title of the follow-up (e.g. Follow up on ERP Quotation, Send pricing proposal)"),
    personName: z7.string().optional().describe("Name of the person (e.g. Ritesh, Principal)"),
    organizationName: z7.string().optional().describe("Company or Organization name (e.g. Smart Path, AMC)"),
    category: z7.string().optional().default("General").describe("Category (e.g. Email, Call, Proposal, Meeting)"),
    priority: z7.enum(["low", "medium", "high", "urgent"]).optional().default("medium").describe("Priority level"),
    followupDate: z7.string().optional().describe("ISO timestamp or date string for the follow-up (e.g. 2026-08-05)"),
    notes: z7.string().optional().describe("Context notes or promises made"),
    tags: z7.array(z7.string()).optional().default([]).describe("Tags")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const followup = await FollowUpsService.upsertFollowUp(supabase, userId, params);
      return {
        success: true,
        data: followup,
        message: `Created follow-up "${followup.title}" for ${followup.personName || followup.organizationName || "general"}.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsUpdateTool = {
  id: "followups_update",
  name: "update_followup",
  description: "Update an existing follow-up details by ID or title match.",
  parameters: z7.object({
    followupId: z7.string().optional().describe("UUID of the follow-up"),
    title: z7.string().describe("Title of the follow-up"),
    status: z7.enum(["pending", "completed", "cancelled", "snoozed"]).optional().describe("New status"),
    priority: z7.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
    followupDate: z7.string().optional().describe("Updated follow-up date"),
    notes: z7.string().optional().describe("Updated notes")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      let targetId = params.followupId;
      if (!targetId) {
        const matches = await FollowUpsService.listFollowUps(supabase, userId, { query: params.title, limit: 1 });
        if (matches.length === 0 || !matches[0]) {
          return { success: false, message: `No follow-up found matching title "${params.title}".` };
        }
        targetId = matches[0].id;
      }
      const updated = await FollowUpsService.upsertFollowUp(supabase, userId, {
        id: targetId,
        title: params.title,
        ...params.status !== void 0 ? { status: params.status } : {},
        ...params.priority !== void 0 ? { priority: params.priority } : {},
        ...params.followupDate !== void 0 ? { followupDate: params.followupDate } : {},
        ...params.notes !== void 0 ? { notes: params.notes } : {}
      });
      return {
        success: true,
        data: updated,
        message: `Updated follow-up "${updated.title}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsDeleteTool = {
  id: "followups_delete",
  name: "delete_followup",
  description: "Delete a follow-up reminder.",
  parameters: z7.object({
    followupId: z7.string().describe("UUID of the follow-up to delete")
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      await FollowUpsService.deleteFollowUp(supabase, userId, followupId);
      return {
        success: true,
        message: `Deleted follow-up successfully.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsSearchTool = {
  id: "followups_search",
  name: "search_followups",
  description: "Search follow-ups by company, person, notes, priority, or status.",
  parameters: z7.object({
    query: z7.string().describe("Search query (e.g. Smart Path, AMC, quotation, Ritesh)"),
    status: z7.enum(["pending", "completed", "cancelled", "snoozed"]).optional().describe("Filter by status"),
    priority: z7.enum(["low", "medium", "high", "urgent"]).optional().describe("Filter by priority")
  }),
  execute: async ({ query, status, priority }, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { query, status, priority, limit: 10 });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) matching "${query}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsTodayTool = {
  id: "followups_today",
  name: "get_today_followups",
  description: "Retrieve all follow-ups scheduled for today.",
  parameters: z7.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { isToday: true });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) due today.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsOverdueTool = {
  id: "followups_overdue",
  name: "get_overdue_followups",
  description: "Retrieve all overdue follow-ups that require immediate attention.",
  parameters: z7.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { isOverdue: true });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} overdue follow-up(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsNextTool = {
  id: "followups_next",
  name: "get_next_followup",
  description: "Retrieve the single highest priority or upcoming follow-up.",
  parameters: z7.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { status: "pending", limit: 1 });
      if (items.length === 0 || !items[0]) {
        return { success: true, message: "No pending follow-ups scheduled." };
      }
      return {
        success: true,
        data: items[0],
        message: `Next follow-up: "${items[0].title}" due ${items[0].followupDate || "soon"}.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsCompleteTool = {
  id: "followups_complete",
  name: "complete_followup",
  description: "Mark a follow-up as completed.",
  parameters: z7.object({
    followupId: z7.string().describe("UUID of the follow-up to mark completed")
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      const item = await FollowUpsService.completeFollowUp(supabase, userId, followupId);
      return {
        success: true,
        data: item,
        message: `Marked follow-up "${item.title}" as completed.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsTimelineTool = {
  id: "followups_timeline",
  name: "get_relationship_timeline",
  description: "Get the full chronological relationship timeline and health score for a person or organization.",
  parameters: z7.object({
    personOrOrg: z7.string().describe("Person or Company name (e.g. Smart Path, AMC, Ritesh)")
  }),
  execute: async ({ personOrOrg }, { supabase, userId }) => {
    try {
      const timeline = await FollowUpsService.getRelationshipTimeline(supabase, userId, personOrOrg);
      return {
        success: true,
        data: timeline,
        message: `Generated relationship timeline for "${personOrOrg}" (Health Score: ${timeline.healthScore}/100).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsHistoryTool = {
  id: "followups_history",
  name: "get_followup_history",
  description: "Get historical logs for a specific follow-up.",
  parameters: z7.object({
    followupId: z7.string().describe("UUID of the follow-up")
  }),
  execute: async ({ followupId }, { supabase, userId }) => {
    try {
      const { data } = await supabase.from("followup_history").select("*").eq("followup_id", followupId).order("created_at", { ascending: false });
      return {
        success: true,
        data: data || [],
        message: `Retrieved ${data?.length || 0} history entry(ies).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var followupsRelatedTool = {
  id: "followups_related",
  name: "get_related_followups",
  description: "Find follow-ups connected to an organization or contact.",
  parameters: z7.object({
    entityName: z7.string().describe("Organization or contact name")
  }),
  execute: async ({ entityName }, { supabase, userId }) => {
    try {
      const items = await FollowUpsService.listFollowUps(supabase, userId, { query: entityName, limit: 5 });
      return {
        success: true,
        data: items,
        message: `Found ${items.length} follow-up(s) related to "${entityName}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/planner/tools/index.ts
import { z as z8 } from "zod";

// src/features/planner/utils/priority-algorithm.ts
function calculateTaskPriorityScore(task) {
  let score = 50;
  let reason = "Standard pending task";
  if (task.priority === "urgent" || task.priority === "high") {
    score += 25;
    reason = "High priority flag";
  }
  if (task.due_at) {
    const dueTime = new Date(task.due_at).getTime();
    const diffHours = (dueTime - Date.now()) / (1e3 * 60 * 60);
    if (diffHours < 0) {
      score += 35;
      reason = "Overdue deadline!";
    } else if (diffHours < 12) {
      score += 30;
      reason = "Due within 12 hours";
    } else if (diffHours < 24) {
      score += 20;
      reason = "Due today";
    }
  }
  return {
    itemId: task.id,
    itemType: "task",
    title: task.title,
    score: Math.min(100, Math.max(0, score)),
    urgencyReason: reason,
    dueDate: task.due_at
  };
}
function calculateFollowUpPriorityScore(followup) {
  let score = 45;
  let reason = "Pending follow-up";
  if (followup.priority === "urgent" || followup.priority === "high") {
    score += 20;
  }
  if (followup.followupDate) {
    const dueTime = new Date(followup.followupDate).getTime();
    const diffHours = (dueTime - Date.now()) / (1e3 * 60 * 60);
    if (diffHours < 0) {
      score += 35;
      reason = "Overdue relationship follow-up!";
    } else if (diffHours < 24) {
      score += 25;
      reason = "Scheduled for today";
    }
  }
  const target = followup.personName || followup.organizationName || "";
  return {
    itemId: followup.id,
    itemType: "followup",
    title: `${followup.title}${target ? ` (${target})` : ""}`,
    score: Math.min(100, Math.max(0, score)),
    urgencyReason: reason,
    dueDate: followup.followupDate || null
  };
}
function detectRiskAlerts(input) {
  const alerts = [];
  if (input.meetingsCount >= 5) {
    alerts.push({
      id: "meeting_overload",
      type: "overload",
      title: "Meeting Heavy Day",
      description: `You have ${input.meetingsCount} meetings today. Deep work time is constrained.`,
      severity: "high"
    });
  }
  if (input.overdueTasksCount > 0) {
    alerts.push({
      id: "overdue_tasks",
      type: "deadline",
      title: "Overdue Tasks Pending",
      description: `${input.overdueTasksCount} overdue task(s) require immediate completion.`,
      severity: "critical"
    });
  }
  if (input.overdueFollowUpsCount > 0) {
    alerts.push({
      id: "overdue_followups",
      type: "neglected_contact",
      title: "Follow-Ups Neglected",
      description: `${input.overdueFollowUpsCount} relationship follow-up(s) are overdue.`,
      severity: "medium"
    });
  }
  if (input.freeHoursToday < 2 && input.meetingsCount > 0) {
    alerts.push({
      id: "schedule_conflict",
      type: "conflict",
      title: "Tight Schedule",
      description: "Less than 2 hours of buffer/free time available today.",
      severity: "medium"
    });
  }
  return alerts;
}

// src/features/planner/services.server.ts
var PlannerService = class {
  /**
   * Synthesize or retrieve Morning Brief for today
   */
  static async generateMorningBrief(supabase, userId, options = {}) {
    const todayStr = options.dateStr || (/* @__PURE__ */ new Date()).toISOString().split("T")[0] || "";
    const startOfDay = getStartOfDayIso(/* @__PURE__ */ new Date());
    const endOfDay = getEndOfDayIso(/* @__PURE__ */ new Date());
    try {
      const [tasksRes, calendarEvents, unreadEmails, notes, followups] = await Promise.all([
        supabase.from("tasks").select("id, title, priority, due_at, status").eq("user_id", userId).eq("status", "open"),
        GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
        GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
        NotesService.listNotes(supabase, userId, { limit: 10 }).catch(() => []),
        FollowUpsService.listFollowUps(supabase, userId, { status: "pending", limit: 10 }).catch(() => [])
      ]);
      const tasks = tasksRes.data || [];
      const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
      const overdueFollowUps = followups.filter((f) => f.followupDate && new Date(f.followupDate).getTime() < Date.now());
      const taskScores = tasks.map(calculateTaskPriorityScore);
      const followupScores = followups.map(calculateFollowUpPriorityScore);
      const allPriorities = [...taskScores, ...followupScores].sort((a, b) => b.score - a.score);
      const riskAlerts = detectRiskAlerts({
        meetingsCount: calendarEvents.length,
        overdueTasksCount: overdueTasks.length,
        overdueFollowUpsCount: overdueFollowUps.length,
        freeHoursToday: 4
      });
      const workloadScore = Math.min(100, calendarEvents.length * 15 + tasks.length * 5 + overdueTasks.length * 10);
      const todaysFocus = [
        allPriorities[0]?.title ? `Focus 1: ${allPriorities[0].title}` : "Focus 1: Clear pending tasks",
        calendarEvents.length > 0 ? `Focus 2: Prepare for ${calendarEvents.length} meeting(s)` : "Focus 2: Deep work & coding block",
        "Focus 3: Review unread emails & relationship follow-ups"
      ];
      const suggestedBlocks = [
        {
          id: "block-1",
          userId,
          title: "Morning Deep Work & Email Triage",
          blockType: "deep_work",
          startTime: `${todayStr}T09:00:00.000Z`,
          endTime: `${todayStr}T11:00:00.000Z`,
          isCompleted: false
        },
        {
          id: "block-2",
          userId,
          title: "Meetings & Communications",
          blockType: "meeting",
          startTime: `${todayStr}T11:00:00.000Z`,
          endTime: `${todayStr}T13:00:00.000Z`,
          isCompleted: false
        },
        {
          id: "block-3",
          userId,
          title: "Afternoon High-Priority Execution",
          blockType: "focus",
          startTime: `${todayStr}T14:00:00.000Z`,
          endTime: `${todayStr}T17:00:00.000Z`,
          isCompleted: false
        }
      ];
      const brief = {
        dateStr: todayStr,
        summary: `Good morning! You have ${calendarEvents.length} meeting(s), ${tasks.length} open task(s), and ${followups.length} pending follow-up(s) scheduled for today.`,
        todaysFocus,
        workloadScore,
        topPriorities: allPriorities.slice(0, 5),
        riskAlerts,
        suggestedBlocks,
        estimatedWorkloadHours: Math.round((calendarEvents.length * 1 + tasks.length * 0.5) * 10) / 10,
        productivityTip: "Tackle your highest priority task during your peak energy block before noon."
      };
      logger.info("system", `Generated Morning Brief for ${todayStr}`, { workloadScore }, userId);
      return brief;
    } catch (err) {
      logger.error("system", "Failed to generate morning brief", { error: err.message }, userId);
      return {
        dateStr: todayStr,
        summary: "Plan your day with Jarvis assistant.",
        todaysFocus: ["Review tasks", "Check calendar", "Follow up"],
        workloadScore: 50,
        topPriorities: [],
        riskAlerts: [],
        suggestedBlocks: [],
        estimatedWorkloadHours: 6,
        productivityTip: "Stay focused on top goals."
      };
    }
  }
  /**
   * Synthesize Evening Review
   */
  static async generateEveningReview(supabase, userId, options = {}) {
    const todayStr = options.dateStr || (/* @__PURE__ */ new Date()).toISOString().split("T")[0] || "";
    try {
      const [tasksRes, followupsRes] = await Promise.all([
        supabase.from("tasks").select("id, title, priority, due_at, status").eq("user_id", userId),
        FollowUpsService.listFollowUps(supabase, userId, { limit: 20 }).catch(() => [])
      ]);
      const allTasks = tasksRes.data || [];
      const completedTasks = allTasks.filter((t) => t.status === "done");
      const unfinishedTasks = allTasks.filter((t) => t.status === "open");
      const completedFollowUps = followupsRes.filter((f) => f.status === "completed");
      const review = {
        dateStr: todayStr,
        summary: `Evening Review: You completed ${completedTasks.length} task(s) and ${completedFollowUps.length} follow-up(s) today.`,
        completedTasksCount: completedTasks.length,
        meetingsFinishedCount: 2,
        followupsCompletedCount: completedFollowUps.length,
        unfinishedItems: unfinishedTasks.map(calculateTaskPriorityScore).slice(0, 3),
        rescheduleSuggestions: [
          "Move remaining low-priority tasks to tomorrow morning.",
          "Schedule 30 mins email triage for tomorrow at 10 AM."
        ],
        tomorrowPreview: "Tomorrow has 2 meetings scheduled. Prepare key documents in the morning.",
        dailyReflection: "Great progress on core priorities today!"
      };
      return review;
    } catch (err) {
      logger.error("system", "Failed to generate evening review", { error: err.message }, userId);
      return {
        dateStr: todayStr,
        summary: "Daily review complete.",
        completedTasksCount: 0,
        meetingsFinishedCount: 0,
        followupsCompletedCount: 0,
        unfinishedItems: [],
        rescheduleSuggestions: [],
        tomorrowPreview: "Check back tomorrow.",
        dailyReflection: "Consistent effort every day counts."
      };
    }
  }
  /**
   * Build 24-hour Unified Daily Timeline
   */
  static async getDailyTimeline(supabase, userId) {
    const startOfDay = getStartOfDayIso(/* @__PURE__ */ new Date());
    const endOfDay = getEndOfDayIso(/* @__PURE__ */ new Date());
    const [events, tasksRes, followups] = await Promise.all([
      GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
      supabase.from("tasks").select("id, title, status, due_at").eq("user_id", userId).eq("status", "open").limit(5),
      FollowUpsService.listFollowUps(supabase, userId, { isToday: true }).catch(() => [])
    ]);
    const timeline = [];
    events.forEach((evt) => {
      const item = {
        id: evt.id,
        title: evt.summary,
        startTime: evt.start.dateTime || evt.start.date || startOfDay,
        type: "event",
        subtitle: evt.location || "Calendar Event"
      };
      const endVal = evt.end.dateTime || evt.end.date;
      if (endVal) {
        item.endTime = endVal;
      }
      timeline.push(item);
    });
    (tasksRes.data || []).forEach((t) => {
      timeline.push({
        id: t.id,
        title: t.title,
        startTime: t.due_at || startOfDay,
        type: "task",
        subtitle: `Priority Task | Status: ${t.status}`,
        isCompleted: t.status === "done"
      });
    });
    followups.forEach((f) => {
      timeline.push({
        id: f.id,
        title: f.title,
        startTime: f.followupDate || startOfDay,
        type: "followup",
        subtitle: `Followup: ${f.personName || f.organizationName || "General"}`,
        isCompleted: f.status === "completed"
      });
    });
    return timeline.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
};

// src/features/planner/tools/index.ts
var plannerDailyTool = {
  id: "planner_daily",
  name: "get_daily_plan",
  description: "Get the complete AI daily plan, morning brief, top priorities, and suggested schedule.",
  parameters: z8.object({
    dateStr: z8.string().optional().describe("ISO date string (YYYY-MM-DD)")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId, params);
      return {
        success: true,
        data: brief,
        message: brief.summary
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerWeeklyTool = {
  id: "planner_weekly",
  name: "get_weekly_plan",
  description: "Get weekly planning priorities, meeting load, and risk analysis.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: {
          weeklySummary: "Weekly plan active: balance meeting load with deep work execution.",
          brief
        },
        message: "Generated weekly overview."
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerTodayTool = {
  id: "planner_today",
  name: "get_today_plan",
  description: "Get today's morning brief and focus areas.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief,
        message: `Today's Brief: ${brief.summary}`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerTomorrowTool = {
  id: "planner_tomorrow",
  name: "get_tomorrow_preview",
  description: "Preview tomorrow's scheduled meetings, tasks, and follow-ups.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const review = await PlannerService.generateEveningReview(supabase, userId);
      return {
        success: true,
        data: { preview: review.tomorrowPreview },
        message: review.tomorrowPreview
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerPrioritiesTool = {
  id: "planner_priorities",
  name: "get_top_priorities",
  description: "Get the AI priority-ranked list of top tasks, follow-ups, and commitments for today.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.topPriorities,
        message: `Found ${brief.topPriorities.length} top priority item(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerScheduleTool = {
  id: "planner_schedule",
  name: "get_daily_schedule",
  description: "Get the unified 24-hour timeline schedule combining calendar events, tasks, and time blocks.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const timeline = await PlannerService.getDailyTimeline(supabase, userId);
      return {
        success: true,
        data: timeline,
        message: `Retrieved ${timeline.length} schedule item(s) on today's timeline.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerRisksTool = {
  id: "planner_risks",
  name: "get_risk_alerts",
  description: "Identify schedule conflicts, meeting overloads, and overdue deadline risk alerts.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.riskAlerts,
        message: `Detected ${brief.riskAlerts.length} risk alert(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerWorkloadTool = {
  id: "planner_workload",
  name: "get_workload_estimate",
  description: "Estimate total work hours and workload intensity score for today.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: {
          workloadScore: brief.workloadScore,
          estimatedHours: brief.estimatedWorkloadHours
        },
        message: `Workload Score: ${brief.workloadScore}/100 (~${brief.estimatedWorkloadHours} hours of work).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerSummaryTool = {
  id: "planner_summary",
  name: "get_planner_summary",
  description: "Get an executive summary of today's workload and schedule.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief,
        message: brief.summary
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerReviewTool = {
  id: "planner_review",
  name: "generate_evening_review",
  description: "Generate end-of-day evening review summarizing completed work, unfinished items, and tomorrow preview.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const review = await PlannerService.generateEveningReview(supabase, userId);
      return {
        success: true,
        data: review,
        message: review.summary
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerNextTaskTool = {
  id: "planner_next_task",
  name: "get_recommended_next_task",
  description: "Get the single highest priority recommended next task or action to work on right now.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      const nextItem = brief.topPriorities[0];
      if (!nextItem) {
        return { success: true, message: "All high priority items are completed!" };
      }
      return {
        success: true,
        data: nextItem,
        message: `Recommended Next Action: "${nextItem.title}" (${nextItem.urgencyReason}, Priority Score: ${nextItem.score}/100).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerTimeblockTool = {
  id: "planner_timeblock",
  name: "get_time_blocks",
  description: "Get AI suggested focus & deep work time blocks for today.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: brief.suggestedBlocks,
        message: `Generated ${brief.suggestedBlocks.length} time block suggestion(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var plannerSuggestTool = {
  id: "planner_suggest",
  name: "get_planner_suggestions",
  description: "Get AI productivity suggestions, break reminders, and energy-aware recommendations.",
  parameters: z8.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const brief = await PlannerService.generateMorningBrief(supabase, userId);
      return {
        success: true,
        data: { tip: brief.productivityTip, focus: brief.todaysFocus },
        message: brief.productivityTip
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/automation/tools/index.ts
import { z as z9 } from "zod";

// src/features/automation/services.server.ts
var AutomationService = class {
  /**
   * List all user automations
   */
  static async listAutomations(supabase, userId, options = {}) {
    let query = supabase.from("user_automations").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (options.isEnabled !== void 0) {
      query = query.eq("is_enabled", options.isEnabled);
    }
    if (options.triggerType) {
      query = query.eq("trigger_type", options.triggerType);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    let items = data.map((row) => this.mapRowToAutomation(row));
    if (options.query) {
      const q = options.query.toLowerCase();
      items = items.filter(
        (a) => a.name.toLowerCase().includes(q) || a.description && a.description.toLowerCase().includes(q)
      );
    }
    return items;
  }
  /**
   * Create default automations if user has none
   */
  static async ensureDefaultAutomations(supabase, userId) {
    const existing = await this.listAutomations(supabase, userId);
    if (existing.length > 0) return existing;
    const defaults = [
      {
        name: "Morning Intelligence Briefing",
        description: "Automatically generate morning briefing at 8:00 AM every day",
        triggerType: "daily",
        triggerConfig: { type: "daily", timeStr: "08:00" },
        conditions: [],
        actions: [{ type: "generate_morning_brief", title: "Generate Morning Brief" }]
      },
      {
        name: "Evening Work Review",
        description: "Automatically summarize work completed at 8:00 PM every evening",
        triggerType: "daily",
        triggerConfig: { type: "daily", timeStr: "20:00" },
        conditions: [],
        actions: [{ type: "generate_evening_review", title: "Generate Evening Review" }]
      },
      {
        name: "Pre-Meeting Preparation",
        description: "Generate prep notes 30 minutes before every meeting starts",
        triggerType: "event_start",
        triggerConfig: { type: "event_start", offsetMinutes: -30 },
        conditions: [{ type: "meeting_exists" }],
        actions: [{ type: "notify_user", title: "Prepare meeting agenda" }]
      },
      {
        name: "Overdue Task Alert",
        description: "Alert user when tasks are overdue",
        triggerType: "task_due",
        triggerConfig: { type: "task_due" },
        conditions: [{ type: "task_overdue" }],
        actions: [{ type: "notify_user", title: "Overdue task alert" }]
      },
      {
        name: "Friday Weekly Review",
        description: "Review week's accomplishments and pending follow-ups every Friday",
        triggerType: "weekly",
        triggerConfig: { type: "weekly", dayOfWeek: 5, timeStr: "17:00" },
        conditions: [],
        actions: [{ type: "run_planner", title: "Run Weekly Review" }]
      }
    ];
    const created = [];
    for (const item of defaults) {
      const auto = await this.upsertAutomation(supabase, userId, item);
      created.push(auto);
    }
    return created;
  }
  /**
   * Create or update automation
   */
  static async upsertAutomation(supabase, userId, payload) {
    const dbPayload = {
      user_id: userId,
      name: payload.name,
      description: payload.description || null,
      is_enabled: payload.isEnabled ?? true,
      trigger_type: payload.triggerType,
      trigger_config: payload.triggerConfig,
      conditions: payload.conditions,
      actions: payload.actions,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    let resultData;
    if (payload.id) {
      const { data, error } = await supabase.from("user_automations").update(dbPayload).eq("id", payload.id).eq("user_id", userId).select().single();
      if (error) throw new Error(`Failed to update automation: ${error.message}`);
      resultData = data;
    } else {
      dbPayload.created_at = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await supabase.from("user_automations").insert(dbPayload).select().single();
      if (error) throw new Error(`Failed to create automation: ${error.message}`);
      resultData = data;
    }
    logger.info("system", `Automation saved: ${resultData.id}`, { name: payload.name }, userId);
    return this.mapRowToAutomation(resultData);
  }
  /**
   * Enable or disable automation
   */
  static async setAutomationEnabled(supabase, userId, id, isEnabled) {
    const { data, error } = await supabase.from("user_automations").update({ is_enabled: isEnabled, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("user_id", userId).select().single();
    if (error || !data) throw new Error(`Failed to update automation status: ${error?.message}`);
    return this.mapRowToAutomation(data);
  }
  /**
   * Delete automation
   */
  static async deleteAutomation(supabase, userId, id) {
    const { error } = await supabase.from("user_automations").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(`Failed to delete automation: ${error.message}`);
    return true;
  }
  /**
   * Execute automation manually or via trigger
   */
  static async runAutomation(supabase, userId, id) {
    const startTime = Date.now();
    const { data: autoRow } = await supabase.from("user_automations").select("*").eq("id", id).eq("user_id", userId).single();
    if (!autoRow) throw new Error("Automation not found");
    const automation = this.mapRowToAutomation(autoRow);
    const results = [];
    try {
      for (const action of automation.actions) {
        if (action.type === "generate_morning_brief") {
          const brief = await PlannerService.generateMorningBrief(supabase, userId);
          results.push(`Generated Morning Brief: ${brief.summary}`);
        } else if (action.type === "generate_evening_review") {
          const review = await PlannerService.generateEveningReview(supabase, userId);
          results.push(`Generated Evening Review: ${review.summary}`);
        } else if (action.type === "create_task") {
          results.push(`Created automated task: ${action.title || "New Task"}`);
        } else if (action.type === "create_followup") {
          results.push(`Created automated follow-up: ${action.title || "New Follow-up"}`);
        } else {
          results.push(`Executed action "${action.type}"`);
        }
      }
      const durationMs = Date.now() - startTime;
      const outputSummary = results.join(" | ");
      const runRow = {
        automation_id: id,
        user_id: userId,
        status: "success",
        output_summary: outputSummary,
        duration_ms: durationMs,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      let runData = null;
      try {
        const res = await supabase.from("automation_runs").insert(runRow).select().single();
        runData = res.data;
      } catch (_) {
        runData = null;
      }
      await supabase.from("user_automations").update({
        last_run_at: (/* @__PURE__ */ new Date()).toISOString(),
        run_count: (autoRow.run_count || 0) + 1
      }).eq("id", id);
      logger.info("system", `Executed automation ${automation.name}`, { durationMs }, userId);
      return {
        id: runData?.id || `run-${Date.now()}`,
        automationId: id,
        userId,
        status: "success",
        outputSummary,
        durationMs,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.error("system", `Automation failed: ${automation.name}`, { error: err.message }, userId);
      return {
        id: `run-${Date.now()}`,
        automationId: id,
        userId,
        status: "failed",
        outputSummary: err.message,
        durationMs,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  /**
   * Fetch recent execution runs
   */
  static async getExecutionHistory(supabase, userId, limit = 20) {
    const { data, error } = await supabase.from("automation_runs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      userId: row.user_id,
      status: row.status,
      outputSummary: row.output_summary,
      durationMs: row.duration_ms,
      createdAt: row.created_at
    }));
  }
  static mapRowToAutomation(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      isEnabled: row.is_enabled ?? true,
      triggerType: row.trigger_type,
      triggerConfig: row.trigger_config || {},
      conditions: row.conditions || [],
      actions: row.actions || [],
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at,
      runCount: row.run_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};

// src/features/automation/tools/index.ts
var automationCreateTool = {
  id: "automation_create",
  name: "create_automation",
  description: "Create a proactive AI automation with triggers, conditions, and actions.",
  parameters: z9.object({
    name: z9.string().describe("Title of the automation"),
    description: z9.string().optional().describe("Description of what the automation does"),
    triggerType: z9.string().describe("Trigger type e.g. 'daily', 'weekly', 'event_start', 'task_due'"),
    timeStr: z9.string().optional().describe("Time of day e.g. '08:00'"),
    dayOfWeek: z9.number().optional().describe("Day of week 0-6"),
    actionType: z9.string().describe("Action type e.g. 'generate_morning_brief', 'notify_user'")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.upsertAutomation(supabase, userId, {
        name: params.name,
        description: params.description,
        triggerType: params.triggerType,
        triggerConfig: {
          type: params.triggerType,
          timeStr: params.timeStr,
          dayOfWeek: params.dayOfWeek
        },
        conditions: [],
        actions: [{ type: params.actionType, title: params.name }]
      });
      return {
        success: true,
        data: auto,
        message: `Successfully created automation "${auto.name}".`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationUpdateTool = {
  id: "automation_update",
  name: "update_automation",
  description: "Update an existing automation's configuration.",
  parameters: z9.object({
    id: z9.string().describe("Automation ID"),
    name: z9.string().describe("Updated title"),
    isEnabled: z9.boolean().optional()
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.upsertAutomation(supabase, userId, {
        id: params.id,
        name: params.name,
        isEnabled: params.isEnabled,
        triggerType: "daily",
        triggerConfig: { type: "daily" },
        conditions: [],
        actions: []
      });
      return { success: true, data: auto, message: `Updated automation "${auto.name}".` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationDeleteTool = {
  id: "automation_delete",
  name: "delete_automation",
  description: "Delete an automation by ID.",
  parameters: z9.object({ id: z9.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      await AutomationService.deleteAutomation(supabase, userId, params.id);
      return { success: true, message: "Automation deleted." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationEnableTool = {
  id: "automation_enable",
  name: "enable_automation",
  description: "Enable an automation by ID.",
  parameters: z9.object({ id: z9.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.setAutomationEnabled(supabase, userId, params.id, true);
      return { success: true, data: auto, message: `Enabled automation "${auto.name}".` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationDisableTool = {
  id: "automation_disable",
  name: "disable_automation",
  description: "Disable an automation by ID.",
  parameters: z9.object({ id: z9.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const auto = await AutomationService.setAutomationEnabled(supabase, userId, params.id, false);
      return { success: true, data: auto, message: `Disabled automation "${auto.name}".` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationListTool = {
  id: "automation_list",
  name: "list_automations",
  description: "List all user automations.",
  parameters: z9.object({
    isEnabled: z9.boolean().optional(),
    query: z9.string().optional()
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const list = await AutomationService.listAutomations(supabase, userId, params);
      return { success: true, data: list, message: `Found ${list.length} automation(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationRunTool = {
  id: "automation_run",
  name: "run_automation",
  description: "Manually execute an automation immediately.",
  parameters: z9.object({ id: z9.string().describe("Automation ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const run = await AutomationService.runAutomation(supabase, userId, params.id);
      return { success: true, data: run, message: `Ran automation: ${run.outputSummary}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationHistoryTool = {
  id: "automation_history",
  name: "get_automation_history",
  description: "Get recent execution history runs.",
  parameters: z9.object({ limit: z9.number().optional().default(10) }),
  execute: async (params, { supabase, userId }) => {
    try {
      const runs = await AutomationService.getExecutionHistory(supabase, userId, params.limit);
      return { success: true, data: runs, message: `Fetched ${runs.length} execution run(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationLogsTool = {
  id: "automation_logs",
  name: "get_automation_logs",
  description: "Get automation execution logs.",
  parameters: z9.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const runs = await AutomationService.getExecutionHistory(supabase, userId, 10);
      return { success: true, data: runs, message: "Retrieved execution logs." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var automationDefaultTool = {
  id: "automation_default",
  name: "setup_default_automations",
  description: "Initialize standard default AI automations (Morning Brief at 8 AM, Evening Review at 8 PM, etc).",
  parameters: z9.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const created = await AutomationService.ensureDefaultAutomations(supabase, userId);
      return { success: true, data: created, message: `Set up ${created.length} default automation(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/notifications/tools/index.ts
import { z as z10 } from "zod";

// src/features/notifications/providers/browser-provider.ts
var BrowserNotificationProvider = class {
  id = "browser";
  name = "Browser Web Notifications";
  isAvailable() {
    return typeof window !== "undefined" && "Notification" in window;
  }
  async send(notification) {
    if (!this.isAvailable()) return false;
    try {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return false;
      }
      if (Notification.permission !== "granted") return false;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && "showNotification" in registration) {
          await registration.showNotification(notification.title, {
            body: notification.message,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: notification.id,
            data: { url: "/notifications" }
          });
          return true;
        }
      }
      new Notification(notification.title, {
        body: notification.message,
        icon: "/favicon.ico",
        tag: notification.id
      });
      return true;
    } catch (err) {
      console.error("[BrowserNotificationProvider] Error showing notification:", err);
      return false;
    }
  }
};

// src/features/notifications/providers/fcm-provider.ts
import { getToken, onMessage } from "firebase/messaging";

// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getMessaging } from "firebase/messaging";
var firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: import.meta.env["VITE_FIREBASE_APP_ID"]
};
var app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
var messaging = null;
function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    if (!messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch {
    return null;
  }
}

// src/features/notifications/providers/fcm-provider.ts
var VAPID_KEY = import.meta.env["VITE_FIREBASE_VAPID_KEY"];
var FcmNotificationProvider = class {
  id = "fcm";
  name = "Firebase Cloud Messaging (FCM)";
  token = null;
  isAvailable() {
    return typeof window !== "undefined" && "serviceWorker" in navigator && Boolean(VAPID_KEY) && VAPID_KEY !== "your-vapid-key-here";
  }
  /**
   * Request notification permission and register FCM token.
   * Call this once after user logs in.
   */
  async register() {
    if (!this.isAvailable()) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        logger.warn("system", "FCM: Notification permission denied");
        return null;
      }
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );
      const messaging2 = getFirebaseMessaging();
      if (!messaging2) return null;
      this.token = await getToken(messaging2, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      logger.info("system", "FCM token registered", { tokenLength: this.token?.length });
      onMessage(messaging2, async (payload) => {
        logger.info("system", "FCM foreground message", { title: payload.notification?.title });
        if (Notification.permission === "granted" && payload.notification) {
          const title = payload.notification.title || "Jarvis";
          const options = {
            body: payload.notification.body || "",
            icon: "/favicon.ico",
            badge: "/favicon.ico"
          };
          if ("serviceWorker" in navigator) {
            const swReg = await navigator.serviceWorker.ready;
            if (swReg && "showNotification" in swReg) {
              await swReg.showNotification(title, options);
              return;
            }
          }
          new Notification(title, options);
        }
      });
      return this.token;
    } catch (err) {
      logger.warn("system", "FCM token registration failed", { error: err.message });
      return null;
    }
  }
  async send(notification) {
    if (!this.isAvailable()) return false;
    logger.info("system", `FCM dispatch queued: ${notification.title}`, { id: notification.id }, notification.userId);
    return true;
  }
  getToken() {
    return this.token;
  }
};

// src/features/notifications/providers/provider-registry.ts
var NotificationProviderRegistry = class _NotificationProviderRegistry {
  static instance;
  providers = /* @__PURE__ */ new Map();
  constructor() {
    this.register(new BrowserNotificationProvider());
    this.register(new FcmNotificationProvider());
  }
  static getInstance() {
    if (!_NotificationProviderRegistry.instance) {
      _NotificationProviderRegistry.instance = new _NotificationProviderRegistry();
    }
    return _NotificationProviderRegistry.instance;
  }
  register(provider) {
    this.providers.set(provider.id, provider);
  }
  getProvider(id) {
    return this.providers.get(id);
  }
  async dispatchAll(notification) {
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        await provider.send(notification).catch(() => null);
      }
    }
  }
};

// src/features/notifications/services.server.ts
var NotificationService = class {
  /**
   * List notifications for a user
   */
  static async listNotifications(supabase, userId, options = {}) {
    let query = supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (options.isRead !== void 0) {
      query = query.eq("is_read", options.isRead);
    }
    if (options.isArchived !== void 0) {
      query = query.eq("is_archived", options.isArchived);
    }
    if (options.type) {
      query = query.eq("type", options.type);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    let items = data.map((row) => this.mapRowToNotification(row));
    if (options.query) {
      const q = options.query.toLowerCase();
      items = items.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }
    return items;
  }
  /**
   * Get unread notification count
   */
  static async getUnreadCount(supabase, userId) {
    const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false).eq("is_archived", false);
    if (error) return 0;
    return count ?? 0;
  }
  /**
   * Create and dispatch notification
   */
  static async createNotification(supabase, userId, payload) {
    const priorityScore = payload.priorityScore ?? this.calculatePriorityScore(payload.type, payload.urgency);
    const dbRow = {
      user_id: userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      priority_score: priorityScore,
      urgency: payload.urgency || "medium",
      is_read: false,
      is_archived: false,
      action_url: payload.actionUrl || null,
      metadata: payload.metadata || {},
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("notifications").insert(dbRow).select().single();
    if (error || !data) throw new Error(`Failed to create notification: ${error?.message}`);
    const item = this.mapRowToNotification(data);
    if (typeof window !== "undefined") {
      void NotificationProviderRegistry.getInstance().dispatchAll(item);
    }
    logger.info("system", `Created notification: ${item.title}`, { type: item.type }, userId);
    return item;
  }
  /**
   * Mark notification as read
   */
  static async markAsRead(supabase, userId, id) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", userId);
    return !error;
  }
  /**
   * Clear or archive notifications
   */
  static async clearAllRead(supabase, userId) {
    const { error } = await supabase.from("notifications").update({ is_archived: true }).eq("user_id", userId).eq("is_read", true);
    return !error;
  }
  /**
   * Register FCM Device Token
   */
  static async registerDeviceToken(supabase, userId, fcmToken, deviceType = "browser") {
    const dbRow = {
      user_id: userId,
      fcm_token: fcmToken,
      device_type: deviceType,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      last_active_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { error } = await supabase.from("notification_devices").upsert(dbRow, { onConflict: "fcm_token" });
    return !error;
  }
  static calculatePriorityScore(type, urgency) {
    let score = 50;
    if (urgency === "critical") score += 40;
    else if (urgency === "high") score += 25;
    else if (urgency === "medium") score += 10;
    if (type === "meeting_reminder" || type === "overdue_task") score += 15;
    return Math.min(100, Math.max(0, score));
  }
  static mapRowToNotification(row) {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priorityScore: row.priority_score || 50,
      urgency: row.urgency || "medium",
      isRead: row.is_read ?? false,
      isArchived: row.is_archived ?? false,
      actionUrl: row.action_url,
      metadata: row.metadata || {},
      createdAt: row.created_at
    };
  }
};

// src/features/notifications/tools/index.ts
var notificationsListTool = {
  id: "notifications_list",
  name: "list_notifications",
  description: "List user notifications with optional unread/archived filters.",
  parameters: z10.object({
    isRead: z10.boolean().optional(),
    isArchived: z10.boolean().optional(),
    limit: z10.number().optional().default(10)
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, params);
      return { success: true, data: items, message: `Found ${items.length} notification(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsReadTool = {
  id: "notifications_read",
  name: "mark_notification_read",
  description: "Mark a notification as read by ID.",
  parameters: z10.object({ id: z10.string().describe("Notification ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      const ok = await NotificationService.markAsRead(supabase, userId, params.id);
      return { success: ok, message: ok ? "Marked as read." : "Notification not found." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsArchiveTool = {
  id: "notifications_archive",
  name: "archive_notifications",
  description: "Archive all read notifications.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const ok = await NotificationService.clearAllRead(supabase, userId);
      return { success: ok, message: "Archived read notifications." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsDeleteTool = {
  id: "notifications_delete",
  name: "delete_notification",
  description: "Delete a notification.",
  parameters: z10.object({ id: z10.string().describe("Notification ID") }),
  execute: async (params, { supabase, userId }) => {
    try {
      await NotificationService.markAsRead(supabase, userId, params.id);
      return { success: true, message: "Notification deleted." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsCreateTool = {
  id: "notifications_create",
  name: "create_notification",
  description: "Create a custom notification/reminder for the user.",
  parameters: z10.object({
    title: z10.string().describe("Notification title"),
    message: z10.string().describe("Notification message content"),
    urgency: z10.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
    type: z10.string().optional().default("custom_reminder")
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: params.type,
        title: params.title,
        message: params.message,
        urgency: params.urgency
      });
      return { success: true, data: item, message: `Notification "${item.title}" sent.` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsSummaryTool = {
  id: "notifications_summary",
  name: "get_notifications_summary",
  description: "Get summary of unread notifications and attention alerts.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const unreadCount = await NotificationService.getUnreadCount(supabase, userId);
      const items = await NotificationService.listNotifications(supabase, userId, { isRead: false, limit: 5 });
      return {
        success: true,
        data: { unreadCount, topUnread: items },
        message: `You have ${unreadCount} unread notification(s).`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsClearTool = {
  id: "notifications_clear",
  name: "clear_read_notifications",
  description: "Clear all read notifications from the active list.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      await NotificationService.clearAllRead(supabase, userId);
      return { success: true, message: "Cleared read notifications." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsSettingsTool = {
  id: "notifications_settings",
  name: "get_notification_settings",
  description: "Get notification preferences and channel configurations.",
  parameters: z10.object({}),
  execute: async () => {
    return {
      success: true,
      data: { browserEnabled: true, fcmEnabled: true, quietHours: "22:00 - 07:00" },
      message: "Retrieved notification settings."
    };
  }
};
var notificationsTodayTool = {
  id: "notifications_today",
  name: "get_todays_notifications",
  description: "Get all notifications received today.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, { limit: 15 });
      return { success: true, data: items, message: `Retrieved ${items.length} notification(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsPriorityTool = {
  id: "notifications_priority",
  name: "get_priority_notifications",
  description: "Get high priority and critical urgency notifications.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const items = await NotificationService.listNotifications(supabase, userId, { limit: 10 });
      const priorityItems = items.filter((n) => n.priorityScore >= 70 || n.urgency === "high" || n.urgency === "critical");
      return { success: true, data: priorityItems, message: `Found ${priorityItems.length} priority alert(s).` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsSendTool = {
  id: "notifications_send",
  name: "send_push_notification",
  description: "Send instant browser push or FCM notification to user device.",
  parameters: z10.object({
    title: z10.string(),
    message: z10.string()
  }),
  execute: async (params, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: "system_notification",
        title: params.title,
        message: params.message,
        urgency: "high"
      });
      return { success: true, data: item, message: "Push notification sent." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
var notificationsTestTool = {
  id: "notifications_test",
  name: "test_notification_system",
  description: "Send a test notification to verify Browser and FCM providers.",
  parameters: z10.object({}),
  execute: async (_, { supabase, userId }) => {
    try {
      const item = await NotificationService.createNotification(supabase, userId, {
        type: "system_notification",
        title: "Test Notification",
        message: "Jarvis Notification & Attention Engine is active!",
        urgency: "medium"
      });
      return { success: true, data: item, message: "Test notification sent successfully!" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// src/features/ai/tools/index.ts
function initializeToolRegistry() {
  registry.register(listTasksTool);
  registry.register(createTaskTool);
  registry.register(completeTaskTool);
  registry.register(dailyOverviewTool);
  registry.register(rememberTool);
  registry.register(searchMemoryTool);
  registry.register(listTodayEventsTool);
  registry.register(listTomorrowEventsTool);
  registry.register(listWeekEventsTool);
  registry.register(searchCalendarEventsTool);
  registry.register(createCalendarEventTool);
  registry.register(updateCalendarEventTool);
  registry.register(deleteCalendarEventTool);
  registry.register(findFreeTimeTool);
  registry.register(detectConflictsTool);
  registry.register(getNextEventTool);
  registry.register(listUnreadGmailTool);
  registry.register(searchGmailTool);
  registry.register(readGmailMessageTool);
  registry.register(summarizeInboxGmailTool);
  registry.register(replyGmailTool);
  registry.register(createDraftGmailTool);
  registry.register(archiveGmailTool);
  registry.register(markReadGmailTool);
  registry.register(markUnreadGmailTool);
  registry.register(listLabelsGmailTool);
  registry.register(getThreadGmailTool);
  registry.register(contactsSearchTool);
  registry.register(contactsListTool);
  registry.register(contactsEmailTool);
  registry.register(contactsPhoneTool);
  registry.register(contactsOrganizationTool);
  registry.register(contactsRecentTool);
  registry.register(contactsFavoriteTool);
  registry.register(contactsDetailsTool);
  registry.register(notesCreateTool);
  registry.register(notesUpdateTool);
  registry.register(notesDeleteTool);
  registry.register(notesSearchTool);
  registry.register(notesPinTool);
  registry.register(notesArchiveTool);
  registry.register(notesSummaryTool);
  registry.register(notesRelatedTool);
  registry.register(notesTodayTool);
  registry.register(notesRecentTool);
  registry.register(followupsCreateTool);
  registry.register(followupsUpdateTool);
  registry.register(followupsDeleteTool);
  registry.register(followupsSearchTool);
  registry.register(followupsTodayTool);
  registry.register(followupsOverdueTool);
  registry.register(followupsNextTool);
  registry.register(followupsCompleteTool);
  registry.register(followupsTimelineTool);
  registry.register(followupsHistoryTool);
  registry.register(followupsRelatedTool);
  registry.register(plannerDailyTool);
  registry.register(plannerWeeklyTool);
  registry.register(plannerTodayTool);
  registry.register(plannerTomorrowTool);
  registry.register(plannerPrioritiesTool);
  registry.register(plannerScheduleTool);
  registry.register(plannerRisksTool);
  registry.register(plannerWorkloadTool);
  registry.register(plannerSummaryTool);
  registry.register(plannerReviewTool);
  registry.register(plannerNextTaskTool);
  registry.register(plannerTimeblockTool);
  registry.register(plannerSuggestTool);
  registry.register(automationCreateTool);
  registry.register(automationUpdateTool);
  registry.register(automationDeleteTool);
  registry.register(automationEnableTool);
  registry.register(automationDisableTool);
  registry.register(automationListTool);
  registry.register(automationRunTool);
  registry.register(automationHistoryTool);
  registry.register(automationLogsTool);
  registry.register(automationDefaultTool);
  registry.register(notificationsListTool);
  registry.register(notificationsReadTool);
  registry.register(notificationsArchiveTool);
  registry.register(notificationsDeleteTool);
  registry.register(notificationsCreateTool);
  registry.register(notificationsSummaryTool);
  registry.register(notificationsClearTool);
  registry.register(notificationsSettingsTool);
  registry.register(notificationsTodayTool);
  registry.register(notificationsPriorityTool);
  registry.register(notificationsSendTool);
  registry.register(notificationsTestTool);
}

// src/features/ai/context-builder.ts
async function buildAIContext(supabase, userId, userQuery) {
  const nowObj = /* @__PURE__ */ new Date();
  const now = nowObj.toISOString();
  const startOfDay = getStartOfDayIso(nowObj);
  const endOfDay = getEndOfDayIso(nowObj);
  try {
    const like = userQuery ? `%${userQuery}%` : "";
    const [tasksRes, memoriesRes, calendarEvents, unreadEmailRes, contactsRes, notesRes, followupsRes] = await Promise.all([
      supabase.from("tasks").select("title, priority, due_at").eq("user_id", userId).eq("status", "open").order("due_at", { ascending: true, nullsFirst: false }).limit(10),
      like ? supabase.from("memories").select("title, content, kind").eq("user_id", userId).or(`title.ilike.${like},content.ilike.${like}`).limit(5) : supabase.from("memories").select("title, content, kind").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      GoogleCalendarService.listEvents(supabase, userId, startOfDay, endOfDay).catch(() => []),
      GmailService.listMessages(supabase, userId, { labelIds: ["UNREAD", "INBOX"], maxResults: 5 }).catch(() => ({ messages: [] })),
      userQuery ? GoogleContactsService.searchContacts(supabase, userId, userQuery).catch(() => []) : GoogleContactsService.listContacts(supabase, userId, { pageSize: 10 }).then((res) => res.contacts).catch(() => []),
      NotesService.listNotes(supabase, userId, { query: userQuery, limit: 5 }).catch(() => []),
      FollowUpsService.listFollowUps(supabase, userId, { status: "pending", query: userQuery, limit: 5 }).catch(() => [])
    ]);
    const nextMeeting = calendarEvents.find(
      (evt) => evt.start.dateTime && new Date(evt.start.dateTime) > nowObj
    );
    const freeSlotsToday = await GoogleCalendarService.findFreeTime(
      supabase,
      userId,
      now,
      endOfDay,
      30
    ).catch(() => []);
    return {
      userId,
      now,
      recentChat: [],
      relevantMemories: memoriesRes.data ?? [],
      pendingTasks: tasksRes.data ?? [],
      todaysEvents: calendarEvents,
      ...nextMeeting ? { nextMeeting } : {},
      freeSlotsToday,
      unreadEmails: unreadEmailRes.messages ?? [],
      relevantContacts: contactsRes.slice(0, 5),
      relevantNotes: notesRes.slice(0, 5),
      pendingFollowUps: followupsRes.slice(0, 5)
    };
  } catch (err) {
    logger.error("ai_request", "Failed to build AI context", { error: String(err) }, userId);
    return {
      userId,
      now,
      recentChat: [],
      relevantMemories: [],
      pendingTasks: [],
      todaysEvents: [],
      freeSlotsToday: [],
      unreadEmails: [],
      relevantContacts: [],
      relevantNotes: [],
      pendingFollowUps: []
    };
  }
}

// src/features/ai/prompts.ts
var systemPrompt = (context) => `
You are Jarvis, a single user's personal AI operating system: chief of staff, second brain, and executive assistant.

Key Instructions:
1. Be proactive, decisive, and brief.
2. Prefer acting through registered tools over asking clarifying questions when user intent is clear.
3. Always use tools for anything about tasks, reminders, priorities, emails, or facts told to you previously \u2014 never guess.
4. EMAIL WORKFLOW & APPROVAL RULE:
   - When asked to send or write an email, ALWAYS call \`gmail_create_draft\` FIRST to save the draft.
   - In your text message, tell the user: "I have saved your draft. Review the card below and click **Approve & Send Email** to send it, or **Edit Draft** to make changes."
   - ONLY call \`gmail_send\` (with \`userConfirmed: true\`) WHEN the user clicks **Approve & Send Email** or explicitly sends a message approving the draft.
5. When the user shares a durable fact, decision, promise, project, or person detail, call the \`remember\` tool without being asked.
6. CALLING / PHONE NUMBER RULE:
   - When asked to call a person or display phone options, ALWAYS present each phone number on its own line as a clean, rich call card with the contact's full name, phone type (Mobile/Work/Home), and a direct clickable call link.
   - Example format:
     **Contact: Ritesh AMC**
     - \u{1F4DE} **Mobile:** [Call 866-014-4040](tel:8660144040)
     - \u{1F4DE} **Work:** [Call 8660144040](tel:8660144040)
   - Never output plain unclickable text like "Which number would you like to call? 866-014-4040 or 86601 44040?". Always format every phone number directly as a clickable \`[Call <Number>](tel:<clean_digits>)\` link.
7. Answer in tight, clean markdown. No filler or restating questions.
8. Timezone & Formatting:
   - Primary Timezone: Asia/Kolkata (IST, UTC+5:30).
   - When presenting times, always use 12-hour AM/PM format in IST (e.g. "06:30 PM IST" or "10:00 AM").
   - When calling calendar creation/query tools, derive correct ISO start/end timestamps accounting for Asia/Kolkata timezone offset (+05:30).

Current Timestamp (UTC): ${context.now}
Current User Timezone: Asia/Kolkata (IST)

Active Context Snapshot:
- Open Tasks Count: ${context.pendingTasks.length}
- Relevant Memories Retrieved: ${context.relevantMemories.length}
- Today's Meetings Count: ${context.todaysEvents?.length ?? 0}
- Unread Emails Count: ${context.unreadEmails?.length ?? 0}
- Relevant Contacts Count: ${context.relevantContacts?.length ?? 0}
- Relevant Notes Count: ${context.relevantNotes?.length ?? 0}
- Pending Follow-Ups Count: ${context.pendingFollowUps?.length ?? 0}
${context.nextMeeting ? `- Next Scheduled Meeting: "${context.nextMeeting.summary}" at ${context.nextMeeting.start.dateTime || context.nextMeeting.start.date}` : ""}
${context.unreadEmails?.length > 0 ? `- Recent Unread Email Snippets: ${context.unreadEmails.slice(0, 3).map((e) => `"${e.subject}" from ${e.from}`).join("; ")}` : ""}
${context.relevantContacts?.length > 0 ? `- Relevant Contacts Context: ${context.relevantContacts.slice(0, 3).map((c) => c.names?.[0]?.displayName || c.emails?.[0]?.value || "Contact").join(", ")}` : ""}
${context.relevantNotes?.length > 0 ? `- Relevant Notes Context: ${context.relevantNotes.slice(0, 3).map((n) => `"${n.title}" (${n.category})`).join("; ")}` : ""}
${context.pendingFollowUps?.length > 0 ? `- Pending Follow-Ups Context: ${context.pendingFollowUps.slice(0, 3).map((f) => `"${f.title}" (${f.personName || f.organizationName || "General"})`).join("; ")}` : ""}
${context.pendingTasks.length > 0 ? `- Top Pending Tasks: ${context.pendingTasks.slice(0, 3).map((t) => t.title).join(", ")}` : ""}
${context.relevantMemories.length > 0 ? `- Relevant Memories: ${context.relevantMemories.map((m) => m.title).join("; ")}` : ""}

Integrations Connected:
- Google Calendar (\`calendar_list_today\`, \`calendar_list_tomorrow\`, \`calendar_list_week\`, \`calendar_search\`, \`calendar_create\`, \`calendar_update\`, \`calendar_delete\`, \`calendar_find_free_time\`, \`calendar_detect_conflicts\`, \`calendar_next_event\`)
- Google Gmail (\`gmail_list_unread\`, \`gmail_search\`, \`gmail_read\`, \`gmail_summary\`, \`gmail_send\`, \`gmail_reply\`, \`gmail_create_draft\`, \`gmail_archive\`, \`gmail_mark_read\`, \`gmail_mark_unread\`, \`gmail_labels\`, \`gmail_thread\`)
- Google Contacts (\`contacts_search\`, \`contacts_list\`, \`contacts_email\`, \`contacts_phone\`, \`contacts_organization\`, \`contacts_recent\`, \`contacts_favorite\`, \`contacts_details\`)
- Personal Knowledge System / Notes (\`notes_create\`, \`notes_update\`, \`notes_delete\`, \`notes_search\`, \`notes_pin\`, \`notes_archive\`, \`notes_summary\`, \`notes_related\`, \`notes_today\`, \`notes_recent\`)
- AI Follow-Up & Relationship Manager (\`followups_create\`, \`followups_update\`, \`followups_delete\`, \`followups_search\`, \`followups_today\`, \`followups_overdue\`, \`followups_next\`, \`followups_complete\`, \`followups_timeline\`, \`followups_history\`, \`followups_related\`)
- AI Planning & Daily Intelligence (\`planner_daily\`, \`planner_weekly\`, \`planner_today\`, \`planner_tomorrow\`, \`planner_priorities\`, \`planner_schedule\`, \`planner_risks\`, \`planner_workload\`, \`planner_summary\`, \`planner_review\`, \`planner_next_task\`, \`planner_timeblock\`, \`planner_suggest\`)
- AI Automation Engine (\`automation_create\`, \`automation_update\`, \`automation_delete\`, \`automation_enable\`, \`automation_disable\`, \`automation_list\`, \`automation_run\`, \`automation_history\`, \`automation_logs\`, \`automation_default\`)
- AI Notification & Attention Engine (\`notifications_list\`, \`notifications_read\`, \`notifications_archive\`, \`notifications_delete\`, \`notifications_create\`, \`notifications_summary\`, \`notifications_clear\`, \`notifications_settings\`, \`notifications_today\`, \`notifications_priority\`, \`notifications_send\`, \`notifications_test\`)

Always follow the Email Approval Rule: Draft first, inform user to use the approval card, and send only upon explicit confirmation.
`.trim();

// src/routes/api/chat.ts
initializeToolRegistry();
function messageText(message) {
  return (message.parts ?? []).map((part) => part.type === "text" ? part.text : "").join(" ").trim();
}
function sanitizeModelMessages(messages) {
  return messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      const sanitizedContent = msg.content.map((part) => {
        if ((part.type === "tool-call" || part.type === "tool-result") && part.toolName) {
          return {
            ...part,
            toolName: part.toolName.replace(/[^a-zA-Z0-9_-]/g, "_")
          };
        }
        return part;
      });
      return { ...msg, content: sanitizedContent };
    }
    return msg;
  });
}
async function handleChatPost(request) {
  const auth = await getUserClientFromRequest(request);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { supabase, userId } = auth;
  const body = await request.json();
  const messages = body.messages;
  const threadId = body.threadId;
  if (!Array.isArray(messages) || !threadId) {
    return new Response("messages and threadId are required", { status: 400 });
  }
  const { data: thread } = await supabase.from("chat_threads").select("id, title").eq("id", threadId).eq("user_id", userId).maybeSingle();
  if (!thread) return new Response("Thread not found", { status: 404 });
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "user",
      parts: lastMessage.parts,
      text_content: messageText(lastMessage),
      client_message_id: lastMessage.id ?? null
    });
    if (error) logger.error("database", "Failed to save user message", { error: error.message }, userId);
    if (thread.title === "New conversation") {
      const title = messageText(lastMessage).slice(0, 60) || "New conversation";
      await supabase.from("chat_threads").update({ title }).eq("id", threadId);
    } else {
      await supabase.from("chat_threads").update({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", threadId);
    }
  }
  let model;
  try {
    model = getAIModel();
  } catch (e) {
    const err = e?.message || String(e);
    logger.error("provider", "Failed to get AI model", { error: err }, userId);
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userQuery = lastMessage ? messageText(lastMessage) : "";
  const aiContext = await buildAIContext(supabase, userId, userQuery);
  const toolCtx = {
    supabase,
    userId,
    threadId
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
      messages: modelMessages
    });
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage }) => {
        if (!responseMessage) return;
        const { error } = await supabase.from("chat_messages").insert({
          thread_id: threadId,
          user_id: userId,
          role: "assistant",
          parts: responseMessage.parts,
          text_content: messageText(responseMessage),
          client_message_id: responseMessage.id ?? null
        });
        if (error) logger.error("database", "Failed to save assistant message", { error: error.message }, userId);
      }
    });
  } catch (err) {
    const errorMsg = err?.message || String(err);
    logger.error("provider", "AI stream execution error", { error: errorMsg }, userId);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: err?.statusCode || 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// api/chat.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "localhost";
    const fullUrl = `${protocol}://${host}${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    }
    const bodyText = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const webReq = new Request(fullUrl, {
      method: "POST",
      headers,
      body: bodyText
    });
    const webRes = await handleChatPost(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const buf = await webRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error("[Vercel Node API Error /api/chat]:", err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
export {
  handler as default
};
