// Server-only. Provides a waterfall of AI models — tries each in order until one succeeds.
// Configure providers by setting environment variables in Lovable Cloud → Settings → Secrets.
// At least ONE key must be present, but the system works with any subset.
//
// Provider priority (fastest/cheapest first):
//   1. Google Gemini Flash   — GOOGLE_GENERATIVE_AI_API_KEY  (free 1M tokens/day at aistudio.google.com)
//   2. Groq Llama            — GROQ_API_KEY                  (free at console.groq.com)
//   3. Mistral               — MISTRAL_API_KEY               (free tier at console.mistral.ai)
//   4. OpenRouter            — OPENROUTER_API_KEY            (free models at openrouter.ai)
//   5. OpenAI                — OPENAI_API_KEY                (pay-per-use, fallback of last resort)

import { generateText, type LanguageModel } from "ai";

type ModelEntry = { name: string; load: () => Promise<LanguageModel> };

function buildProviders(): ModelEntry[] {
  const providers: ModelEntry[] = [];

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push({
      name: "Google Gemini Flash",
      load: async () => {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })("gemini-2.0-flash");
      },
    });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "Groq Llama",
      load: async () => {
        const { createGroq } = await import("@ai-sdk/groq");
        return createGroq({ apiKey: process.env.GROQ_API_KEY! })("llama-3.3-70b-versatile");
      },
    });
  }

  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      name: "Mistral",
      load: async () => {
        const { createMistral } = await import("@ai-sdk/mistral");
        return createMistral({ apiKey: process.env.MISTRAL_API_KEY! })("mistral-small-latest");
      },
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      load: async () => {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return createOpenAI({
          apiKey: process.env.OPENROUTER_API_KEY!,
          baseURL: "https://openrouter.ai/api/v1",
        })("google/gemini-flash-1.5");
      },
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "OpenAI",
      load: async () => {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })("gpt-4o-mini");
      },
    });
  }

  // Lovable gateway as last-resort legacy fallback
  if (process.env.LOVABLE_API_KEY) {
    providers.push({
      name: "Lovable Gateway",
      load: async () => {
        const { createLovableAiGatewayProvider } = await import("./ai-gateway-lovable.server");
        return createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY!)("google/gemini-3-flash-preview");
      },
    });
  }

  return providers;
}

export async function generateWithFallback(params: {
  system: string;
  prompt: string;
}): Promise<string> {
  const providers = buildProviders();

  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Add at least one API key in Lovable Cloud → Settings → Secrets.\n" +
      "Options: GOOGLE_GENERATIVE_AI_API_KEY (free), GROQ_API_KEY (free), MISTRAL_API_KEY (free), OPENROUTER_API_KEY, OPENAI_API_KEY"
    );
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const model = await provider.load();
      const { text } = await generateText({
        model,
        system: params.system,
        prompt: params.prompt,
      });
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
      // Continue to next provider on any error
    }
  }

  // All providers failed
  const lastError = errors[errors.length - 1] ?? "Unknown error";
  if (lastError.includes("402") || lastError.includes("Payment") || lastError.includes("credit")) {
    throw new Error("All AI providers exhausted or out of credits. Add a new API key in Lovable Cloud → Settings → Secrets.");
  }
  throw new Error(`All AI providers failed. Last error: ${lastError}`);
}
