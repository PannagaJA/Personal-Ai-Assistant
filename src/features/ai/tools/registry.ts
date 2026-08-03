import { tool as vercelTool, type Tool as VercelTool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/services/logger";

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
    if (this.tools.has(tool.id)) {
      logger.warn("system", `Overwriting tool registration for ${tool.id}`);
    }
    this.tools.set(tool.id, tool as unknown as AITool);
    logger.info("system", `Registered AI tool: ${tool.id}`);
  }

  getTool(id: string): AITool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): AITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Converts registered tools into Vercel AI SDK compatible tool definitions
   */
  toVercelTools(context: ToolExecutionContext): Record<string, VercelTool> {
    const vercelToolsMap: Record<string, VercelTool> = {};

    for (const [id, toolDef] of this.tools.entries()) {
      vercelToolsMap[id] = vercelTool({
        description: toolDef.description,
        inputSchema: toolDef.parameters,
        execute: async (params: unknown) => {
          const startTime = Date.now();
          logger.info("tool_call", `Executing tool ${id}`, { params }, context.userId);
          try {
            const result = await toolDef.execute(params as never, context);
            logger.info(
              "tool_call",
              `Tool ${id} completed in ${Date.now() - startTime}ms`,
              { success: result.success },
              context.userId,
            );
            return result;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(
              "tool_call",
              `Tool ${id} failed: ${errorMessage}`,
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
