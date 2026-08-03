import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type SupportedAIProvider = "openrouter" | "google" | "openai";

/**
 * Returns a standardized Vercel AI SDK LanguageModel based on configured environment variables.
 * Uses OpenRouter auto-routing model selection for guaranteed model availability.
 */
export function getAIModel(preferredProvider?: SupportedAIProvider): LanguageModel {
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
    return openrouter("openrouter/auto") as unknown as LanguageModel;
  }

  if (preferredProvider === "openai" || (!geminiKey && openaiKey)) {
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing.");
    }
    return openai("gpt-4o") as unknown as LanguageModel;
  }

  if (geminiKey && geminiKey !== "your-google-gemini-api-key") {
    return google("gemini-2.5-flash") as unknown as LanguageModel;
  }

  throw new Error(
    "Missing AI provider credentials. Please set OPENROUTER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in your environment.",
  );
}
