// Server-only AI gateway with provider role specialization.
//
// Each role tries its designated provider first, then falls back through the
// full waterfall — generation never fails silently.
//
// The lists below reflect the ACTUAL structuredWith()/generateWithProvider()
// calls in ai.functions.ts and proposal-intelligence.ts — not the original
// aspirational design. Keep them accurate when routing changes.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │                          PROVIDER ROLE MAP                               │
// │                                                                          │
// │  writer     → Claude Sonnet (Anthropic) — all client-facing prose:       │
// │      craftHookLine, generateProposal, generateStrategyDocument,          │
// │      applyProposalEdit, generateConversionResponses, generateContestBrief,│
// │      generateScoutOutreach, and intelligence Engine 3 (psychology) +     │
// │      Engine 4 (proposal blueprint).                                      │
// │                                                                          │
// │  analyzer   → Gemini Flash (Google) — structured extraction:             │
// │      analyzeJob (legacy fallback path), analyzeClientWebsite, and         │
// │      intelligence Engine 1 (client) + Engine 2 (business).               │
// │                                                                          │
// │  verifier   → Gemini Flash (Google) — scoring / gating / cleanup:        │
// │      analyzeHookStrength, polishProposal, injectPortfolioLinks, and       │
// │      the verifyOutput specificity gate.                                   │
// │                                                                          │
// │  challenger → Mistral — utility generation:                              │
// │      generateMilestones, generateAiHookStrategy, craftCtaLine,           │
// │      generateProfileSections.                                            │
// │                                                                          │
// │  (researchClientAndJob, adviseProposalStrategy and enhanceProposal use    │
// │   the unpinned structured() full waterfall — no fixed role.)             │
// └──────────────────────────────────────────────────────────────────────────┘
export const PROVIDER_ROLES = {
  writer: "anthropic",     // Claude Sonnet — craftHookLine, generateProposal, strategy doc, applyProposalEdit, conversion replies, contest brief, scout outreach, intelligence Engines 3 & 4
  analyzer: "google",      // Gemini  — analyzeJob (fallback), analyzeClientWebsite, intelligence Engines 1 & 2
  verifier: "google",      // Gemini  — analyzeHookStrength, polishProposal, injectPortfolioLinks, specificity gate
  challenger: "mistral",   // Mistral — generateMilestones, generateAiHookStrategy, craftCtaLine, generateProfileSections
} as const;

export type ProviderRole = keyof typeof PROVIDER_ROLES;

// ─── Provider registry ────────────────────────────────────────────────────────

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
        // Sonnet 5 — the writer role produces all client-facing prose, so it runs on a
        // model strong enough to exploit the specificity gate + founder-psychology prompting.
        // The @ai-sdk/anthropic model string is passed straight to the Anthropic API; the
        // Claude 5 family uses no date suffix.
        return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })("claude-sonnet-5");
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

  // Cerebras — OpenAI-compatible, ultra-fast wafer-scale inference
  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: "Cerebras",
      load: async () => {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return createOpenAI({
          apiKey: process.env.CEREBRAS_API_KEY!,
          baseURL: "https://api.cerebras.ai/v1",
        })("llama-3.3-70b");
      },
    });
  }

  // Fireworks AI — OpenAI-compatible, fast open model inference
  if (process.env.FIREWORKS_API_KEY) {
    providers.push({
      name: "Fireworks AI",
      load: async () => {
        const { createOpenAI } = await import("@ai-sdk/openai");
        return createOpenAI({
          apiKey: process.env.FIREWORKS_API_KEY!,
          baseURL: "https://api.fireworks.ai/inference/v1",
        })("accounts/fireworks/models/llama-v3p1-70b-instruct");
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

// ─── Core waterfall functions ─────────────────────────────────────────────────

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
      const { text } = await generateText({ model, system: params.system, prompt: params.prompt });
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  const lastError = errors[errors.length - 1] ?? "Unknown error";
  if (lastError.includes("402") || lastError.includes("Payment") || lastError.includes("credit")) {
    throw new Error("All AI providers exhausted or out of credits. Add a new API key in Lovable Cloud → Settings → Secrets.");
  }
  throw new Error(`All AI providers failed. Last error: ${lastError}`);
}

export async function generateObjectWithFallback<T>(params: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const providers = buildProviders();

  if (providers.length === 0) {
    throw new Error("No AI provider configured. Add at least one API key in Lovable Cloud → Settings → Secrets.");
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const model = await provider.load();
      const { object } = await generateObject({ model, schema: params.schema, system: params.system, prompt: params.prompt });
      return object;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  throw new Error(`AI structured output failed. Last error: ${errors[errors.length - 1] ?? "Unknown"}`);
}

// ─── Role-routed functions ────────────────────────────────────────────────────

/**
 * Routes structured output to the designated provider role.
 * Falls back to the full waterfall if the provider is unavailable.
 */
export async function generateObjectWithProvider<T>(role: ProviderRole, params: {
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
      // Fall through to waterfall
    }
  }

  return generateObjectWithFallback(params);
}

/**
 * Routes text generation to the designated provider role.
 * Falls back to the full waterfall if the provider is unavailable.
 */
export async function generateWithProvider(role: ProviderRole, params: {
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
      // Fall through to waterfall
    }
  }

  return generateWithFallback(params);
}

// ─── Specificity gate ─────────────────────────────────────────────────────────

/**
 * Runs after Claude generates a proposal. Uses Gemini Flash (verifier) to score
 * specificity and entity usage. Returns null if unavailable — never blocks generation.
 */
export async function verifyOutput(params: {
  proposal: string;
  jobDescription: string;
  extractedEntities: string[];
}): Promise<{ specificity: number; genericPhraseCount: number; entityUsage: number; complaint: string } | null> {
  try {
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
    const verifier = allProviders.find((p) => p.name.toLowerCase().includes("google"));
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

GENERIC PHRASE COUNT: Count phrases that could appear in ANY proposal regardless of job.

ENTITY USAGE: Count how many extracted entities actually appear in the proposal (exact or paraphrase).

COMPLAINT: If specificity < 7, write one concrete sentence about what's missing. Otherwise write "Pass."`,
      prompt: `Job post:\n${params.jobDescription.slice(0, 3000)}${entityList}\n\nProposal to audit:\n${params.proposal.slice(0, 4000)}`,
    });

    return object;
  } catch {
    return null;
  }
}
