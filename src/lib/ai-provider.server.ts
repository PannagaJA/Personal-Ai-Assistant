import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type SupportedAIProvider = "google" | "openrouter";

/**
 * Returns a standardized Vercel AI SDK LanguageModel using OpenRouter or Google's official Gemini API.
 */
export function getAIModel(): LanguageModel {
  const openrouterKey =
    process.env["OPENROUTER_API_KEY"] ||
    process.env["VITE_OPENROUTER_API_KEY"] ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_OPENROUTER_API_KEY) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.OPENROUTER_API_KEY);

  const geminiKey =
    process.env["GEMINI_API_KEY"] ||
    process.env["VITE_GEMINI_API_KEY"] ||
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.GEMINI_API_KEY);

  if (openrouterKey && openrouterKey !== "your-openrouter-api-key") {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      apiKey: openrouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": "https://personal-ai-assistant.local",
        "X-Title": "Personal AI Assistant",
      },
      extraBody: {
        models: [
          "google/gemma-4-31b-it:free",
          "openai/gpt-oss-20b:free",
          "qwen/qwen3-next-80b-a3b-instruct:free",
          "nvidia/nemotron-3-super-120b-a12b:free",
          "deepseek/deepseek-v4-flash:free",
          "cohere/north-mini-code:free",
        ],
      },
    });
    return openrouter("openai/gpt-oss-20b:free") as unknown as LanguageModel;
  }

  if (geminiKey && geminiKey !== "your-google-gemini-api-key") {
    const googleProvider = createGoogleGenerativeAI({
      apiKey: geminiKey,
    });
    return googleProvider("gemini-1.5-flash-8b") as unknown as LanguageModel;
  }

  throw new Error(
    "Missing AI provider credentials. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in your environment.",
  );
}
