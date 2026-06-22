// Server-only. Provides a waterfall of AI models — tries each in order until one succeeds.
//
// PROVIDER ROLES — each provider has a designated function; change here to rewire globally.
export const PROVIDER_ROLES = {
  writer: "anthropic",       // Claude — all proposal/strategy/email generation
  verifier: "google",        // Gemini Flash — entity extraction, specificity scoring, similarity matching
  challenger: "mistral",     // future: cross-provider candidate competition
} as const;

export type ProviderRole = keyof typeof PROVIDER_ROLES;
// Configure providers by setting environment variables in Lovable Cloud → Settings → Secrets.
// At least ONE key must be present, but the system works with any subset.
//
// Provider priority (fastest/cheapest first):
//   1. Anthropic Claude      — ANTHROPIC_API_KEY             (get at console.anthropic.com)
//   2. Google Gemini Flash   — GOOGLE_GENERATIVE_AI_API_KEY  (free 1M tokens/day at aistudio.google.com)
//   3. Groq Llama            — GROQ_API_KEY                  (free at console.groq.com)
//   4. Mistral               — MISTRAL_API_KEY               (free tier at console.mistral.ai)
//   5. OpenRouter            — OPENROUTER_API_KEY            (free models at openrouter.ai)
//   6. OpenAI                — OPENAI_API_KEY                (pay-per-use, fallback of last resort)

import { generateText, generateObject, type LanguageModel } from "ai";
import { z } from "zod";

type ModelEntry = { name: string; load: () => Promise<LanguageModel> };

function buildProviders(): ModelEntry[] {
  const providers: ModelEntry[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "Anthropic Claude",
      load: async () => {
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })("claude-haiku-4-5");
      },
    });
  }

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

/**
 * Uses AI SDK's generateObject — enforces JSON schema at the model level via
 * native JSON mode or tool use. Much more reliable than text-then-parse.
 * Falls back to each configured provider in order.
 */
export async function generateObjectWithFallback<T>(params: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const providers = buildProviders();

  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Add at least one API key in Lovable Cloud → Settings → Secrets."
    );
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const model = await provider.load();
      const { object } = await generateObject({
        model,
        schema: params.schema,
        system: params.system,
        prompt: params.prompt,
      });
      return object;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  throw new Error(`AI structured output failed. Last error: ${errors[errors.length - 1] ?? "Unknown"}`);
}

/**
 * Structured output routed to a specific provider role.
 * Tries the designated provider first, then falls back to the full waterfall.
 */
export async function generateObjectWithProvider<T>(role: keyof typeof PROVIDER_ROLES, params: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const providerName = PROVIDER_ROLES[role];
  const allProviders = buildProviders();

  const roleProvider = allProviders.find((p) => p.name.toLowerCase().includes(providerName));
  if (roleProvider) {
    try {
      const model = await roleProvider.load();
      const { object } = await generateObject({ model, schema: params.schema, system: params.system, prompt: params.prompt });
      return object;
    } catch {
      // Fall through to full waterfall
    }
  }

  return generateObjectWithFallback(params);
}

/**
 * Text generation routed to a specific provider role.
 * Falls back to the full waterfall if the designated provider is unavailable.
 */
export async function generateWithProvider(role: keyof typeof PROVIDER_ROLES, params: {
  system: string;
  prompt: string;
}): Promise<string> {
  const providerName = PROVIDER_ROLES[role];
  const allProviders = buildProviders();

  const roleProvider = allProviders.find((p) => p.name.toLowerCase().includes(providerName));
  if (roleProvider) {
    try {
      const model = await roleProvider.load();
      const { text } = await generateText({ model, system: params.system, prompt: params.prompt });
      return text;
    } catch {
      // Fall through to full waterfall
    }
  }

  return generateWithFallback(params);
}

/**
 * Specificity gate — runs after Claude generates a proposal.
 * Uses Gemini Flash (verifier role) to score specificity and entity usage.
 * Returns null if verification is unavailable (never blocks generation).
 */
export async function verifyOutput(params: {
  proposal: string;
  jobDescription: string;
  extractedEntities: string[];
}): Promise<{ specificity: number; genericPhraseCount: number; entityUsage: number; complaint: string } | null> {
  try {
    const { z } = await import("zod");
    const VerifySchema = z.object({
      specificity: z.number().int().min(1).max(10),
      genericPhraseCount: z.number().int().min(0),
      entityUsage: z.number().int().min(0),
      complaint: z.string(),
    });

    const entityList = params.extractedEntities.length > 0
      ? `\nEntities extracted from job post: ${params.extractedEntities.join(", ")}`
      : "";

    const allProviders = buildProviders();
    const verifier = allProviders.find((p) => p.name.toLowerCase().includes("gemini"));
    if (!verifier) return null;

    const model = await verifier.load();
    const { object } = await generateObject({
      model,
      schema: VerifySchema,
      system: `You are a proposal specificity auditor. Score how well the proposal grounds itself in the specific job post details.

SPECIFICITY (1-10):
- 1-4: Almost entirely generic — could apply to any job. Mentions no specific tools, numbers, or client details.
- 5-6: Some specifics but relies on generic claims. Fewer than 2 job-specific anchors.
- 7-8: Good — mentions ≥3 specific details from the job post (tool names, numbers, their actual challenge).
- 9-10: Excellent — every paragraph references something from the job post. Zero interchangeable sentences.

GENERIC PHRASE COUNT: Count phrases that could appear in ANY proposal regardless of job (e.g., "I have extensive experience", "I understand your needs", "passionate about", "dedicated professional", "I am confident", "I would love to", "looking forward to", "don't hesitate").

ENTITY USAGE: Count how many of the extracted entities actually appear in the proposal (exact or paraphrase).

COMPLAINT: If specificity < 7, write one concrete sentence about what's missing. Otherwise write "Pass."`,
      prompt: `Job post:\n${params.jobDescription.slice(0, 3000)}${entityList}\n\nProposal to audit:\n${params.proposal.slice(0, 4000)}`,
    });

    return object;
  } catch {
    return null;
  }
}
