import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { LanguageModelV1 } from "ai";

export type SupportedAIProvider = "google" | "openai";

/**
 * Returns a standardized Vercel AI SDK LanguageModelV1 based on configured environment variables.
 * Prioritizes GEMINI_API_KEY (Google Gemini 2.5 Flash), falling back to OPENAI_API_KEY if configured.
 */
export function getAIModel(preferredProvider?: SupportedAIProvider): LanguageModelV1 {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];

  if (preferredProvider === "openai" || (!geminiKey && openaiKey)) {
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing.");
    }
    return openai("gpt-4o");
  }

  if (!geminiKey) {
    throw new Error(
      "Missing AI provider credentials. Please set GEMINI_API_KEY or OPENAI_API_KEY in your environment.",
    );
  }

  return google("gemini-2.5-flash");
}
