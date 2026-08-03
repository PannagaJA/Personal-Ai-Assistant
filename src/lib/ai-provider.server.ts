import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV1 } from "ai";

export type SupportedAIProvider = "openrouter" | "google" | "openai";

/**
 * Returns a standardized Vercel AI SDK LanguageModelV1 based on configured environment variables.
 * Uses OpenRouter auto-routing model selection for guaranteed model availability.
 */
export function getAIModel(preferredProvider?: SupportedAIProvider): LanguageModelV1 {
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
    });
    // openrouter/auto dynamically routes to currently available models
    return openrouter("openrouter/auto");
  }

  if (preferredProvider === "openai" || (!geminiKey && openaiKey)) {
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing.");
    }
    return openai("gpt-4o");
  }

  if (geminiKey && geminiKey !== "your-google-gemini-api-key") {
    return google("gemini-2.5-flash");
  }

  throw new Error(
    "Missing AI provider credentials. Please set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your environment.",
  );
}
