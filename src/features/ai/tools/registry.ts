import { tool as vercelTool, type Tool as VercelTool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../services/logger.js";

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  userId: string;
  threadId?: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface AITool<TParams extends z.ZodType = z.ZodType> {
  id: string;
  name: string;
  description: string;
  parameters: TParams;
  execute: (params: z.infer<TParams>, context: ToolExecutionContext) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools: Map<string, AITool> = new Map();

  register<TParams extends z.ZodType>(tool: AITool<TParams>): void {
    const sanitizedId = tool.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (this.tools.has(sanitizedId)) {
      logger.warn("system", `Overwriting tool registration for ${sanitizedId}`);
    }
    const cleanTool = { ...tool, id: sanitizedId };
    this.tools.set(sanitizedId, cleanTool as unknown as AITool);
    logger.info("system", `Registered AI tool: ${sanitizedId}`);
  }

  getTool(id: string): AITool | undefined {
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return this.tools.get(sanitizedId);
  }

  getAllTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Converts registered tools into Vercel AI SDK compatible tool definitions
   */
  toVercelTools(context: ToolExecutionContext): Record<string, VercelTool> {
    const vercelToolsMap: Record<string, VercelTool> = {};

    // Limit to 60 tools to satisfy model provider caps (e.g. OpenRouter 64-tool limit)
    const entries = Array.from(this.tools.entries()).slice(0, 60);

    for (const [id, toolDef] of entries) {
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
      vercelToolsMap[sanitizedId] = vercelTool({
        description: toolDef.description,
        inputSchema: toolDef.parameters,
        execute: async (params: unknown) => {
          const startTime = Date.now();
          logger.info("tool_call", `Executing tool ${sanitizedId}`, { params }, context.userId);
          try {
            const result = await toolDef.execute(params as never, context);
            logger.info(
              "tool_call",
              `Tool ${sanitizedId} completed in ${Date.now() - startTime}ms`,
              { success: result.success },
              context.userId,
            );
            return result;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(
              "tool_call",
              `Tool ${sanitizedId} failed: ${errorMessage}`,
              { error: errorMessage },
              context.userId,
            );
            return {
              success: false,
              error: errorMessage,
              message: `Execution of ${toolDef.name} failed.`,
            };
          }
        },
      });
    }

    return vercelToolsMap;
  }
}

export const registry = new ToolRegistry();
