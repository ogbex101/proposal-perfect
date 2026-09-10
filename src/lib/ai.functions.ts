import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback, generateWithProvider, generateObjectWithFallback, generateObjectWithProvider, verifyOutput, verifyFactualClaims } from "./ai-gateway.server";
import { z } from "zod";
import { CTAS, FORBIDDEN_PHRASES, HOOKS, LENGTHS, STRATEGIES } from "./proposal-constants";
import { redFlagPromptBlock, scrubRedFlags } from "./red-flags";
import { runProposalIntelligencePipeline, type ProposalIntelligenceObject, type ProposalBlueprint } from "./proposal-intelligence";
import { saveProposalMemoryInternal } from "./proposal-memory.functions";
import { REGISTERS, resolveRegister } from "./prompts/shared/registers";
import { goldenKeyById } from "./prompts/shared/golden-keys";

// Load a user's custom red-flag phrases. Defaults always apply regardless;
// this only adds the user's own phrases. Wrapped so a missing table never
// breaks generation.
async function loadCustomFlags(context: { supabase: any; userId: string }): Promise<string[]> {
  try {
    const { data: rfRows } = await context.supabase
      .from("red_flag_words")
      .select("phrase")
      .eq("user_id", context.userId);
    return (rfRows ?? []).map((r: { phrase: string }) => r.phrase);
  } catch {
    /* table may not exist yet; defaults still apply */
    return [];
  }
}

function handleAiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) throw new Error("Rate limit hit. Please wait a moment and try again.");
  if (msg.includes("402")) throw new Error("AI credits exhausted. Please add credits to continue.");
  throw new Error(msg);
}

/**
 * Find an item by id in one of the static vocabularies (HOOKS / STRATEGIES / CTAS).
 * If the id doesn't match — which almost always means the AI-chosen id has drifted
 * out of sync with proposal-constants.ts — log a loud warning and fall back to the
 * first entry, so a future ID mismatch is caught immediately instead of silently
 * degrading proposal quality.
 */
function findOrWarn<T extends { id: string }>(
  list: readonly T[],
  id: string | undefined,
  vocab: string,
): T {
  const found = id ? list.find((item) => item.id === id) : undefined;
  if (!found) {
    console.warn(
      `[proposal-vocab] ${vocab} id "${id ?? "(none)"}" not found — falling back to "${list[0].id}". ` +
        `This means Engine 4 / the UI produced an id that isn't in proposal-constants.ts. Fix the vocabulary drift.`,
    );
    return list[0];
  }
  return found;
}

/**
 * Trim text to at most `max` characters without ever cutting inside a URL.
 * Prefers to cut at the last sentence end before the limit; if the natural cut
 * point would land inside an http(s)/www token, it backs up to before that token.
 */
function urlSafeTrim(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  // Prefer a sentence boundary.
  const lastPunct = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (lastPunct > max * 0.4) cut = cut.slice(0, lastPunct + 1);
  // If we cut inside a URL token, back up to just before that token starts.
  const urlRe = /(https?:\/\/|www\.)\S*$/i;
  const m = cut.match(urlRe);
  if (m) {
    // The trailing token is a (now truncated) URL — drop it entirely rather than
    // emit a broken link.
    cut = cut.slice(0, m.index).trimEnd();
  }
  return cut.trimEnd();
}

/**
 * Plain-text JSON approach: ask the model for raw JSON, strip any markdown
 * fences the model might add, then parse + validate against the Zod schema.
 * This works with every gateway/model — no SDK structured-output features needed.
 */
async function structured<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  // PROVIDER ROUTING: this default function uses the full waterfall.
  // Use structuredWith() to pin a task to a specific provider role.
  // Primary: native AI SDK structured output — enforces schema at model level (JSON mode / tool use)
  // This eliminates "malformed JSON" errors entirely for providers that support it.
  try {
    return await generateObjectWithFallback({ system, prompt, schema });
  } catch {
    // Providers that don't support generateObject fall through to text-based extraction below
  }

  // Fallback: text generation + JSON extraction
  const text = await generateWithFallback({
    system:
      system +
      "\n\nCRITICAL: Your entire response must be a single valid JSON object — no markdown, no code fences, no commentary before or after. Start with { and end with }.",
    prompt,
  });

  function extractJson(src: string): unknown {
    const attempts: string[] = [
      src.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim(),
      src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1).trim(),
      src.slice(src.indexOf("["), src.lastIndexOf("]") + 1).trim(),
    ];
    for (const candidate of attempts) {
      if (!candidate) continue;
      try { return JSON.parse(candidate); } catch { /* try next */ }
    }
    const m = src.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    throw new Error("AI returned malformed JSON. Please try again.");
  }
  const raw = extractJson(text);

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("AI response did not match the expected format. Please try again.");
  }
  return parsed.data;
}

/**
 * Like structured(), but routes to a specific provider role first.
 * - 'verifier' → Gemini Flash (fast, free, great at structured extraction)
 * - 'writer'   → Claude (best prose quality)
 * - 'challenger' → Mistral (alternative perspective)
 */
async function structuredWith<T>(role: import("./ai-gateway.server").ProviderRole, schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  try {
    return await generateObjectWithProvider(role, { system, prompt, schema });
  } catch {
    // fall back to full waterfall
  }
  return structured(schema, system, prompt);
}

// ---------- Analyze Job ----------
const AnalysisSchema = z.object({
  summary: z.string(),
  painPoint: z.string(),
  hiddenNeeds: z.string(),
  technicalDifficulties: z.array(z.object({ title: z.string(), explanation: z.string() })),
  recommendedApproach: z.string(),
  suggestedHookId: z.string(),
  hookReason: z.string(),
  hookSuggestions: z.array(z.object({
    hookId: z.string(),
    hookName: z.string(),
    openingLine: z.string(),
    score: z.number().int().min(1).max(100),
    scoreReason: z.string(),
  })).default([]),
  suggestedStrategyId: z.string(),
  strategyReason: z.string(),
  suggestedCtaId: z.string().default("soft_availability"),
  ctaReason: z.string().default(""),
  ctaSuggestions: z.array(z.object({
    ctaId: z.string(),
    ctaName: z.string(),
    closingLine: z.string(),
    score: z.number().int().min(1).max(100),
    scoreReason: z.string(),
  })).default([]),
  detectedLanguage: z.string().default("English"),
  suggestedLength: z.enum(["brief", "robust", "explanatory"]).default("robust"),
  detectedNiche: z.string().default(""),
  extractedEntities: z.array(z.string()).default([]),
  strategyWorthy: z.boolean().default(true),
  strategyWorthyReason: z.string().default(""),
  // True when the 4-engine intelligence pipeline failed and this analysis came from
  // the legacy single-engine fallback (no `intelligence`, weaker hook/strategy/CTA,
  // no Golden Key). The UI surfaces this so the user knows why quality may differ.
  usedFallbackEngine: z.boolean().default(false),
});
export type JobAnalysis = z.infer<typeof AnalysisSchema>;

export const analyzeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string }) =>
    z.object({ jobDescription: z.string().min(20).max(15000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      // Run the full 4-engine intelligence pipeline first
      const intelligence = await runProposalIntelligencePipeline(data.jobDescription);
      const bp = intelligence.proposalBlueprint;
      const ci = intelligence.clientIntelligence;
      const biz = intelligence.businessIntelligence;
      const psych = intelligence.psychology;

      // Map intelligence output back to the existing JobAnalysis shape for UI compatibility.
      // The full intelligence object is also returned for use in generateProposal.
      // Engine 4 produces 3 genuinely different hook options in bp.alternativeHooks —
      // read them directly and resolve each hookId to its static HOOKS name for the UI.
      const hookSuggestions = (bp.alternativeHooks ?? []).map((alt) => {
        const h = findOrWarn(HOOKS, alt.hookId, "HOOKS");
        return {
          hookId: h.id,
          hookName: h.name,
          openingLine: alt.openingLine,
          score: alt.score,
          scoreReason: alt.scoreReason,
        };
      });
      if (hookSuggestions.length === 0) {
        const mapped = findOrWarn(HOOKS, bp.mappedHookId, "HOOKS");
        hookSuggestions.push({
          hookId: mapped.id,
          hookName: mapped.name,
          openingLine: bp.openingLine,
          score: 92,
          scoreReason: "Primary strategy from intelligence pipeline",
        });
      }

      const mappedCta = findOrWarn(CTAS, bp.mappedCtaId, "CTAS");
      const ctaSuggestions = [{
        ctaId: mappedCta.id,
        ctaName: mappedCta.name,
        closingLine: bp.ctaLine,
        score: 92,
        scoreReason: "Derived from client psychology analysis",
      }];

      const analysis: JobAnalysis & { intelligence: ProposalIntelligenceObject } = {
        summary: biz.coreBusinessInsight ?? ci.projectSummary,
        painPoint: biz.coreBusinessProblem,
        hiddenNeeds: psych.realReasonForHiring,
        technicalDifficulties: (ci.technicalRequirements ?? []).slice(0, 4).map((t: string) => ({
          title: t,
          explanation: `Technical requirement identified from job post`,
        })),
        recommendedApproach: bp.proposalMandates?.join(" ") ?? biz.coreBusinessInsight,
        suggestedHookId: bp.mappedHookId,
        hookReason: `${bp.primaryStrategy} strategy selected by intelligence pipeline`,
        hookSuggestions,
        suggestedStrategyId: bp.mappedStrategyId,
        strategyReason: biz.coreBusinessInsight,
        suggestedCtaId: bp.mappedCtaId,
        ctaReason: `CTA derived from client psychology: ${psych.primaryDesire}`,
        ctaSuggestions,
        detectedLanguage: ci.detectedLanguage ?? "English",
        suggestedLength: "robust",
        detectedNiche: ci.detectedNiche ?? "",
        extractedEntities: [
          ...ci.namedTools ?? [],
          ...ci.namedCompanies ?? [],
          ...(ci.technicalRequirements ?? []).slice(0, 3),
        ].slice(0, 10),
        strategyWorthy: intelligence.overallConfidence >= 70,
        strategyWorthyReason: intelligence.requiresHumanReview
          ? `Confidence ${intelligence.overallConfidence.toFixed(0)}% — human review recommended`
          : `Confidence ${intelligence.overallConfidence.toFixed(0)}% — high-quality analysis`,
        usedFallbackEngine: false,
        intelligence,
      };

      return analysis;
    } catch (err) {
      // The 4-engine intelligence pipeline threw. Log the REAL error in full before
      // falling back, so we can diagnose which engine/schema is failing (Fix 0 step 4).
      console.error(
        "[analyzeJob] intelligence pipeline failed — falling back to legacy single-engine analysis. Original error:",
        err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : err,
      );
      // Fall back to legacy single-engine analysis if pipeline fails
      try {
        const hookList = HOOKS.map((h) => `- ${h.id}: ${h.name} — ${h.description}`).join("\n");
        const strategyList = STRATEGIES.map((s) => `- ${s.id}: ${s.name} — ${s.description}`).join("\n");
        const ctaList = CTAS.map((c) => `- ${c.id}: ${c.name} — ${c.description}`).join("\n");
        const legacy = await structuredWith(
          "analyzer",
          AnalysisSchema,
        `You are an expert freelance proposal strategist who has won hundreds of proposals. Your analysis is what separates winning proposals from generic ones. You must read between the lines.

DEEP ANALYSIS REQUIREMENTS:
1. PAIN POINT: What is the client's REAL problem (not what they said, but what they mean)? Why is this urgent NOW? What is the downstream cost if it stays unsolved?
2. HIDDEN NEEDS: What has the client NOT said but clearly needs? What are they afraid of? What does "success" actually look like to them beyond the deliverable?
3. WHAT WILL WIN THIS PROPOSAL: Based on this specific job post — what ONE insight, angle, or approach would make the client think "this person understands my situation"? Not generic advice — specific to THIS job.
4. WHAT TO AVOID: What generic responses will this client receive from everyone else? What should you NOT say to stand out?
5. TECHNICAL DIFFICULTIES: What are the actual hard parts of this project that a junior freelancer would underestimate?
6. HOOK SELECTION: Choose hooks that feel like genuine insights about THEIR situation — not clever openers. The openingLine must be a sentence the client would read and think "how did they know that?"
7. STRATEGY SELECTION: The strategy should define the ENTIRE proposal arc — not just the opening.
8. CTA SELECTION: The CTA should match the client's decision-making style evident from how they wrote the job post.
9. ENTITY EXTRACTION: Pull out every concrete, specific anchor from the job post — named tools (e.g. "Webflow", "Stripe", "Notion"), exact numbers ("10,000 subscribers", "$5k budget", "2-week deadline"), client's exact phrasing of their problem, proper nouns (company name, product name), and explicit constraints. These become grounding requirements for the proposal. Minimum 4 entities, maximum 10.
10. HOOK SELECTION — this is critical. Do NOT default to "Sharp Observation" (i_noticed) for every job. Match the hook to the client's emotional state and job type:
  - Use "Red Flag Warning" when the client's approach has an obvious flaw they haven't spotted
  - Use "Cost of Inaction" when the problem is clearly costing them money or users right now
  - Use "Curiosity Gap" when you can tease a specific insight from their industry that they'd value
  - Use "Founder Mode" for founder-run businesses where the stakes are personal
  - Use "Pattern Interrupt" for overposted job types (logos, basic websites, content writing) where standing out is everything
  - Use "Future Pacing" when the outcome is vivid and easy to paint (launches, redesigns, revenue uplift)
  - Use "Stack Realist" when the job has technical realities the client is probably underestimating
  - Use "Sharp Observation" ONLY when there is a genuinely specific, non-obvious detail worth pointing out
  - The hookSuggestions array MUST have 3 different hooks — never repeat the same one
11. STRATEGY DOCUMENT WORTHINESS: Decide if this job deserves a strategy document.
  WORTHY (strategyWorthy: true): multi-phase projects, budget implied or stated over $500, complex technical builds (web app, SaaS, custom software, full redesign), long-term or retainer work, sophisticated clients who write detailed posts.
  NOT WORTHY (strategyWorthy: false): simple quick-turnaround tasks (logo tweak, copy edit, one-page site, small bug fix, content writing under $200, VA tasks), jobs where the client signals they want fast delivery over depth, anything that would be over-engineered by a strategy doc.
  Be honest — a strategy doc on a $50 task wastes everyone's time and signals poor judgment.

Be ruthlessly specific. Every answer must reference details from THIS job post. No generic observations.

Choose the best matching hook id, strategy id, AND cta id from these exact lists:
HOOKS:
${hookList}
STRATEGIES:
${strategyList}
CTAS (closing call-to-action styles):
${ctaList}

Return a JSON object with these exact keys:
{
  "summary": "...",
  "painPoint": "...",
  "hiddenNeeds": "...",
  "technicalDifficulties": [{"title": "...", "explanation": "..."}],
  "recommendedApproach": "...",
  "suggestedHookId": "<the #1 best hook id from list>",
  "hookReason": "...",
  "hookSuggestions": [
    {
      "hookId": "<exact hook id from list>",
      "hookName": "<hook name>",
      "openingLine": "<a ready-to-use opening sentence or two the freelancer can paste directly — specific to THIS job, not generic>",
      "score": <integer 1-100>,
      "scoreReason": "<one sentence: why this score>"
    },
    {
      "hookId": "<second best hook id — different from first>",
      "hookName": "<hook name>",
      "openingLine": "<ready-to-use opening line for this job>",
      "score": <integer 1-100>,
      "scoreReason": "..."
    },
    {
      "hookId": "<third hook id — different from first two>",
      "hookName": "<hook name>",
      "openingLine": "<ready-to-use opening line for this job>",
      "score": <integer 1-100>,
      "scoreReason": "..."
    }
  ],
  "suggestedStrategyId": "<exact id from list>",
  "strategyReason": "...",
  "suggestedCtaId": "<exact cta id from list>",
  "ctaReason": "<one sentence: why this CTA fits this specific job and client>",
  "ctaSuggestions": [
    {
      "ctaId": "<exact cta id from list>",
      "ctaName": "<cta name>",
      "closingLine": "<a ready-to-use closing sentence or two — specific to THIS job, not generic>",
      "score": <integer 1-100>,
      "scoreReason": "<one sentence: why this score>"
    },
    {
      "ctaId": "<second cta id — different from first>",
      "ctaName": "<cta name>",
      "closingLine": "<ready-to-use closing line>",
      "score": <integer 1-100>,
      "scoreReason": "..."
    },
    {
      "ctaId": "<third cta id — different from first two>",
      "ctaName": "<cta name>",
      "closingLine": "<ready-to-use closing line>",
      "score": <integer 1-100>,
      "scoreReason": "..."
    }
  ],
  "detectedLanguage": "<full English name of the language this job post is written in>",
  "suggestedLength": "<brief|robust|explanatory>",
  "detectedNiche": "<the primary freelance niche>",
  "extractedEntities": ["<specific tool/tech name>", "<exact number or metric>", "<client's exact pain point phrase>", "<proper noun>", "<explicit constraint>"],
  "strategyWorthy": <true if this job deserves a strategy document, false if it's too simple>,
  "strategyWorthyReason": "<one sentence explaining why a strategy doc is or isn't appropriate for this specific job>"
}

IMPORTANT for hookSuggestions / ctaSuggestions: The openingLine and closingLine must be specific, concrete sentences written for THIS job — not templates. Ready to paste directly. Score 85-100 = excellent fit, 70-84 = good fit, 50-69 = workable.${redFlagPromptBlock()}`,
          `Analyze this job post:\n\n${data.jobDescription}`,
        );
        // Flag the fallback so the UI can tell the user quality will differ and the
        // Golden Key card won't appear (no intelligence object on this path).
        return { ...legacy, usedFallbackEngine: true };
      } catch (fallbackErr) {
        handleAiError(fallbackErr);
      }
    }
  });

// ---------- Generate Milestones ----------
const MilestonesSchema = z.object({
  milestones: z.array(
    z.object({ title: z.string(), description: z.string(), amount: z.string().optional() }),
  ),
});

export const generateMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; budget?: string }) =>
    z.object({ jobDescription: z.string().min(10), budget: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const result = await structuredWith("challenger",
        MilestonesSchema,
        `Create 2-4 sensible project milestones. Each has a short title and a one-sentence deliverable description. If a budget is given, distribute amounts realistically; otherwise omit amount.

Return a JSON object with this exact shape:
{
  "milestones": [
    {"title": "...", "description": "...", "amount": "..."},
    ...
  ]
}
Omit "amount" if no budget was given.`,
        `Job:\n${data.jobDescription}\n\nBudget: ${data.budget || "not provided"}`,
      );
      return result.milestones;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Generate AI Hook + Strategy ----------
const AiHookStrategySchema = z.object({
  hookName: z.string(),
  hookOpeningLine: z.string(),
  hookRationale: z.string(),
  strategyName: z.string(),
  strategyApproach: z.string(),
  strategyRationale: z.string(),
});
export type AiHookStrategy = z.infer<typeof AiHookStrategySchema>;

export const generateAiHookStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; analysis?: unknown }) =>
    z.object({
      jobDescription: z.string().min(10).max(15000),
      analysis: z.any().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      return await structuredWith("challenger",
        AiHookStrategySchema,
        `You are a senior brand strategist and business consultant writing for a freelancer who needs to stand out from 50 identical bids.

Your job is NOT to rewrite the standard proposal in a different tone.
Your job is to produce something that feels like it was written by someone who thought deeply about this client's business before submitting anything.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CORE DIFFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Standard proposal → describes what will be built.
Hook & Strategy proposal → explains WHY it should be built, WHO it's for, and WHAT it unlocks commercially.

The difference must be immediately obvious when reading both side by side.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE HOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The first sentence must make the client stop and think. It should feel like it was written specifically for them.

NEVER open with:
- "I noticed..." / "I reviewed..." / "I looked through..." / "I saw your project..."
- "Your website..." (leads with critique before establishing credibility)
- "I" as the first word
- Anything generic that works for any client

INSTEAD, do ONE of these:
- Ask a thoughtful question that reveals what the client is actually trying to solve beneath the stated request
- Name the hidden business problem (a redesign request = positioning problem; landing page = conversion problem; CMS = ownership/scalability problem)
- Identify a contradiction between what they asked for and what their business actually needs
- Show understanding of the founder's psychology — their worry, their ambition, what winning looks like for them
- Point to a specific non-obvious insight from the brief that most applicants would miss

NEVER critique first. If referencing the current site, acknowledge what's working before identifying the opportunity to elevate it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The strategy must explain the reasoning behind the approach — not list deliverables or phases.

Focus on:
- Messaging hierarchy — what to lead with and why
- Information architecture — what the visitor needs to understand, in what order
- Trust building — what signals credibility for this specific audience
- Conversion flow — where the decision point is and how to guide toward it
- Brand positioning — what makes this client different and how to make that viscerally obvious
- User psychology — what the target audience actually fears, wants, and responds to

The strategy must show understanding of the founder's positioning, audience, and business model — not generic structural advice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO AVOID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Any opener that works for any other client
- Summarizing what the client said in the job post
- Design observations without business implications
- Vague advice like "build trust and show expertise"
- Generic marketing language: modern, clean, user-friendly, professional, sleek, stunning, seamless, cutting-edge

Return a JSON object with this exact shape:
{
  "hookName": "<short memorable name for this hook, 2-4 words>",
  "hookOpeningLine": "<the actual opening 2-3 sentences — psychologically sharp, business-specific, reads like a senior consultant, ready to paste>",
  "hookRationale": "<why this specific hook creates 'they understand my business' recognition — not generic praise>",
  "strategyName": "<short memorable name for this strategy, 2-4 words>",
  "strategyApproach": "<describe exactly how the proposal should flow from hook to CTA — focused on reasoning, not deliverables, specific to this client's real business problem>",
  "strategyRationale": "<why this structure earns trust with this specific client — what psychological principle it activates and why>"
}`,
        `Job post:\n${data.jobDescription}\n\n${data.analysis ? `Analysis:\n${JSON.stringify(data.analysis, null, 2)}` : ""}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Hook Strength Analyzer ----------
const HookStrengthSchema = z.object({
  score: z.number().min(1).max(10),
  verdict: z.string(),
  strengths: z.array(z.string()).max(3),
  weaknesses: z.array(z.string()).max(3),
  rewrite: z.string(),
  rewriteRationale: z.string(),
});
export type HookStrength = z.infer<typeof HookStrengthSchema>;

export const analyzeHookStrength = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hookText: string; jobDescription: string }) =>
    z.object({
      hookText: z.string().min(10).max(2000),
      jobDescription: z.string().min(10).max(15000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      return await structuredWith("verifier",
        HookStrengthSchema,
        `You are a proposal conversion expert. You score the opening paragraph of a freelance proposal.

Scoring criteria (each worth up to 2 points):
1. Specificity — does it reference concrete details from the job post?
2. Insight — does it reveal understanding deeper than what the client wrote?
3. Pattern interrupt — does it open in a surprising, non-generic way?
4. Client focus — is it about the client's outcome, not the freelancer's skills?
5. Compellingness — would a busy client stop scanning and actually read this?

After scoring, write a BETTER version of the hook that scores 9-10.

Return a JSON object with this exact shape:
{
  "score": <integer 1-10>,
  "verdict": "<one punchy sentence summarizing the quality>",
  "strengths": ["<what works>", ...],
  "weaknesses": ["<what kills it>", ...],
  "rewrite": "<the improved hook opening paragraph — ready to paste>",
  "rewriteRationale": "<one sentence explaining what you changed and why>"
}`,
        `Job post:\n${data.jobDescription}\n\nHook paragraph to score:\n${data.hookText}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Craft Hook Paragraph (Claude — writer) ----------
export const craftHookLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; analysis?: unknown; hookId: string }) =>
    z.object({
      jobDescription: z.string().min(10).max(15000),
      analysis: z.any().optional(),
      hookId: z.string(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const hook = findOrWarn(HOOKS, data.hookId, "HOOKS");
      const a = data.analysis as JobAnalysis | null;
      const context = a
        ? `Pain point: ${a.painPoint}\nHidden needs: ${a.hiddenNeeds}\nRecommended approach: ${a.recommendedApproach}\nEntities: ${(a.extractedEntities ?? []).join(", ")}`
        : "";
      return await structuredWith(
        "writer",
        z.object({ hookParagraph: z.string() }),
        `You write the opening paragraph of a freelance proposal. This is the most important paragraph — it determines whether the client reads the rest.

Hook technique: "${hook.name}" — ${hook.description}

WHAT THE HOOK MUST DO:
The first sentence must make the client stop and think. It should feel like it was written specifically for them — impossible to send to another client by simply changing the name.

NEVER open with:
- "I noticed..." / "I reviewed..." / "I looked through..." / "I saw your project..."
- "Your website..." (leads with critique before establishing credibility)
- "I" as the first word — it signals the pitch is about the freelancer, not the client
- Generic observation that works for any job ("great opportunity", "interesting project")

INSTEAD, open by doing ONE of these:
- Ask a thoughtful question that reveals you understood what the client is actually trying to solve
- Name a hidden business problem behind the request (a redesign is usually a positioning problem; a landing page is usually a conversion problem; a CMS request is usually a scalability problem)
- Identify a contradiction between what the client wants and what their current situation communicates
- Show understanding of the founder's psychology — what they're worried about, what success looks like for them
- Point to a specific insight from the brief that most applicants would miss

INFER THE REAL PROBLEM: Don't describe what was asked for. Infer what business outcome the client actually needs.

RULES:
- 2-4 sentences only
- Every sentence advances a new idea — no filler
- Reference at least one specific detail from the job post
- Sounds like a senior consultant who has solved this exact problem before — calm, precise, not pitching
- No generic marketing language (modern, clean, user-friendly, professional, stunning, beautiful)
- NO FABRICATION: never invent a statistic, percentage, past project, case study, or named client result that isn't in the job post or context. Prove expertise by naming the mechanism of their problem, not by manufacturing numbers or projects.

Return JSON: { "hookParagraph": "<the opening paragraph — 2-4 sentences, ready to paste>" }`,
        `Job post:\n${data.jobDescription}\n\n${context}`,
      );
    } catch (err) { handleAiError(err); }
  });

// ---------- Craft CTA Line (Mistral — challenger) ----------
export const craftCtaLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; analysis?: unknown; ctaId: string }) =>
    z.object({
      jobDescription: z.string().min(10).max(15000),
      analysis: z.any().optional(),
      ctaId: z.string(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const cta = findOrWarn(CTAS, data.ctaId, "CTAS");
      const a = data.analysis as JobAnalysis | null;
      const context = a ? `Pain point: ${a.painPoint}\nHidden needs: ${a.hiddenNeeds}` : "";
      return await structuredWith(
        "challenger",
        z.object({ ctaLine: z.string() }),
        `You write the closing line (1-2 sentences) of a freelance proposal. This is the last thing the client reads — it determines whether they reply.

CTA style: "${cta.name}" — ${cta.description}

THE CLOSING MUST ALWAYS END WITH A QUESTION. This is mandatory with no exceptions.

❌ FORBIDDEN — never end with any of these:
"I'd love to hear your thoughts."
"Looking forward to hearing from you."
"Let me know." / "Happy to discuss." / "Feel free to reach out."
"I can build this for you." / "I'll deliver X, Y, and Z."
Any statement. Any deliverable description. Any sentence without a question mark.

✅ REQUIRED — end with a meaningful question directly tied to the client's project, goals, or priorities:
"Would you rather evolve the existing brand or take it in a completely new direction?"
"Is improving trust your biggest priority, or is generating more enquiries the immediate goal?"
"Does this direction feel aligned with what you're hoping to achieve?"
"Which matters most right now — hitting the deadline or getting the full feature set in v1?"

The question must:
- Be specific to THIS job — impossible to copy-paste into another proposal
- Invite a genuine reply, not a yes/no
- Sound natural and conversational — not formal or salesy
- Reference a specific detail from the job post (their timeline, tool, goal, constraint, or audience)
- NO FABRICATION: never reference an invented statistic, past project, or client result. Only real details from the job post.

Return JSON: { "ctaLine": "<1-2 sentences, MUST end with a question mark>" }`,
        `Job post:\n${data.jobDescription}\n\n${context}`,
      );
    } catch (err) { handleAiError(err); }
  });

// ---------- Generate Proposal ----------
const ProposalSchema = z.object({
  content: z.string(),
  explanation: z.object({
    hook: z.string(),
    strategy: z.string(),
    question: z.string(),
  }),
});

// Result of the post-generation fabrication guard, attached to the returned proposal.
export type ProposalFactCheck = {
  flagged: Array<{ claim: string; reason: string }>;
  allTraceable: boolean;
  remediated: boolean; // true if an auto-rewrite removed fabricated claims
};

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    jobDescription: string;
    analysis?: (JobAnalysis & { intelligence?: ProposalIntelligenceObject }) | null;
    intelligence?: ProposalIntelligenceObject | null;
    hookId: string;
    strategyId: string;
    ctaId?: string;
    customHookText?: string;
    customStrategyText?: string;
    length: "brief" | "robust" | "explanatory";
    includePlan: boolean;
    portfolioItems: Array<{ title: string; url: string; description: string }>;
    milestones?: Array<{ title: string; description: string; amount?: string }>;
    budget?: string;
    targetLanguage?: string;
    strategyDocument?: string;
    toneAssertiveness?: number;
    toneFormalness?: number;
    extractedEntities?: string[];
    craftedHookParagraph?: string;
    craftedCtaLine?: string;
    platform?: string;
  }) =>
    z.object({
      jobDescription: z.string().min(10),
      analysis: z.any().optional().nullable(),
      hookId: z.string(),
      strategyId: z.string(),
      ctaId: z.string().optional(),
      customHookText: z.string().optional(),
      customStrategyText: z.string().optional(),
      length: z.enum(["brief", "robust", "explanatory"]),
      includePlan: z.boolean(),
      portfolioItems: z.array(
        z.object({ title: z.string(), url: z.string(), description: z.string() }),
      ),
      milestones: z
        .array(z.object({ title: z.string(), description: z.string(), amount: z.string().optional() }))
        .optional(),
      budget: z.string().optional(),
      targetLanguage: z.string().optional(),
      strategyDocument: z.string().max(5000).optional(),
      toneAssertiveness: z.number().min(1).max(5).optional(),
      toneFormalness: z.number().min(1).max(5).optional(),
      extractedEntities: z.array(z.string()).optional(),
      craftedHookParagraph: z.string().max(1000).optional(),
      craftedCtaLine: z.string().max(500).optional(),
      intelligence: z.any().optional().nullable(),
      platform: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context as any;
      const customFlags = await loadCustomFlags(context);

      // Resolve intelligence — from explicit field or nested in analysis
      const intelligence: ProposalIntelligenceObject | null =
        (data as any).intelligence ?? (data.analysis as any)?.intelligence ?? null;
      // Use AI-generated custom text if provided, otherwise fall back to preset lists
      const hookLabel = data.craftedHookParagraph
        ? `PRE-CRAFTED OPENING — use this EXACTLY as your first paragraph: "${data.craftedHookParagraph}"`
        : data.customHookText
        ? `AI-Generated Custom Hook — ${data.customHookText}`
        : (() => { const h = findOrWarn(HOOKS, data.hookId, "HOOKS"); return `${h.name} — ${h.description}`; })();
      const strategyLabel = data.customStrategyText
        ? `AI-Generated Custom Strategy — ${data.customStrategyText}`
        : (() => { const s = findOrWarn(STRATEGIES, data.strategyId, "STRATEGIES"); return `${s.name} — ${s.description}`; })();
      const cta = findOrWarn(CTAS, data.ctaId, "CTAS");
      const craftedCtaValid = data.craftedCtaLine?.trimEnd().endsWith("?");
      const ctaLabel = data.craftedCtaLine && craftedCtaValid
        ? `PRE-CRAFTED CLOSING — use this EXACTLY as your final sentence(s): "${data.craftedCtaLine}"`
        : `${cta.name} — ${cta.description}`;
      const hook = findOrWarn(HOOKS, data.hookId, "HOOKS");
      const strategy = findOrWarn(STRATEGIES, data.strategyId, "STRATEGIES");
      const length = LENGTHS.find((l) => l.id === data.length) ?? LENGTHS[1];

      const portfolioBlock = data.portfolioItems.length
        ? `PORTFOLIO ITEMS (MANDATORY — include ALL of these in the proposal body):
${data.portfolioItems.map((p) => {
  const isPortfolioPage = p.title.toLowerCase().includes("portfolio") || p.description?.toLowerCase().includes("tailored portfolio") || p.description?.toLowerCase().includes("portfolio tailored");
  return isPortfolioPage
    ? `- PORTFOLIO PAGE: ${p.url} — "${p.title}": Reference this as "my portfolio for this type of work" or "a portfolio I put together specifically for [their industry/need]". This is a full portfolio page with multiple samples — NOT a single piece.`
    : `- SAMPLE WORK: ${p.url} — "${p.title}": ${p.description} — Reference this as a specific past project or work sample.`;
}).join("\n")}`
        : "No portfolio items provided.";
      const milestoneBlock = data.milestones?.length
        ? `Milestones:\n${data.milestones.map((m) => `- ${m.title}${m.amount ? ` (${m.amount})` : ""}: ${m.description}`).join("\n")}`
        : "";
      const analysisBlock = data.analysis
        ? `Job analysis:\n${JSON.stringify(data.analysis, null, 2)}`
        : "";

      // Intelligence block — drives proposal if pipeline ran
      const intelligenceBlock = intelligence
        ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROPOSAL INTELLIGENCE (DO NOT IGNORE — USE ALL OF THIS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENT INTELLIGENCE:
- Personality: ${intelligence.clientIntelligence.personality}
- Emotional state: ${intelligence.clientIntelligence.emotionalState}
- Hiring maturity: ${intelligence.clientIntelligence.hiringMaturity}
- Decision style: ${intelligence.clientIntelligence.decisionStyle}
- Budget sensitivity: ${intelligence.clientIntelligence.budgetSensitivity}
- Risk tolerance: ${intelligence.clientIntelligence.riskTolerance}
- Hidden frustrations: ${intelligence.clientIntelligence.hiddenFrustrations?.join("; ")}
- Hidden expectations: ${intelligence.clientIntelligence.hiddenExpectations?.join("; ")}
- Evidence (verbatim quotes from post): ${intelligence.clientIntelligence.evidenceQuotes?.join(" | ")}

BUSINESS INTELLIGENCE:
- Core business problem: ${intelligence.businessIntelligence.coreBusinessProblem}
- Business opportunity: ${intelligence.businessIntelligence.businessOpportunity}
- Business risk: ${intelligence.businessIntelligence.businessRisk}
- Core business insight: ${intelligence.businessIntelligence.coreBusinessInsight}

CLIENT PSYCHOLOGY:
- Primary fear: ${intelligence.psychology.primaryFear}
- Primary desire: ${intelligence.psychology.primaryDesire}
- Urgency driver: ${intelligence.psychology.urgencyDriver}
- Real reason for hiring: ${intelligence.psychology.realReasonForHiring}
- What will make them reply: ${intelligence.psychology.whatWillMakeThemReply}
- What will make them ignore: ${intelligence.psychology.whatWillMakeThemIgnore}
- What will make them hire: ${intelligence.psychology.whatWillMakeThemHire}
- What will make them reject: ${intelligence.psychology.whatWillMakeThemReject}

PROPOSAL BLUEPRINT:
- Primary strategy: ${intelligence.proposalBlueprint.primaryStrategy}
- OPENING LINE (use this verbatim or as your first sentence): "${intelligence.proposalBlueprint.openingLine}"
- CTA LINE (use this verbatim as your final sentence — it ends with "?"): "${intelligence.proposalBlueprint.ctaLine}"
- Mandates (MUST follow all of these): ${intelligence.proposalBlueprint.proposalMandates?.join(" | ")}
- Forbidden approaches (DO NOT use any of these): ${intelligence.proposalBlueprint.forbiddenApproaches?.join(" | ")}${(() => {
  const gk = (intelligence.proposalBlueprint as any).goldenKey;
  if (!gk?.use || !gk.keyId) return "";
  const key = goldenKeyById(gk.keyId);
  if (!key) return "";
  return `\n- GOLDEN KEY (${gk.placement === "closing" ? "place as a closing line right before the CTA" : "place as an opening frame before the hook"}): weave this framing sentence in naturally, adapting wording to fit the flow — "${key.text}"`;
})()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        : "";
      const strategyBlock = data.strategyDocument
        ? `\nSTRATEGY DOCUMENT (you prepared this for the client — reference it naturally in the proposal):\n${data.strategyDocument}`
        : "";

      const languageInstruction = data.targetLanguage && data.targetLanguage.toLowerCase() !== "english"
        ? `\n- LANGUAGE: Write the ENTIRE proposal in ${data.targetLanguage}. Every sentence, word, and phrase must be in ${data.targetLanguage}. Do not mix languages.`
        : "";

      const toneInstruction = (() => {
        const a = data.toneAssertiveness ?? 3;
        const f = data.toneFormalness ?? 3;
        const assertStyle = a <= 2 ? "consultative and exploratory — ask questions, show curiosity, invite collaboration"
          : a >= 4 ? "assertive and direct — make confident statements, give recommendations, show authority"
          : "balanced — confident but open to dialogue";
        const formalStyle = f <= 2 ? "conversational and plain-spoken — write like a smart colleague in a Slack message"
          : f >= 4 ? "professional and structured — clean, precise business prose"
          : "semi-formal — clear and direct without being stiff";
        return `\n- TONE: Be ${assertStyle}. Write in a ${formalStyle} style.`;
      })();

      // REGISTER — who you're speaking AS (distinct from the tone dials above).
      // Chosen by Engine 1 from the job post; falls back to friendly advisor if the
      // intelligence pipeline didn't run for this generation.
      const registerInstruction = (() => {
        const reg = resolveRegister(intelligence?.clientIntelligence.recommendedRegisterId);
        return `\n- REGISTER: Write as a ${reg.name}. ${reg.description} Commit to this voice from the first word to the last — do not slide into a different register mid-proposal.`;
      })();

      // Claude handles proposal writing — best prose quality
      const result = await structuredWith(
        "writer",
        ProposalSchema,
        `You write freelance proposals that win because the client FEELS understood — not impressed, not sold to, understood.

The gold standard: the client reads this and thinks "this person has seen my exact problem before and knows exactly how it ends." That feeling comes from specificity, not claims. Never say "I understand your needs." Instead, name the specific thing they're dealing with, name the downstream cost of it, name the thing they probably haven't tried yet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY VALIDATION — INTERNAL REVIEW BEFORE RETURNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before returning the proposal, verify each of these. If any fail, regenerate:
✓ The hook is unique — impossible to send to another client by changing the company name
✓ The real business problem behind the request is identified (not just what was asked for)
✓ The strategy section explains reasoning, not just a list of deliverables
✓ The writing sounds like a senior consultant — not an AI generating templates
✓ No generic marketing phrases appear anywhere
✓ The CTA ends with a relevant question mark
✓ Does the writing consistently sound like the assigned register throughout, not sliding into a different voice mid-proposal?
✓ ZERO fabricated facts — every number, percentage, dollar figure, case study, and named client result traces to the supplied job post, portfolio content, or user input
✓ The hook does NOT restate the client's own sentence back to them.
  ❌ REJECTED — restates their own sentence with "you said" bolted on:
     Client wrote: "We need help with X." → Hook: "You said you need help with X, and that's exactly..."
     This is paraphrase, not insight. It proves you read the post, not that you thought about it.
  ✅ REQUIRED — reveals something they didn't already state outright, drawn from a detail in their post they didn't explicitly connect themselves.
✓ The hook states an actual position, not a hedge. Banned: "you might want to consider," "it could be worth thinking about," "one option might be." State the real position, even if the client could disagree with it.
✓ The hook names a real consequence — what breaks, gets wasted, or fails silently if this specific insight is ignored — not just that the insight exists. "This matters" is weaker than "this is why X won't work in 30 days."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NO FABRICATION — ABSOLUTE HARD RULE (overrides "be specific")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You may NEVER invent facts. This rule outranks every instruction to "be specific" or "use real numbers."
STRICTLY FORBIDDEN unless the exact fact appears in the supplied job post, portfolio content, or user input:
- Any statistic, percentage, or metric ("increased conversions 32%", "cut churn to 0.8%")
- Any dollar figure or revenue claim ("added $40k MRR")
- Any case study, past project, or named client ("when I rebuilt Acme's Klaviyo flows...")
- Any before/after number or timeframe result ("within the first quarter revenue jumped 22-28%")
If you don't have a real number, do NOT manufacture one. Prove expertise through concrete, evocative UNDERSTANDING of their situation — not invented results.

❌ FORBIDDEN (invented — there is no source for these numbers or this project):
"When I rebuilt the abandoned-cart flows for a similar Shopify brand, revenue from those flows jumped 22-28% within the first quarter and unsubscribe rates dropped below 0.8%."

✅ REQUIRED (specific about THEIR situation, invents nothing):
"Abandoned-cart flows are usually where the fastest recovery hides — most stores have the trigger firing but never tune the timing or the second and third touches, which is exactly where the money leaks."

Concrete language proving expertise is encouraged. Invented numbers are not the same thing as real specificity — and a client who asks to see a fabricated case study will find nothing there. When in doubt, describe the mechanism, not a manufactured result.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOUNDER PSYCHOLOGY — HOW FOUNDERS ACTUALLY READ PROPOSALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A founder scanning a proposal asks five things:
1. Does this person understand my business?
2. Did they actually study my situation?
3. Do they understand my positioning and audience?
4. Are they thinking beyond the immediate deliverable?
5. Can they move the needle on revenue, trust, or conversions?

Every sentence must answer at least one of those questions. Any sentence that answers none is filler — delete it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFER THE REAL BUSINESS PROBLEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do not repeat or describe what the client asked for. Infer the real business problem behind the request:
- A redesign request is usually a positioning problem
- A landing page request is usually a conversion problem
- A CMS request is usually a scalability or ownership problem
- A nonprofit redesign is usually a trust and donation problem
- A portfolio site is usually a credibility and lead quality problem

Name the real problem. Explain why it matters to the business. Then position the deliverable as the solution to that problem — not the other way around.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRATEGY = REASONING, NOT DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The strategy section must explain your thought process — not list features or phases.

Cover the reasoning behind each decision:
- Messaging hierarchy — what to say first and why
- Information architecture — what the visitor needs to understand, in what order
- Trust building — what signals credibility for this specific audience
- Conversion flow — where the natural decision point is and how to guide toward it
- Brand positioning — what makes this client different and how to make that obvious

Avoid generic UI descriptions. Every design or content decision must be connected to a business outcome.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVIDENCE-BASED ONLY — NO GENERIC OBSERVATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every claim must reference something specific that actually exists in the job post.

❌ REJECTED — generic, could apply to any client:
"Your website could convert better."
"Your UX could be improved."
"Your design feels outdated."

✅ REQUIRED — specific, tied to what was actually mentioned:
Reference a specific tool, platform, timeline, deliverable, team constraint, pain point, audience segment, competitor, or outcome they described.

The first paragraph must make the client think: "This person actually read my brief."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNED LANGUAGE — NEVER USE ANY OF THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These words and phrases signal AI-generated filler and will cause rejection:
Modern · Clean · User-friendly · Visually appealing · Professional · Sleek · Stunning · Beautiful · Cutting-edge · Seamless · Leverage · Streamline · Optimize · Enhance the user experience · Deliver value · Holistic approach · Best practices · Robust solution · Dynamic · Innovative · State-of-the-art

Replace every generic phrase with a concrete, business-specific observation.

Hard rules:
- No greeting. No "Hi". Start directly with the hook.${languageInstruction}${toneInstruction}${registerInstruction}
- NO BULLET POINTS. NO HYPHENS. NO DASHES as list markers. Write in clean flowing prose only. If listing items, embed them naturally in sentences ("I'll handle X, Y, and Z" not "- X\n- Y\n- Z"). The proposal must look like a confident personal message, not a formatted document.
- HUMAN EMPATHY WITHOUT GENERIC LANGUAGE: Show you understand by naming specifics — their industry friction, the real reason this project is urgent, the hidden risk they're taking by not solving it now. Do not use any phrase that sounds like emotional performance ("I understand your frustration", "I know how stressful this is"). Instead, demonstrate understanding through precision.
- CONFIDENCE WITHOUT ARROGANCE: Write like someone who has solved this exact type of problem before and is not anxious about it. Calm. Certain. But not boastful. The confidence comes from the quality of the insight, not from self-promotion.
- DO NOT parrot or restate the job post. Echo the client's stated needs at most ~30%. The other ~70% must be YOUR original interpretation, deeper insight, and value they did NOT explicitly ask for. Show you understand the problem more deeply than they described it.
- Every sentence must advance a thought. No filler, no transitions that carry no meaning ("Additionally", "Furthermore", "As mentioned above").
- STRATEGY REFERENCE (only if a strategy document was provided): Weave the strategy into the proposal in a way that feels invested, not promotional. The freelancer already prepared a custom strategy document for this exact job BEFORE even being hired — that's the signal of genuine commitment. Reference it with confidence: something like "Before applying, I mapped out a full project strategy for this — phase breakdown, risk factors, success metrics — because I wanted you to see exactly how I'd approach it, not just what I'd do." Then invite them to review it. Never say "I drafted a strategy document" in a generic way — make it feel like the freelancer stayed up thinking about their specific problem.
- Forbidden phrases (NEVER use any of these or close variants):
${FORBIDDEN_PHRASES.map((p) => `  • "${p}"`).join("\n")}
- Use the assigned HOOK: ${hookLabel}
- Use the assigned STRATEGY: ${strategyLabel}
- Use the assigned CTA STYLE: ${ctaLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CTA — THE FINAL PARAGRAPH IS ONE QUESTION. NOTHING ELSE.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The final paragraph is a single question that starts a conversation. It is not an observation, a summary, a closing remark, or a statement followed by a question.

The last character of the entire proposal must be "?". If it isn't, the proposal is wrong.

❌ THESE ARE NOT CTAs — they are hooks or strategy points placed in the wrong position:
"The real risk here isn't the recording — it's..."  ← observation, not a CTA
"The real challenge with this project is..."  ← analysis, not a CTA
"What makes this project difficult is..."  ← insight, not a CTA
"Most clients who come to me with this problem..."  ← experience claim, not a CTA

❌ THESE ARE FORBIDDEN ENDINGS:
"I'd love to hear your thoughts."
"Looking forward to hearing from you."
"I can build this for you."
"Let me know." / "Happy to discuss." / "Feel free to reach out."
"I'll deliver X by Y." / "My approach covers everything."
Any statement. Any sentence that does not end with "?".
Anything that sounds like a closing remark, not an opener to a conversation.

✅ THE CTA IS ONE QUESTION — examples:
"Are you planning to build on the existing architecture, or are you open to restructuring parts of it if it leads to a cleaner implementation?"
"Which part of the current workflow has been the biggest bottleneck so far?"
"Would you prefer I prioritize performance first, or feature completeness for the initial release?"
"Does this feel aligned with where you're taking the brand?"
"Is improving trust your biggest priority right now, or is generating more enquiries the immediate goal?"

The question must be:
- Specific to this client's project — impossible to paste into any other proposal
- Something a consultant would ask, not a salesperson
- An opener to a real conversation, not a formality
- LENGTH ENFORCEMENT (this is a hard rule):
  * brief: MAXIMUM 1500 characters total. This is for crowded markets where character limits are strict. Structure (in this order): Hook paragraph (2-3 sentences, each a distinct insight about THEIR specific problem — no filler, no transitions)${data.portfolioItems.length > 0 ? " → ONE portfolio link IMMEDIATELY after the hook (mandatory — a single most-relevant link with one short sentence on why it fits THIS job)" : ""} → a tight body (1-2 sentences on the outcome) → one razor-sharp question that pivots from problem to solution, ending the proposal. Compress the body and deliverables to stay under 1500 chars — but the hook${data.portfolioItems.length > 0 ? " and the portfolio link are" : " is"} mandatory and must NOT be dropped to save space. Zero milestones. Zero execution plan. These 1500 characters must hit harder than a 4000-character generic proposal.
  * robust: 2000–3000 characters. Hook paragraph → portfolio paragraph (PARAGRAPH 2 — immediately after hook) → deliverables → one advice sentence → ${data.includePlan ? "execution plan → " : ""}question → CTA.
  * explanatory: 3000–5000 characters. All sections fully developed. Detailed execution plan. Full milestones if provided.
  You are writing a "${length.name}" proposal so the rules for "${length.id}" apply.
- PARAGRAPH ORDER (mandatory): 1) Hook paragraph — your most compelling opening insight. ${data.portfolioItems.length > 0 ? "2) Portfolio paragraph — IMMEDIATELY after the hook, before anything else. Include EVERY portfolio link from the PORTFOLIO ITEMS section above, each with a one-line sentence explaining how it's relevant to THIS specific job. Do not bury portfolio links later in the proposal. 3) " : "2) "}Deliverables paragraph (2-4 sentences about outcomes, not steps). ${data.portfolioItems.length > 0 ? "4" : "3"}) One non-obvious advice/warning sentence. ${data.includePlan ? (data.portfolioItems.length > 0 ? "5" : "4") + ") 2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a natural paragraph. " : ""}Final paragraph: ONE question only. This question IS the entire CTA. Nothing after it. No statement. No closing remark. The proposal ends with "?".
- EXECUTION DETAIL RULE: Do NOT describe phases, timelines, or HOW you will execute the work unless the job post explicitly uses language like "walk me through your process", "describe your workflow", "how would you approach", "what is your methodology", or it is clearly a detailed RFP. Most freelance clients want to feel understood and see the outcome — not read a project plan inside a proposal. If the job is straightforward (e.g. "build a landing page", "write email sequences", "edit this video"), focus on insight, outcome, and trust — not steps. Only include a high-level execution note if the job is highly technical and clearly signals the client wants methodology.
- FORMATTING RULES: Write in clean flowing prose. Separate paragraphs with ONE blank line. No dashes, asterisks, or any markdown. No horizontal rules. No numbered lists. No bullet symbols of any kind.
${data.extractedEntities && data.extractedEntities.length >= 3 ? `- GROUNDING ENFORCEMENT (non-negotiable): The following specific entities were extracted from the job post. Your proposal MUST reference AT LEAST 3 of them naturally — exact names, numbers, or paraphrases. A proposal that could apply to any job will be rejected. Entities: ${data.extractedEntities.join(", ")}` : ""}

Return a JSON object with this exact shape:
{
  "content": "<the full proposal text, ready to paste>",
  "explanation": {
    "hook": "<why this hook works for this job>",
    "strategy": "<why this strategy works for this job>",
    "question": "<why this closing question works>"
  }
}${redFlagPromptBlock(customFlags)}`,
        `${intelligenceBlock}${intelligenceBlock ? "\n\n" : ""}Job post:\n${data.jobDescription}\n\n${analysisBlock}\n\n${portfolioBlock}\n\n${milestoneBlock}\n\nBudget: ${data.budget || "not specified"}${data.strategyDocument ? `\n\nStrategy reference:\n${data.strategyDocument}` : ""}\n\n${strategyBlock}${data.targetLanguage && data.targetLanguage.toLowerCase() !== "english" ? `\n\nOUTPUT LANGUAGE: ${data.targetLanguage}` : ""}`,
      );
      // Phase 1.3 — Specificity gate (Gemini Flash verifier, max 1 retry)
      let currentResult = result;
      if (data.extractedEntities && data.extractedEntities.length > 0) {
        const verification = await verifyOutput({
          proposal: currentResult.content,
          jobDescription: data.jobDescription,
          extractedEntities: data.extractedEntities,
        });
        if (verification && (verification.specificity < 7 || verification.entityUsage < 3)) {
          // Inject verifier complaint and regenerate once
          const retryResult = await structured(
            ProposalSchema,
            `You write freelance proposals that win because the client FEELS understood — not impressed, not sold to, understood.

QUALITY VALIDATION: Before returning, verify — hook is unique to this client, real business problem identified (not just the request), strategy explains reasoning not deliverables, writing sounds like a senior consultant, no generic language, CTA ends with "?".

FOUNDER PSYCHOLOGY: Every sentence must answer at least one of these — Does this person understand my business? Did they study my situation? Are they thinking beyond the deliverable? Can they improve revenue, trust, or conversions? Any sentence that answers none is filler — delete it.

INFER THE REAL PROBLEM: Don't describe what was asked for. Infer the business problem (redesign = positioning; landing page = conversion; CMS = scalability; nonprofit = trust/donations). Name the real problem, explain why it matters commercially, position the deliverable as the solution.

STRATEGY = REASONING: Explain the thought process — messaging hierarchy, information architecture, trust building, conversion flow, brand positioning. Not a list of deliverables.

EVIDENCE-BASED ONLY: Every claim must reference something specific from the job post — tool, platform, timeline, deliverable, audience, or pain point they actually mentioned.

NO FABRICATION (hard rule, outranks "be specific"): NEVER invent a statistic, percentage, dollar figure, case study, past project, or named client result that isn't in the supplied job post, portfolio, or user input. No manufactured "I increased X by 30%" or "when I rebuilt Acme's flows". Prove expertise by describing the mechanism of their problem, not by inventing results. A fabricated case study a client could ask to see is a disqualifying error.

BANNED LANGUAGE: Modern · Clean · User-friendly · Visually appealing · Professional · Sleek · Stunning · Beautiful · Cutting-edge · Seamless · Leverage · Streamline · Optimize · Enhance the user experience · Deliver value · Holistic · Best practices · Robust · Dynamic · Innovative

Hard rules:
- No greeting. No "Hi". Start directly with the hook.${data.targetLanguage && data.targetLanguage.toLowerCase() !== "english" ? `\n- LANGUAGE: Write the ENTIRE proposal in ${data.targetLanguage}.` : ""}
- NO BULLET POINTS. NO HYPHENS. NO DASHES as list markers. Write in clean flowing prose only.
- DO NOT parrot or restate the job post. Echo the client's stated needs at most ~30%. The other ~70% must be YOUR original interpretation, deeper insight, and value they did NOT explicitly ask for.
- Forbidden phrases (NEVER use): ${FORBIDDEN_PHRASES.map((p) => `"${p}"`).join(", ")}
- Use the assigned HOOK: ${data.customHookText ? `AI-Generated Custom Hook — ${data.customHookText}` : (() => { const h = findOrWarn(HOOKS, data.hookId, "HOOKS"); return `${h.name} — ${h.description}`; })()}
- Use the assigned STRATEGY: ${data.customStrategyText ? `AI-Generated Custom Strategy — ${data.customStrategyText}` : (() => { const s = findOrWarn(STRATEGIES, data.strategyId, "STRATEGIES"); return `${s.name} — ${s.description}`; })()}
- GROUNDING (non-negotiable): Reference AT LEAST 3 of these entities naturally: ${(data.extractedEntities ?? []).join(", ")}
- SPECIFICITY FAILURE — previous draft scored ${verification.specificity}/10, ${verification.entityUsage} entity refs. Complaint: "${verification.complaint}". Anchor EVERY paragraph to a specific job post detail.
- CTA HARD REQUIREMENT: Final paragraph MUST end with a question ending in "?". Never end with "I'd love to hear your thoughts", "Looking forward to hearing from you", "Let me know", "Happy to discuss", or any deliverable statement. Good examples: "Would you rather evolve the existing brand or take it in a new direction?" / "Is improving trust your biggest priority, or is generating more enquiries the immediate goal?"
- FORMATTING: Clean flowing prose. One blank line between paragraphs. No markdown.

Return a JSON object with this exact shape:
{
  "content": "<the full proposal text, ready to paste>",
  "explanation": {
    "hook": "<why this hook works for this job>",
    "strategy": "<why this strategy works for this job>",
    "question": "<why this closing question works>"
  }
}`,
            `Job post:\n${data.jobDescription}\n\n${data.analysis ? `Job analysis:\n${JSON.stringify(data.analysis, null, 2)}` : ""}\n\n${data.portfolioItems.length ? `PORTFOLIO ITEMS:\n${data.portfolioItems.map((p) => `- ${p.url} — "${p.title}"`).join("\n")}` : ""}`,
          ).catch(() => currentResult); // if retry fails, keep original
          currentResult = retryResult;
        }
      }

      // Hard-enforce brief limit
      let finalResult = currentResult;

      // ── CTA Enforcer: last paragraph MUST contain a question mark ──────────
      // If it doesn't, Gemini Flash rewrites just the last paragraph as a question.
      // This catches cases where Claude generated a deliverable statement as the CTA.
      const paragraphs = currentResult.content.split(/\n\n+/);
      const lastPara = paragraphs[paragraphs.length - 1]?.trim() ?? "";
      if (lastPara && !lastPara.trimEnd().endsWith("?")) {
        try {
          const ctaFix = await generateObjectWithProvider("verifier", {
            schema: z.object({ ctaParagraph: z.string() }),
            system: `You rewrite the final paragraph of a freelance proposal as a question or concrete offer+question. The paragraph must end with "?". Reference a specific detail from the job post. Keep it to 1-2 sentences. Never use "Let me know if interested", "Feel free to reach out", "Looking forward to hearing from you".`,
            prompt: `Job post (for context):\n${data.jobDescription.slice(0, 1000)}\n\nBad CTA paragraph to replace:\n"${lastPara}"\n\nRewrite this as a sharp, job-specific question or offer+question. Return JSON: { "ctaParagraph": "<rewritten closing 1-2 sentences ending with ?>" }`,
          });
          if (ctaFix.ctaParagraph && ctaFix.ctaParagraph.trimEnd().endsWith("?")) {
            paragraphs[paragraphs.length - 1] = ctaFix.ctaParagraph;
            currentResult = { ...currentResult, content: paragraphs.join("\n\n") };
          }
        } catch {
          // CTA enforcer failed — keep original rather than block generation
        }
      }
      // ── End CTA Enforcer ───────────────────────────────────────────────────
      if (data.length === "brief") {
        const MAX = 1500;
        const text = currentResult.content;
        if (text.length > MAX) {
          // Paragraph-aware truncation. The hook (first para), any portfolio paragraph
          // (contains a URL), and the CTA (last para) are structurally mandatory and are
          // NEVER dropped or cut mid-string. We shed BODY paragraphs (from the ones
          // closest to the CTA backward) until we're under the cap.
          const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
          if (paras.length <= 1) {
            // Single blob — fall back to a URL-safe sentence cut that never severs a link.
            finalResult = { ...currentResult, content: urlSafeTrim(text, MAX) };
          } else {
            const hasUrl = (p: string) => /https?:\/\/|www\./i.test(p);
            const lastIdx = paras.length - 1;
            const mandatory = new Set<number>([0, lastIdx]);
            paras.forEach((p, i) => { if (hasUrl(p)) mandatory.add(i); });

            // Candidate body paragraphs to drop, closest-to-CTA first.
            const dropOrder = paras
              .map((_, i) => i)
              .filter((i) => !mandatory.has(i))
              .sort((a, b) => b - a);

            const dropped = new Set<number>();
            const rebuild = () =>
              paras.filter((_, i) => !dropped.has(i)).join("\n\n");

            for (const idx of dropOrder) {
              if (rebuild().length <= MAX) break;
              dropped.add(idx);
            }

            let result = rebuild();
            // If still over even with only mandatory paras kept, trim ONLY the longest
            // non-URL kept paragraph, URL-safely — never touch the portfolio link.
            if (result.length > MAX) {
              const kept = paras.map((_, i) => i).filter((i) => !dropped.has(i));
              const trimTarget = kept
                .filter((i) => !hasUrl(paras[i]) && i !== lastIdx)
                .sort((a, b) => paras[b].length - paras[a].length)[0];
              if (trimTarget !== undefined) {
                const overBy = result.length - MAX;
                paras[trimTarget] = urlSafeTrim(paras[trimTarget], Math.max(40, paras[trimTarget].length - overBy - 1));
                result = rebuild();
              }
            }
            // Mandatory structure wins over the 1500 cap: if hook+portfolio+CTA alone
            // still exceed it, we keep them intact rather than mutilate a link.
            finalResult = { ...currentResult, content: result };
          }
        }
      }
      // Strip bullet lists, horizontal rules, and excessive blank lines
      const cleanContent = finalResult.content
        .split("\n")
        .filter((line) => !/^[\s]*([_\-*]{3,})[\s]*$/.test(line)) // remove --- ___ *** HR lines
        .map((line) => line.replace(/^[\s]*[-•*]\s+/, "").replace(/^[\s]*\d+\.\s+/, ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      let finalContent = scrubRedFlags(cleanContent, customFlags);

      // ── FABRICATION GUARD (Fix 7) ─────────────────────────────────────────
      // Backstop for the "no fabricated metrics" rule. Everything the proposal is
      // allowed to draw facts from becomes the source set. Any specific number,
      // percentage, case study, or named client result NOT traceable to a source is
      // flagged; if flags exist we attempt ONE auto-remediation rewrite that strips
      // them, then re-check. Whatever remains is returned so the UI can warn the user.
      const factSources = [
        `JOB POST:\n${data.jobDescription}`,
        data.portfolioItems.length
          ? `PORTFOLIO CONTENT:\n${data.portfolioItems.map((p) => `- ${p.title}: ${p.description} (${p.url})`).join("\n")}`
          : "",
        data.strategyDocument ? `STRATEGY DOCUMENT:\n${data.strategyDocument}` : "",
        data.milestones?.length ? `MILESTONES:\n${data.milestones.map((m) => `- ${m.title}: ${m.description}`).join("\n")}` : "",
        data.customHookText ? `USER HOOK:\n${data.customHookText}` : "",
        data.customStrategyText ? `USER STRATEGY:\n${data.customStrategyText}` : "",
      ].filter(Boolean).join("\n\n");

      let factCheck: ProposalFactCheck = { flagged: [], allTraceable: true, remediated: false };
      const firstCheck = await verifyFactualClaims({ proposal: finalContent, sources: factSources });
      if (firstCheck && firstCheck.flagged.length > 0) {
        // Attempt a single automatic remediation: rewrite removing ONLY the fabricated claims.
        try {
          const fixed = await structuredWith(
            "writer",
            z.object({ content: z.string() }),
            `You are removing FABRICATED facts from a freelance proposal. The following specific claims were flagged as NOT traceable to any source material and must be fixed:
${firstCheck.flagged.map((f) => `- "${f.claim}" — ${f.reason}`).join("\n")}

For EACH flagged claim: remove the invented number/statistic/case study/client result, OR replace it with the nearest TRUE general statement that keeps the sentence strong without inventing anything. Do not add any new facts. Change NOTHING else about the proposal — same voice, same structure, same length, same everything except the fabricated claims. Return the full corrected proposal.

Return JSON: { "content": "<full corrected proposal text>" }`,
            `SOURCE MATERIALS (the only facts allowed):\n${factSources.slice(0, 5000)}\n\n---\n\nPROPOSAL TO CORRECT:\n${finalContent}`,
          );
          if (fixed.content && fixed.content.length > 100) {
            finalContent = scrubRedFlags(fixed.content, customFlags);
            const recheck = await verifyFactualClaims({ proposal: finalContent, sources: factSources });
            factCheck = {
              flagged: recheck?.flagged ?? [],
              allTraceable: recheck ? recheck.allTraceable : false,
              remediated: true,
            };
          } else {
            factCheck = { flagged: firstCheck.flagged, allTraceable: false, remediated: false };
          }
        } catch {
          factCheck = { flagged: firstCheck.flagged, allTraceable: false, remediated: false };
        }
      }

      const finalProposal = { ...finalResult, content: finalContent, factCheck };

      // Auto-save to proposal memory (non-fatal)
      if (intelligence) {
        saveProposalMemoryInternal(
          supabase,
          userId,
          intelligence,
          (data as any).platform ?? "upwork",
          data.jobDescription,
        ).catch(() => {});
      }

      return finalProposal;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Generate Profile Sections ----------
const ProfileSectionsSchema = z.object({
  bio: z.string(),
  myStory: z.string(),
  skills: z.array(z.string()),
  credentials: z.array(z.object({ title: z.string(), institution: z.string(), year: z.string() })).optional(),
});
export type GeneratedProfileSections = z.infer<typeof ProfileSectionsSchema>;

export const generateProfileSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { niches: string[]; jobContext?: string }) =>
    z.object({
      niches: z.array(z.string().max(100)).min(1).max(10),
      jobContext: z.string().max(5000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const nicheList = data.niches.join(", ");
      const jobBlock = data.jobContext
        ? `\n\nJob context (tailor the profile to fit this job):\n${data.jobContext}`
        : "";
      const result = await structuredWith("challenger",
        ProfileSectionsSchema,
        `You generate professional freelancer profile content for a settings page. Be specific, credible, and human. No buzzwords. The freelancer's niches are: ${nicheList}.${jobBlock}

Return a JSON object with these exact keys:
{
  "bio": "<1-3 sentences professional bio>",
  "myStory": "<3-5 sentences origin story — what drives them, key experiences, why clients trust them>",
  "skills": ["<skill 1>", "<skill 2>", ... "<up to 15 trending, specific skills for the niche>"],
  "credentials": [{"title": "...", "institution": "...", "year": "..."}]
}
For credentials, suggest 2-3 plausible certifications or degrees relevant to the niche. Use empty array if no logical credentials apply.${redFlagPromptBlock()}`,
        `Generate a complete professional profile for a freelancer with these niches: ${nicheList}.${jobBlock}`,
      );
      return {
        ...result,
        bio: scrubRedFlags(result.bio),
        myStory: scrubRedFlags(result.myStory),
      };
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Generate Strategy Document ----------
const StrategySchema = z.object({
  projectTitle: z.string(),
  overview: z.string(),
  totalDays: z.number(),
  phases: z.array(z.object({
    phase: z.number(),
    name: z.string(),
    days: z.string(),
    deliverables: z.array(z.string()),
    risks: z.array(z.string()),
  })),
  criticalPath: z.array(z.string()),
  featureBreakdown: z.array(z.object({
    feature: z.string(),
    priority: z.enum(["Must Have", "Should Have", "Nice to Have"]),
    estimatedDays: z.number(),
    notes: z.string(),
  })),
  successMetrics: z.array(z.string()),
  recommendation: z.string(),
});
export type StrategyDocument = z.infer<typeof StrategySchema>;

export const generateStrategyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; analysis?: JobAnalysis | null; budget?: string; targetLanguage?: string }) =>
    z.object({
      jobDescription: z.string().min(10),
      analysis: z.any().optional().nullable(),
      budget: z.string().optional(),
      targetLanguage: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const analysisBlock = data.analysis
        ? `\nJob analysis:\n${JSON.stringify(data.analysis, null, 2)}`
        : "";
      const languageInstruction = data.targetLanguage && data.targetLanguage.toLowerCase() !== "english"
        ? `\n\nLANGUAGE: Write ALL text fields in ${data.targetLanguage}. Every word must be in ${data.targetLanguage}.`
        : "";
      // Claude handles strategy documents — needs structured, professional prose
      return await structuredWith(
        "writer",
        StrategySchema,
        `You are a senior project manager writing a strategy document for a freelancer to share with a client. Be specific, realistic, and professional. Break the project into 3-5 clear phases.${languageInstruction}

Return a JSON object with this exact shape:
{
  "projectTitle": "<short project title from the job>",
  "overview": "<2-3 sentence project overview>",
  "totalDays": <total estimated working days as number>,
  "phases": [
    {
      "phase": 1,
      "name": "<phase name>",
      "days": "<e.g. Day 1-5>",
      "deliverables": ["<deliverable 1>", ...],
      "risks": ["<risk or delay factor>", ...]
    }
  ],
  "criticalPath": ["<critical item 1>", "<critical item 2>", ...],
  "featureBreakdown": [
    {
      "feature": "<feature name>",
      "priority": "Must Have",
      "estimatedDays": <number>,
      "notes": "<one sentence>"
    }
  ],
  "successMetrics": ["<metric 1>", ...],
  "recommendation": "<2-3 sentence strategic recommendation>"
}`,
        `Create a strategy document for this project:\n\n${data.jobDescription}${analysisBlock}\n\nBudget: ${data.budget || "not specified"}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- AI Proposal Editor ----------
export const applyProposalEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposalText: string; instruction: string; blueprint?: unknown; registerId?: string }) =>
    z.object({
      proposalText: z.string().min(10).max(10000),
      instruction: z.string().min(3).max(500),
      // Optional ProposalBlueprint from the original generation — gives the editor a
      // structural map (which paragraph is the hook/CTA, which patterns were used) so
      // instructions like "rewrite the hook using curiosity" target the right paragraph.
      blueprint: z.any().optional(),
      registerId: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      const bp = data.blueprint as ProposalBlueprint | undefined;

      // Structural context block — only when a blueprint is available (Fix 4).
      let structuralContext = "";
      if (bp && (bp.mappedHookId || bp.openingLine || bp.ctaLine)) {
        const reg = data.registerId ? resolveRegister(data.registerId) : null;
        const hookLib = HOOKS.map((h) => `  - ${h.id}: ${h.name} — ${h.description}`).join("\n");
        structuralContext = `
STRUCTURAL CONTEXT (for your reference — the proposal was built from this blueprint):
- The HOOK is the opening paragraph. It uses pattern: ${bp.mappedHookId || "(unspecified)"}${bp.openingLine ? `\n  Its text begins near: "${bp.openingLine.slice(0, 120)}"` : ""}
- Strategy pattern: ${bp.mappedStrategyId || "(unspecified)"}
- The CTA is the final paragraph (a question). CTA pattern: ${bp.mappedCtaId || "(unspecified)"}${bp.ctaLine ? `\n  Its text is near: "${bp.ctaLine.slice(0, 120)}"` : ""}${reg ? `\n- Register (voice): ${reg.name} — ${reg.description}` : ""}

When the instruction names a structural element ("the hook", "the opening", "the CTA", "the closing"), use the text hints above to LOCATE that exact paragraph rather than guessing by position, and rewrite only that paragraph.

HOOK PATTERN LIBRARY (use the matching definition when an instruction asks to change hook style, e.g. "use curiosity" → curiosity_gap):
${hookLib}
`;
      }

      const text = await generateWithProvider("writer", {
        system: `You are a professional proposal editor. The user gives you a freelance proposal and an instruction to improve it. Apply the instruction surgically — change ONLY what is asked. Preserve the overall structure and voice unless instructed otherwise. Return ONLY the revised proposal text with no commentary, no preamble, no "Here is the revised..." prefix. Just the proposal text itself.
${structuralContext}
Rules:
- Never add greeting lines ("Hi", "Hello", "Dear")
- Never add generic openers
- Preserve line breaks and paragraph structure
- If asked to shorten, cut filler but keep every specific point
- If asked to change tone, apply it throughout consistently
- When asked to change a specific paragraph's style (e.g. the hook), change ONLY that paragraph and make it genuinely follow the named pattern — not just a tone tweak
- NO FABRICATION: never introduce a statistic, percentage, case study, or named client result that isn't already in the proposal or the instruction
- Return the complete revised proposal, not just the changed part`,
        prompt: `INSTRUCTION: ${data.instruction}\n\nCURRENT PROPOSAL:\n${data.proposalText}`,
      });
      return { text: scrubRedFlags(text.trim(), customFlags) };
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Conversion Messages ----------
const ConversionSchema = z.object({
  bestReply: z.string(),
  bestReplyReason: z.string(),
  alternatives: z.array(z.object({
    mode: z.string(),
    reply: z.string(),
  })),
  stageAssessment: z.object({
    canAdvance: z.boolean(),
    reason: z.string(),
    extracted: z.object({
      deliverables: z.array(z.string()).optional(),
      painPoints: z.array(z.string()).optional(),
      scopeOfWork: z.string().optional(),
      timeline: z.string().optional(),
    }),
  }),
});

const STAGE_LABELS = [
  "Understand the problem",
  "Build relationship",
  "Gradually convert",
  "Close the deal",
];

const STAGE_CRITERIA = [
  "Core client problem has been clearly identified in the conversation",
  "Genuine rapport has been established — client is warm and engaged",
  "Scope, timeline, and rough budget have been discussed",
  "Client is ready to move forward — next step is contract or hire",
];

// The 5 reply modes keep the same labels at every stage, but what each mode should
// SOUND like changes with the conversation stage. A warm "As a Friend" reply is right
// at Stage 2 (pure relationship-building, no ask); at Stage 4 it must still feel warm
// but be far more direct and closing-oriented. Indexed by stage-1.
const STAGE_MODE_TONE: Record<string, string>[] = [
  // Stage 1 — Understand the problem
  {
    "Founder-to-Founder": "peer curiosity — ask the one sharp question that surfaces the real problem, no pitching yet",
    "As a Friend": "warm and low-pressure — make them feel heard, zero ask, just genuine interest in what's going on",
    "Show Knowledge": "demonstrate you already grasp their domain by naming a likely root cause, then ask to confirm",
    "Strong Understanding": "reflect their situation back so precisely they feel understood, then invite them to elaborate",
    "Sharp & Brief": "one tight clarifying question that cuts to the actual problem — nothing else",
  },
  // Stage 2 — Build relationship
  {
    "Founder-to-Founder": "swap a quick relevant war-story as an equal — builds trust, still no hard ask",
    "As a Friend": "purely relationship-building, genuinely warm, no ask at all — just deepen rapport",
    "Show Knowledge": "share one useful insight for free to prove expertise without selling",
    "Strong Understanding": "validate their concern with empathy and precision, make them feel safe",
    "Sharp & Brief": "a short, human, warm line that keeps momentum without pressure",
  },
  // Stage 3 — Gradually convert
  {
    "Founder-to-Founder": "peer-level, start framing scope and approach as a shared plan you'd both commit to",
    "As a Friend": "warm but now gently steering toward next steps — friendly nudge, not a hard close",
    "Show Knowledge": "translate expertise into a concrete approach for their scope/timeline, building the case to hire",
    "Strong Understanding": "connect their stated priorities to a specific plan that de-risks the decision",
    "Sharp & Brief": "one crisp line that moves scope/timeline/budget forward",
  },
  // Stage 4 — Close the deal
  {
    "Founder-to-Founder": "direct peer close — assume the deal, propose the concrete next step to start",
    "As a Friend": "still warm, but clearly closing-oriented and direct about the next step — no vague friendliness",
    "Show Knowledge": "reinforce why you're the low-risk choice, then ask for the go-ahead directly",
    "Strong Understanding": "acknowledge their final hesitation precisely, resolve it, and ask to move forward",
    "Sharp & Brief": "one confident closing line with a clear, specific call to action",
  },
];

export const generateConversionResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    clientMessage: string;
    jobDescription?: string;
    sentProposal?: string;
    replyLanguage?: string;
    chatHistory?: Array<{ role: "client" | "you"; content: string }>;
    stage?: number;
    contextDump?: string;
    currentExtracted?: Record<string, unknown>;
    registerId?: string;
  }) =>
    z.object({
      clientMessage: z.string().min(5).max(5000),
      jobDescription: z.string().max(5000).optional(),
      sentProposal: z.string().max(5000).optional(),
      replyLanguage: z.string().optional(),
      chatHistory: z.array(z.object({ role: z.enum(["client", "you"]), content: z.string() })).optional(),
      stage: z.number().int().min(1).max(4).optional(),
      contextDump: z.string().max(10000).optional(),
      currentExtracted: z.record(z.unknown()).optional(),
      registerId: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      const stage = data.stage ?? 1;
      const stageLabel = STAGE_LABELS[stage - 1];
      const stageCriteria = STAGE_CRITERIA[stage - 1];
      const nextStageLabel = stage < 4 ? STAGE_LABELS[stage] : null;

      // Build a readable chat thread so the AI has full context
      const historyBlock = data.chatHistory && data.chatHistory.length > 0
        ? `FULL CONVERSATION HISTORY (oldest first):\n${data.chatHistory
            .map((m) => `[${m.role === "client" ? "CLIENT" : "YOU"}]: ${m.content}`)
            .join("\n\n")}\n\n---\n\n`
        : "";

      const contextDumpBlock = data.contextDump
        ? `PRIOR CONVERSATION CONTEXT (deep learning — use to sound human):\n${data.contextDump}\n\n---\n\n`
        : "";

      const contextBlock = [
        data.jobDescription ? `JOB DESCRIPTION:\n${data.jobDescription}` : null,
        data.sentProposal ? `YOUR SENT PROPOSAL:\n${data.sentProposal}` : null,
        contextDumpBlock || null,
        historyBlock || null,
        `CLIENT'S LATEST MESSAGE:\n${data.clientMessage}`,
      ].filter(Boolean).join("\n\n---\n\n");
      const langInstruction = data.replyLanguage && data.replyLanguage !== "English"
        ? `\n\nWRITE ALL REPLIES IN ${data.replyLanguage}.`
        : "";

      const stageBlock = `
CURRENT CONVERSATION STAGE: ${stage}/4 — "${stageLabel}"
Stage ${stage} success criteria: "${stageCriteria}"
${nextStageLabel ? `Next stage to unlock: "${nextStageLabel}"` : "This is the final stage — focus on closing."}

Based on the FULL conversation history, assess: has Stage ${stage}'s criteria been met yet?
- canAdvance: true only if the criteria is CLEARLY met based on what was said so far
- reason: 1 sentence explaining your assessment
- Also extract from the conversation: deliverables mentioned, client pain points, scope of work, timeline discussed (leave fields empty if not yet mentioned)`;

      // Stage-specific tone for each of the 5 alternative modes (labels stay fixed).
      const modeTone = STAGE_MODE_TONE[stage - 1] ?? STAGE_MODE_TONE[0];
      const stageModeGuidanceBlock = `STAGE-SPECIFIC TONE for the 5 alternatives (you are at Stage ${stage} — "${stageLabel}"). Keep the mode LABELS exactly as given, but tune each mode's voice to this stage:
- "Founder-to-Founder": ${modeTone["Founder-to-Founder"]}
- "As a Friend": ${modeTone["As a Friend"]}
- "Show Knowledge": ${modeTone["Show Knowledge"]}
- "Strong Understanding": ${modeTone["Strong Understanding"]}
- "Sharp & Brief": ${modeTone["Sharp & Brief"]}
A mode that is right at one stage can be wrong at another — a warm no-ask "As a Friend" reply fits Stage 2 but must become direct and closing-oriented at Stage 4.`;

      // REGISTER — who the best reply speaks AS. Use the register originally chosen for
      // this client if provided; otherwise instruct the model to infer it from the thread.
      const knownRegister = data.registerId ? resolveRegister(data.registerId) : null;
      const registerBlock = `REGISTER (who the BEST reply speaks AS):
${knownRegister
  ? `This client was profiled as: ${knownRegister.name} — ${knownRegister.description} The bestReply MUST lean into this register.`
  : `No register was passed — infer the right one from the conversation thread and the client's tone, then write the bestReply in it. Options: ${REGISTERS.map((r) => r.name).join(", ")}.`}
The 5 alternatives are a deliberate REGISTER SPREAD — each explores a different voice so the user can pick the one that fits:
- "Show Knowledge" → Professional Expert register
- "Strong Understanding" → Strategic Consultant register
- "As a Friend" → Friendly Advisor register
- "Founder-to-Founder" → Peer register
- "Sharp & Brief" → the stage-appropriate wildcard (whichever register closes fastest at this stage)
Each alternative should genuinely sound like its register — not five variations of the same voice.`;

      const result = await structuredWith("writer",
        ConversionSchema,
        `You are a rapid-response conversion coach for freelancers. The client is waiting. Read the FULL conversation history carefully so you can continue the thread naturally — do not restart or summarize what was already said. Generate:

1. The single BEST reply — the one most likely to move the conversation toward a hire RIGHT NOW, serving Stage ${stage} goal: "${stageLabel}".
2. A brief reason (1-2 sentences) explaining why this reply wins given the full context.
3. 5 alternative replies, each with a distinct approach — each tuned to the current stage per the STAGE-SPECIFIC TONE guidance below.
4. A stage assessment (stageAssessment object).

CRITICAL RULES (the client must NEVER suspect AI):
- Write like a human who typed this on their phone in 30 seconds — natural rhythm, occasional contractions, no polished corporate prose
- No formal openers: never "I hope this message finds you well", "Dear", "Certainly!", "Absolutely!", "Great question!", "I understand your concern"
- Never sound eager or desperate — confident and measured, like someone with multiple clients
- No lists, no headers, no structured formatting in the reply — just natural conversational text
- If the thread shows the client is already warm, reflect that; if they're cautious, match that energy
- Reference specifics from the job/proposal/prior messages — never be generic
- Each alternative must be genuinely different in approach, not just rephrased
- If a prior context dump is provided, use the writing style and patterns from it to sound more human
- Vary sentence length — mix short punchy sentences with longer ones. Never write paragraphs of uniform length.
- Use natural connectors: "yeah", "honestly", "look", "thing is", "to be real" where appropriate
- Occasional informal punctuation is fine: "That said—" or "Here's the thing:" or ending with "?" to invite response
- NEVER write more than 4 sentences in the best reply unless the client's message was long and complex
- If the client asked a question, answer it directly first before anything else

${stageBlock}

${stageModeGuidanceBlock}

${registerBlock}

Return a JSON object:
{
  "bestReply": "<the single best reply to send>",
  "bestReplyReason": "<1-2 sentence explanation of why this approach wins>",
  "alternatives": [
    { "mode": "Founder-to-Founder", "reply": "<peer-to-peer, tuned to this stage>" },
    { "mode": "As a Friend", "reply": "<warm, genuine, casual — tuned to this stage>" },
    { "mode": "Show Knowledge", "reply": "<demonstrates domain expertise, tuned to this stage>" },
    { "mode": "Strong Understanding", "reply": "<empathy and precision, tuned to this stage>" },
    { "mode": "Sharp & Brief", "reply": "<1-2 sentences, tuned to this stage>" }
  ],
  "stageAssessment": {
    "canAdvance": true/false,
    "reason": "<one sentence>",
    "extracted": {
      "deliverables": ["<item>"],
      "painPoints": ["<item>"],
      "scopeOfWork": "<brief description or empty string>",
      "timeline": "<e.g. '3 weeks' or empty string>"
    }
  }
}${redFlagPromptBlock(customFlags)}${langInstruction}`,
        contextBlock,
      );
      return {
        bestReply: scrubRedFlags(result.bestReply, customFlags),
        bestReplyReason: result.bestReplyReason,
        alternatives: result.alternatives.map((a) => ({ ...a, reply: scrubRedFlags(a.reply, customFlags) })),
        stageAssessment: result.stageAssessment,
      };
    } catch (err) {
      handleAiError(err);
    }
  });

// ─── Research Agent ───────────────────────────────────────────────────────────

const ResearchBriefSchema = z.object({
  clientProfile: z.object({
    likely_industry: z.string(),
    company_size_estimate: z.string(),
    pain_points: z.array(z.string()),
    decision_making_style: z.string(),
    red_flags: z.array(z.string()),
  }),
  jobAnalysis: z.object({
    real_problem: z.string(),
    unstated_needs: z.array(z.string()),
    likely_budget_tier: z.string(),
    competition_level: z.string(),
    win_probability: z.string(),
  }),
  proposalStrategy: z.object({
    opening_angle: z.string(),
    key_credibility_signals: z.array(z.string()),
    objections_to_pre_empt: z.array(z.string()),
    recommended_tone: z.string(),
    one_line_hook: z.string(),
  }),
  quickFacts: z.array(z.string()),
});

export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

export const researchClientAndJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobText: string; clientInfo?: string }) =>
    z.object({
      jobText: z.string().min(10).max(8000),
      clientInfo: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const contextBlock = [
        `JOB POST / DESCRIPTION:\n${data.jobText}`,
        data.clientInfo ? `CLIENT INFO / COMPANY:\n${data.clientInfo}` : null,
      ].filter(Boolean).join("\n\n---\n\n");

      const result = await structured(
        ResearchBriefSchema,
        `You are a senior business intelligence analyst for a freelance consultant. Analyze the job post and client information. Give a concise intel brief so the freelancer knows exactly how to win this job BEFORE writing their proposal.

Be specific, not generic. Read between the lines. Identify what the client ACTUALLY needs vs what they said.

Return JSON:
{
  "clientProfile": {
    "likely_industry": "<specific industry>",
    "company_size_estimate": "<e.g. Solo founder, Small team 5-20, Mid-size 50-200>",
    "pain_points": ["<pain 1>", "<pain 2>", "<pain 3>"],
    "decision_making_style": "<e.g. Fast and intuitive, Risk-averse needs proof, Price-sensitive>",
    "red_flags": ["<warning sign if any, or leave empty>"]
  },
  "jobAnalysis": {
    "real_problem": "<what they ACTUALLY need vs what they asked for>",
    "unstated_needs": ["<thing they didnt say but clearly need>", "<another>"],
    "likely_budget_tier": "<e.g. Under $500 price-shopper, $500-2k serious buyer, $2k+ quality-first>",
    "competition_level": "<e.g. High — generic job many applicants, Low — niche requirement>",
    "win_probability": "<High/Medium/Low — one sentence reason>"
  },
  "proposalStrategy": {
    "opening_angle": "<the single best angle for the first 2 sentences>",
    "key_credibility_signals": ["<what proof to mention>", "<another>"],
    "objections_to_pre_empt": ["<likely objection>", "<another>"],
    "recommended_tone": "<e.g. Peer-to-peer confident, Warm educational, Efficient direct>",
    "one_line_hook": "<one powerful opening sentence to start the proposal with>"
  },
  "quickFacts": ["<fact 1>", "<fact 2>", "<fact 3>", "<fact 4>", "<fact 5>"]
}`,
        contextBlock,
      );
      return result;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Proposal Polisher ----------
export const polishProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposal: string }) =>
    z.object({ proposal: z.string().min(10).max(20000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const result = await structuredWith("verifier",
        z.object({ content: z.string() }),
        `You are a professional editor. Fix ONLY mechanical issues in this freelance proposal — do not change the meaning, phrasing, tone, or structure. Your task:

1. Fix punctuation: add missing periods at sentence ends, fix missing commas before conjunctions, fix double spaces, fix spacing after punctuation
2. Fix capitalization: capitalize first word of each sentence, fix obvious mid-sentence caps errors
3. Remove stray symbols: delete any lone dashes at line starts, remove "---" or "***" or "___ " horizontal rules, remove double asterisks used as bullets
4. Clean paragraph breaks: each paragraph separated by exactly one blank line, no trailing spaces
5. Fix run-together sentences: if two complete sentences are joined without punctuation, split them

CRITICAL — DO NOT TOUCH THESE:
- The final paragraph must end with "?" — if it already does, do NOT change it
- Do NOT add any sentence after a question mark at the end of the proposal
- Do NOT convert the final question into a statement
- Do NOT add closing remarks like "Looking forward to hearing from you" or "Let me know"

Do NOT rephrase, reorder, shorten, or change any words. Return the proposal with mechanical fixes only.

Return JSON: { "content": "<the cleaned proposal text>" }`,
        `PROPOSAL TO POLISH:\n${data.proposal}`,
      );
      return result;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Portfolio Injector ----------

export const injectPortfolioLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposal: string; portfolioItems: Array<{ title: string; url: string; description: string }> }) =>
    z.object({
      proposal: z.string().min(10).max(20000),
      portfolioItems: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })).max(5),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      if (data.portfolioItems.length === 0) {
        // Remove portfolio paragraph — return proposal with it stripped
        const lines = data.proposal.split("\n");
        const filtered = lines.filter((line) => {
          const l = line.toLowerCase();
          return !(l.includes("http") && (l.includes("portfolio") || l.includes("work i've done") || l.includes("relevant work")));
        });
        return { content: filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
      }
      const portfolioBlock = data.portfolioItems
        .map((p, i) => `${i + 1}) ${p.title} — ${p.url} — ${p.description}`)
        .join("\n");
      const result = await structuredWith("verifier",
        z.object({ content: z.string() }),
        `You are editing a freelance proposal. Your ONLY task: update the portfolio paragraph (paragraph 2, right after the hook) to include EXACTLY these portfolio links, each with a one-line relevance note. Keep every other sentence and paragraph 100% identical — word for word. Do not add, remove, or change anything else. If there's no portfolio paragraph yet, insert one as paragraph 2.

Portfolio links to include (this numbered list is INPUT DATA ONLY — never reproduce it as a list):
${portfolioBlock}

FORMATTING (absolute): the portfolio paragraph must be flowing prose in complete sentences. NO bullet points, NO hyphens or dashes as list markers, NO numbered lists, NO line breaks inside the paragraph. Weave each link into a sentence, e.g. "Closest to this is <title> (<url>), where <one-line relevance>." Keep it to one paragraph.

Return JSON: { "content": "<the full updated proposal text>" }`,
        `CURRENT PROPOSAL:\n${data.proposal}`,
      );
      return result;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Strategy Advisor ----------
const StrategyAdviceSchema = z.object({
  recommendedHook: z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    openingLine: z.string(),
  }),
  recommendedStrategy: z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    howToApply: z.string(),
  }),
  hookRanking: z.array(z.object({
    id: z.string(),
    name: z.string(),
    score: z.number().min(0).max(10),
    reason: z.string(),
  })),
  strategyRanking: z.array(z.object({
    id: z.string(),
    name: z.string(),
    score: z.number().min(0).max(10),
    reason: z.string(),
  })),
  lengthRecommendation: z.object({
    length: z.enum(["brief", "robust", "explanatory"]),
    reason: z.string(),
  }),
  winningInsight: z.string(),
  avoidMistakes: z.array(z.string()),
});

export type StrategyAdvice = z.infer<typeof StrategyAdviceSchema>;

const HOOKS_FOR_PROMPT = [
  { id: "pattern_interrupt", name: "Pattern Interrupt", description: "Open with something unexpected to break autopilot." },
  { id: "curiosity_gap", name: "Curiosity Gap", description: "Tease a specific insight they'll want to know." },
  { id: "direct_question", name: "Direct Question", description: "Ask a sharp question mirroring the real problem." },
  { id: "warning", name: "Warning", description: "Name a costly mistake their current path will produce." },
  { id: "shared_frustration", name: "Shared Frustration", description: "Acknowledge the annoying thing they've lived through with other freelancers." },
  { id: "unexpected_compliment", name: "Unexpected Compliment", description: "Notice something specific and real about their business." },
  { id: "i_noticed", name: "I Noticed Something", description: "Point out one concrete detail that proves you read it carefully." },
  { id: "contradiction", name: "Contradiction", description: "Gently challenge their framing in a way that earns attention." },
  { id: "future_pacing", name: "Future Pacing", description: "Paint the post-project picture in one vivid line." },
  { id: "humble_observation", name: "Humble Observation", description: "A low-ego note about what's probably going on under the hood." },
  { id: "consequence", name: "Consequence", description: "Name the downstream cost of leaving the problem unsolved." },
  { id: "problem_solution", name: "Problem Solution", description: "State the problem and exact solution in two crisp sentences." },
];

const STRATEGIES_FOR_PROMPT = [
  { id: "curious_partner", name: "Curious Partner", description: "Thoughtful collaborator who asks the right questions." },
  { id: "advice_first", name: "Advice First", description: "Lead with one piece of expert advice before pitching." },
  { id: "direct_question", name: "Direct Question", description: "Drive the entire proposal around one piercing question." },
  { id: "pattern_interrupt", name: "Pattern Interrupt", description: "Short, sharp, unconventional structure." },
  { id: "narrow_down_first", name: "Narrow Down First", description: "Tighten scope publicly to show senior-level thinking." },
  { id: "future_pacing", name: "Future Pacing", description: "Walk them through the outcome before talking about the work." },
  { id: "humble_observation", name: "Humble Observation", description: "Low-key technical insight that signals seniority." },
  { id: "stack_realist", name: "Stack Realist", description: "Specific about technical realities the client hasn't considered." },
];

export const adviseProposalStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobText: string }) =>
    z.object({ jobText: z.string().min(10).max(8000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const result = await structured(
        StrategyAdviceSchema,
        `You are a world-class freelance proposal strategist. Analyze this job post deeply and choose the BEST hook and strategy combination for winning it. Think like a psychologist who understands what the client is actually feeling, not just what they wrote.

Available hooks:
${HOOKS_FOR_PROMPT.map((h) => `- ${h.id}: "${h.name}" — ${h.description}`).join("\n")}

Available strategies:
${STRATEGIES_FOR_PROMPT.map((s) => `- ${s.id}: "${s.name}" — ${s.description}`).join("\n")}

Instructions:
1. Pick the single BEST hook and write a powerful opening line using it (specific to THIS job, not generic)
2. Pick the single BEST strategy and explain exactly how to apply it to this job
3. Rank ALL hooks and strategies by score (0-10) with a one-sentence reason for each
4. Recommend proposal length: "robust" is the DEFAULT for almost all jobs (including Freelancer.com and crowded markets) because it places the portfolio link correctly right after the hook. Only recommend "brief" when the client explicitly asks for something very short or the platform imposes a hard tiny character limit. Use "explanatory" for complex technical / high-budget jobs.
5. Give one "winning insight" — the non-obvious thing about this client or job that most freelancers will miss
6. List 2-3 specific mistakes to avoid for this particular job

Be specific to THIS job. Do not give generic advice. Reference actual details from the job post.`,
        `JOB POST:\n${data.jobText}`,
      );
      return result;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Contest Brief Generator ----------
const ContestBriefSchema = z.object({
  title: z.string(),
  overview: z.string(),
  designConcept: z.string(),
  colorPalette: z.array(z.object({
    name: z.string(),
    hex: z.string(),
    role: z.string(),
  })),
  typography: z.object({
    primary: z.string(),
    secondary: z.string(),
    rationale: z.string(),
  }),
  keyElements: z.array(z.string()),
  layoutApproach: z.string(),
  moodKeywords: z.array(z.string()),
  differentiator: z.string(),
  deliverables: z.array(z.string()),
  submissionNote: z.string(),
});
export type ContestBrief = z.infer<typeof ContestBriefSchema>;

export const generateContestBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contestDescription: string; additionalContext?: string }) =>
    z.object({
      contestDescription: z.string().min(20).max(10000),
      additionalContext: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const contextBlock = [
        `CONTEST DESCRIPTION:\n${data.contestDescription}`,
        data.additionalContext ? `ADDITIONAL CONTEXT:\n${data.additionalContext}` : null,
      ].filter(Boolean).join("\n\n---\n\n");

      return await structuredWith("writer",
        ContestBriefSchema,
        `You are a senior creative director and contest submission strategist. Analyze this design contest and produce a comprehensive creative brief that a designer can use as their submission document or pitch.

Your goal is to help win the contest by showing original thinking, deep understanding of the brand/context, and a clear execution strategy.

Return JSON with this exact shape:
{
  "title": "<short, punchy project title e.g. 'Bold Identity Rebrand' or 'Minimalist Logo Concept'>",
  "overview": "<2-3 sentence overview of the design approach and why it wins>",
  "designConcept": "<detailed paragraph describing the core creative concept — what it represents, the visual direction, the emotion it evokes>",
  "colorPalette": [
    { "name": "<color name>", "hex": "<#hex code>", "role": "<primary/accent/neutral/background>" },
    { "name": "<color name>", "hex": "<#hex code>", "role": "<role>" },
    { "name": "<color name>", "hex": "<#hex code>", "role": "<role>" }
  ],
  "typography": {
    "primary": "<font name or style — e.g. 'Montserrat Bold', 'Modern geometric sans-serif'>",
    "secondary": "<supporting font or style>",
    "rationale": "<one sentence on why these fonts match the brand>"
  },
  "keyElements": ["<design element 1>", "<element 2>", "<element 3>", "<element 4>"],
  "layoutApproach": "<paragraph describing the visual layout, composition principles, whitespace use, visual hierarchy>",
  "moodKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "differentiator": "<what makes THIS submission stand out from generic contest entries — the unique angle>",
  "deliverables": ["<deliverable 1>", "<deliverable 2>", "<deliverable 3>"],
  "submissionNote": "<1-2 sentences the designer can include as their contest submission message>"
}`,
        contextBlock,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ─── Proposal Image Generator ─────────────────────────────────────────────────

export const generateProposalImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string }) =>
    z.object({ prompt: z.string().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { generateImagePrompted } = await import("./avatar-ai.server");
      const dataUrl = await generateImagePrompted(data.prompt);
      return { dataUrl };
    } catch (err) {
      handleAiError(err);
    }
  });

// ─── Enhance Existing Proposal ────────────────────────────────────────────────

export const enhanceProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposal: string; jobDescription: string; customChanges?: string; mockupLink?: string }) =>
    z.object({
      proposal: z.string().min(20).max(20000),
      jobDescription: z.string().min(10).max(10000),
      customChanges: z.string().max(2000).optional(),
      mockupLink: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const mockupBlock = data.mockupLink
        ? `MOCKUP LINK TO INCLUDE: ${data.mockupLink}
Weave this in naturally after establishing credibility — something like: "I've already put together a quick mockup to show you the direction I'm thinking — [link]. This is just a starting concept and I can tune every single detail to your exact specifications, so nothing is set in stone until you're happy with the direction."`
        : `MOCKUP MENTION (no link yet): Naturally mention that you can quickly produce a mockup to show the client the direction before kicking off. Something like: "I can put together a quick mockup so you can see exactly where I'm heading before we even start — gives you a chance to steer the direction upfront." Make it sound like normal practice, not a sales pitch.`;

      const result = await structured(
        z.object({ content: z.string() }),
        `You are an expert freelance proposal editor. Your task: take an existing proposal (possibly AI-generated or rough) and transform it into a high-converting, human-sounding pitch that gets replies.

RULES:
1. Remove ALL generic AI phrases: "I am passionate about", "Dear Hiring Manager", "I would love the opportunity", "leveraging my expertise", "proven track record", "I am confident that", "look no further", "best regards", "hope this finds you well"
2. Open with a sharp, specific hook that proves you read the brief — reference something concrete from the job description
3. Sound like a confident, experienced peer — not a vendor pitching, not an AI writing filler
4. Keep proposals concise — cut anything that doesn't earn its place
5. ${mockupBlock}
6. End with ONE specific question or clear next step — never "Let me know if you're interested"
7. Keep the freelancer's authentic voice and any specific experience they mention

${data.customChanges ? `CUSTOM CHANGES TO INCORPORATE (do these exactly):\n${data.customChanges}` : ""}

Return JSON: { "content": "<the fully enhanced proposal text>" }`,
        `JOB DESCRIPTION:\n${data.jobDescription}\n\nEXISTING PROPOSAL TO ENHANCE:\n${data.proposal}`,
      );
      return result;
    } catch (err) {
      handleAiError(err);
    }
  });

// ─── Scout Outreach Generator ─────────────────────────────────────────────────

const DevPromptSchema = z.object({
  projectTitle: z.string(),
  jobType: z.enum(["vibe-coding", "full-stack", "automation", "ai-agent", "general-web"]),
  jobTypeName: z.string(),
  overview: z.string(),
  techStack: z.array(z.string()),
  coreFeatures: z.array(z.object({
    feature: z.string(),
    description: z.string(),
    priority: z.enum(["Must Have", "Should Have", "Nice to Have"]),
  })),
  enhancements: z.array(z.object({
    title: z.string(),
    description: z.string(),
    impact: z.string(),
  })),
  architecture: z.string(),
  integrations: z.array(z.string()),
  scalabilityNotes: z.string(),
  vibeCodePrompt: z.string(),
  estimatedComplexity: z.enum(["Simple", "Medium", "Complex", "Enterprise"]),
});
export type DevPrompt = z.infer<typeof DevPromptSchema>;

const ScoutOutreachSchema = z.object({
  subjectLine: z.string(),
  emailBody: z.string(),
  hookRationale: z.string(),
  strategyNote: z.string(),
  spamAvoidanceTips: z.array(z.string()),
  devPrompt: DevPromptSchema,
});
export type ScoutOutreach = z.infer<typeof ScoutOutreachSchema>;

export const generateScoutOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; freelancerContext?: string; customChanges?: string; mockupLink?: string; enable3d?: boolean; websiteData?: string }) =>
    z.object({
      jobDescription: z.string().min(20).max(15000),
      freelancerContext: z.string().max(3000).optional(),
      customChanges: z.string().max(2000).optional(),
      mockupLink: z.string().max(500).optional(),
      enable3d: z.boolean().optional(),
      websiteData: z.string().max(15000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const mockupInstruction = data.mockupLink
        ? `MOCKUP LINK (in the PROOF section): The freelancer has a live mockup/concept ready at ${data.mockupLink}. In the PROOF section of the email, naturally reference it: "I've already put together a quick concept mockup at [link] to show you the direction I'm thinking. It's a starting point — every detail is tunable to your exact vision." This lowers risk and proves real investment upfront.`
        : `MOCKUP MENTION (in the PROOF section): Mention you can quickly put together a mockup before starting: "I can put together a quick concept mockup so you can see the direction before we even kick off — no cost, just so you can give feedback upfront."`;

      const customInstruction = data.customChanges
        ? `\n\nCUSTOM REQUIREMENTS FROM THE FREELANCER (incorporate naturally across all sections):\n${data.customChanges}`
        : "";

      const websiteInstruction = data.websiteData
        ? `\n\nCLIENT EXISTING WEBSITE DATA (use these details in the email — reference their brand, existing design, assets):\n${data.websiteData.slice(0, 8000)}`
        : "";

      const animation3dInstruction = data.enable3d
        ? `\n\n3D ANIMATION DESIGN: The freelancer specializes in 3D web experiences. The vibeCodePrompt MUST include: Three.js or React Three Fiber for 3D scenes, GSAP for smooth animations, parallax scrolling effects, interactive 3D elements that respond to mouse/scroll, particle systems where appropriate, 3D product showcases or hero sections. The overall design language must be premium, cinematic, and motion-rich. Add these to the tech stack.`
        : "";

      // Claude handles scout outreach — both the email and the Lovable prompt are client-facing
      return await structuredWith(
        "writer",
        ScoutOutreachSchema,
        `You are a Senior Creative Director writing two things: a consultative outreach email and a production-ready development brief. Both must be exceptional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL CREATIVE REVIEW — MANDATORY BEFORE RETURNING ANYTHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before returning the email or the brief, perform an internal creative review of your own draft.
Identify and fix every weakness you find, including:

• Generic observations that could apply to any business
• Weak hooks or subject lines that don't earn a reply
• Generic website sections that don't solve a real business problem
• Missed opportunities discovered during the website analysis
• Missing brand assets (logo, colors, fonts, imagery, messaging, testimonials, case studies) that should have been incorporated
• Conversion opportunities that weren't addressed
• UX friction that wasn't solved
• Motion or interaction ideas that feel decorative instead of purposeful
• Copy that sounds like AI or marketing jargon
• Design decisions that don't support a specific business goal
• Opportunities to introduce a memorable "wow" feature unique to this brand
• Missing psychological triggers (trust, urgency, authority, social proof, clarity, reciprocity)
• Missed opportunities to preserve existing strengths while modernizing weaknesses

Then improve the output until it would genuinely impress a Creative Director at a top-tier digital agency.

NEVER return the first draft. Always return the improved version.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — OUTREACH EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The project description is ALWAYS the primary source of truth.
The website audit is ONLY supporting evidence — it never leads.

STEP 1 — Read the project description first.
Identify: what the client wants, what they dislike, what they referenced, what success looks like.

STEP 2 — Use the website audit only to SUPPORT those observations.
Never lead with generic audit findings.
Wrong: "Your SEO is poor."
Right: "I noticed you're moving toward a cleaner experience. While reviewing the current site, I spotted a few opportunities that would naturally support that direction."

STEP 3 — Mention the mockup within the first two sentences.
Busy founders scan. Don't make them read five paragraphs before seeing the deliverable.

STEP 4 — Explain ONE insight only.
One insight demonstrates expertise. Five becomes an audit.

STEP 5 — Connect that insight directly to the client's business goal from the project description.
Never discuss design for the sake of design. Always explain business impact.

STEP 6 — Close naturally.
Never pressure. Never sell aggressively.
Simply ask whether the direction feels aligned.

TONE: calm · observant · confident · founder-to-founder · consultative
The email should feel like someone who already invested time in their project — not someone trying to win a job.

LENGTH: 120–170 words. Not a word more.

SUBJECT LINE: Under 50 characters. Natural, specific, curiosity-provoking. No hype, no ALL CAPS, no emoji.

FORMAT: Plain text. No bullet points. No bold. No headers. Write like a peer.

NEVER mention: Upwork, Freelancer, or where the lead came from. Scores. Generic audit language.
ALWAYS surface the mockup early. One insight only. End with a question.

${mockupInstruction}${customInstruction}${websiteInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — DEVELOPMENT BRIEF (Creative Director standard)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate prompts like a Creative Director, not a software specification.
The goal is NOT to describe every possible feature.
The goal is to produce the highest-quality homepage concept.

RULE 1 — BUSINESS SUMMARY (2-3 sentences)
Summarize what the business does, who it serves, and what problem it solves.

RULE 2 — BRAND ASSET EXTRACTION
Extract and preserve every brand asset:
logo · colors · typography · imagery · iconography · illustration style · spacing · button style · tone of voice
If the brand already has strong identity, preserve and elevate it. Never reinvent it.

RULE 3 — SINGLE BUSINESS OBJECTIVE
Extract the client's ONE core objective from the project description.
Examples: Increase donations. Sell more software. Generate consultations. Improve trust. Launch a product.
Every design decision must serve that objective.

RULE 4 — REFERENCE SITE ANALYSIS (only if references were provided)
Study each referenced site. Do NOT copy them.
Instead extract: layout language · pacing · typography · interaction style · storytelling · visual hierarchy
Blend those ideas with the client's existing brand.

RULE 5 — HOMEPAGE NARRATIVE
Design only what matters.
Instead of listing dozens of sections, design a homepage that naturally tells the business story.
Each section must answer: What does this section accomplish for the business?

RULE 6 — BUSINESS-JUSTIFIED DESIGN DECISIONS
Every design decision must include the business reason.
Never suggest a feature without explaining why it improves: conversion, trust, engagement, clarity, or usability.

RULE 7 — MEANINGFUL MOTION ONLY
Avoid adding GSAP, Three.js, Lenis, Framer Motion, etc. just because they are trendy.
Only use motion where it strengthens storytelling or directs user attention.
${animation3dInstruction}
RULE 8 — INDUSTRY-APPROPRIATE INTERACTIONS
Only introduce advanced interactions when they fit the industry:
Medical → calm · Finance → confidence · Luxury → cinematic · Startup → energetic · Nonprofit → emotional · SaaS → product clarity

RULE 9 — NO GENERIC FILLER
The final brief must read like a creative brief from an award-winning agency — not software documentation.
Every sentence must contribute to producing a stronger design.

RULE 10 — PROMPT LENGTH: 800–1000 words
Clear sections. Experience language throughout ("premium cinematic scroll" not "use GSAP").
Real content only — no Lorem ipsum. Every section earns its place.

Classify the job: vibe-coding (no-code/low-code), full-stack (traditional code), automation (Zapier/Make/n8n), ai-agent (LLM/AI tools), general-web

Return JSON:
{
  "subjectLine": "<under 50 chars, natural, specific to their business, no hype>",
  "emailBody": "<120-170 words, plain text, founder-to-founder tone, mockup mentioned early, ONE insight, closes with a question>",
  "hookRationale": "<why this email creates genuine recognition — not a pitch feeling>",
  "strategyNote": "<the psychological approach — what makes this feel like a peer reaching out, not a vendor>",
  "spamAvoidanceTips": ["<practical deliverability tip>", "<tip 2>", "<tip 3>"],
  "devPrompt": {
    "projectTitle": "<business-outcome focused project name>",
    "jobType": "<vibe-coding|full-stack|automation|ai-agent|general-web>",
    "jobTypeName": "<human readable>",
    "overview": "<2-3 sentences: business problem, target user, desired outcome>",
    "techStack": ["<tech 1>", "<tech 2>"],
    "coreFeatures": [
      { "feature": "<name>", "description": "<business value this delivers>", "priority": "Must Have" }
    ],
    "enhancements": [
      { "title": "<bonus enhancement name>", "description": "<what to build and the business reason>", "impact": "<specific measurable business impact>" }
    ],
    "architecture": "<system design, data flow, scalability — business-aware>",
    "integrations": ["<integration and why it matters for this business>"],
    "scalabilityNotes": "<how this investment grows with the business over 12-24 months>",
    "vibeCodePrompt": "<full creative brief, 800-1000 words, Creative Director standard — business summary, brand assets, single objective, reference analysis, homepage narrative, business-justified decisions, meaningful motion, industry-fit interactions>",
    "estimatedComplexity": "<Simple|Medium|Complex|Enterprise>"
  }
}`,
        `JOB POST:\n${data.jobDescription}${data.freelancerContext ? `\n\nFREELANCER CONTEXT:\n${data.freelancerContext}` : ""}${data.websiteData ? `\n\nCLIENT WEBSITE DATA:\n${data.websiteData.slice(0, 8000)}` : ""}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Analyze Client Website ----------
export type ContentSection = {
  section: string;
  location: string;
  content: string;
  usefulness: string;
};

export type WebsiteScores = {
  branding: number;
  ux: number;
  visualDesign: number;
  content: number;
  performance: number;
  trust: number;
  accessibility: number;
  seo: number;
  conversion: number;
  motionDesign: number;
  overall: number;
  weakestAreas: string[];
  scoreNotes: string;
};

export type WebsiteData = {
  url: string;
  brandName: string;
  title: string;
  description: string;
  businessType: string;
  industry: string;
  primaryGoal: string;
  secondaryGoals: string[];
  targetAudience: string;
  uniqueValueProp: string;
  pricingPosition: string;
  // Scores
  scores: WebsiteScores;
  // Brand assets
  logoUrl: string | null;
  brandColors: string[];
  fontFamilies: string[];
  buttonStyle: string;
  cardStyle: string;
  borderRadius: string;
  shadowStyle: string;
  spacingSystem: string;
  gridSystem: string;
  layoutStyle: string;
  componentStyle: string;
  // Visual assets
  imageUrls: string[];
  videoUrls: string[];
  illustrationStyle: string;
  photographyStyle: string;
  motionStyle: string;
  iconStyle: string;
  // Content & structure
  contentSections: ContentSection[];
  navigationStructure: string[];
  keyPages: string[];
  callsToAction: string[];
  trustSignals: string[];
  existingTech: string[];
  existingAnimations: string;
  interactiveElements: string;
  // Insights
  whatWorks: string;
  opportunities: string;
  conversionBottlenecks: string;
  designLanguage: string;
  seoStructure: string;
  mobileExperience: string;
  businessInsights: string;
};

export const analyzeClientWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) =>
    z.object({ url: z.string().url().max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let html = "";
      try {
        let res: Response;
        try {
          res = await fetch(data.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
            },
          });
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          if (msg.includes("abort")) throw new Error("Website took too long to respond (15s timeout). Try again or check the URL.");
          throw new Error(`Could not reach the website: ${msg}`);
        }
        if (!res.ok) throw new Error(`Website returned HTTP ${res.status}. Make sure the URL is correct and publicly accessible.`);
        html = await res.text();
        if (!html.trim()) throw new Error("Website returned an empty page. It may require JavaScript to load (try a different URL).");
      } finally {
        clearTimeout(timeout);
      }

      const baseUrl = new URL(data.url).origin;

      // Extract logo — look for <link rel="icon">, og:image, and common logo patterns
      const logoMatches = [
        // og:image
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1],
        // <img> with "logo" in class/id/alt/src
        html.match(/<img[^>]+(?:id|class|alt|src)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1],
        html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:id|class|alt)=["'][^"']*logo[^"']*["']/i)?.[1],
        // SVG logo inline (just note it exists)
      ].filter(Boolean)[0] ?? null;

      const resolveUrl = (u: string | null) => {
        if (!u) return null;
        if (u.startsWith("http")) return u;
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return baseUrl + u;
        return data.url.replace(/\/[^/]*$/, "/") + u;
      };

      const logoUrl = resolveUrl(logoMatches ?? null);

      // Extract all image URLs
      const allImgMatches = [...html.matchAll(/(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpg|jpeg|png|webp|gif|avif|svg))["']/gi)]
        .map((m) => resolveUrl(m[1]))
        .filter((u): u is string => !!u && u.startsWith("http"))
        .filter((u, i, arr) => arr.indexOf(u) === i) // dedupe
        .slice(0, 15);

      // Also grab srcset images
      const srcsetMatches = [...html.matchAll(/srcset=["']([^"']+)["']/gi)]
        .flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0]))
        .map(resolveUrl)
        .filter((u): u is string => !!u && u.startsWith("http"))
        .slice(0, 5);

      const imageUrls = [...new Set([...allImgMatches, ...srcsetMatches])].slice(0, 15);

      // Extract video URLs
      const videoUrls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:mp4|webm|ogg|mov))["']/gi)]
        .map((m) => resolveUrl(m[1]))
        .filter((u): u is string => !!u && u.startsWith("http"))
        .slice(0, 5);

      // Extract font families from CSS font-family declarations and Google Fonts links
      const fontFamilies: string[] = [];
      const googleFontsMatch = html.match(/fonts\.googleapis\.com\/css[^"']+families?=([^"'&]+)/gi);
      if (googleFontsMatch) {
        googleFontsMatch.forEach((m) => {
          const families = decodeURIComponent(m).match(/family=([^&|"']+)/i)?.[1];
          if (families) {
            families.split("|").forEach((f) => {
              const name = f.split(":")[0].replace(/\+/g, " ").trim();
              if (name && !fontFamilies.includes(name)) fontFamilies.push(name);
            });
          }
        });
      }
      // Also check inline CSS for font-family
      const inlineFonts = [...html.matchAll(/font-family:\s*['"]?([^;'"}{,]+)/gi)]
        .map((m) => m[1].split(",")[0].replace(/['"]/g, "").trim())
        .filter((f) => f && !f.startsWith("-") && f.length > 2)
        .slice(0, 5);
      inlineFonts.forEach((f) => { if (!fontFamilies.includes(f)) fontFamilies.push(f); });

      // Strip scripts/styles for text analysis
      const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 8000);

      const ScoreSchema = z.object({
        branding: z.number().int().min(1).max(10),
        ux: z.number().int().min(1).max(10),
        visualDesign: z.number().int().min(1).max(10),
        content: z.number().int().min(1).max(10),
        performance: z.number().int().min(1).max(10),
        trust: z.number().int().min(1).max(10),
        accessibility: z.number().int().min(1).max(10),
        seo: z.number().int().min(1).max(10),
        conversion: z.number().int().min(1).max(10),
        motionDesign: z.number().int().min(1).max(10),
        overall: z.number().int().min(1).max(10),
        weakestAreas: z.array(z.string()).default([]),
        scoreNotes: z.string(),
      });

      const WebsiteSchema = z.object({
        brandName: z.string(),
        title: z.string(),
        description: z.string(),
        businessType: z.string(),
        industry: z.string(),
        primaryGoal: z.string(),
        secondaryGoals: z.array(z.string()).default([]),
        targetAudience: z.string(),
        uniqueValueProp: z.string(),
        pricingPosition: z.string().default(""),
        scores: ScoreSchema,
        brandColors: z.array(z.string()).default([]),
        buttonStyle: z.string().default(""),
        cardStyle: z.string().default(""),
        borderRadius: z.string().default(""),
        shadowStyle: z.string().default(""),
        spacingSystem: z.string().default(""),
        gridSystem: z.string().default(""),
        layoutStyle: z.string().default(""),
        componentStyle: z.string().default(""),
        illustrationStyle: z.string().default(""),
        photographyStyle: z.string().default(""),
        motionStyle: z.string().default(""),
        iconStyle: z.string().default(""),
        navigationStructure: z.array(z.string()).default([]),
        keyPages: z.array(z.string()).default([]),
        callsToAction: z.array(z.string()).default([]),
        trustSignals: z.array(z.string()).default([]),
        existingTech: z.array(z.string()).default([]),
        existingAnimations: z.string().default(""),
        interactiveElements: z.string().default(""),
        contentSections: z.array(z.object({
          section: z.string(),
          location: z.string(),
          content: z.string(),
          usefulness: z.string(),
        })).default([]),
        whatWorks: z.string(),
        opportunities: z.string(),
        conversionBottlenecks: z.string(),
        designLanguage: z.string(),
        seoStructure: z.string().default(""),
        mobileExperience: z.string().default(""),
        businessInsights: z.string().default(""),
      });

      const analysis = await structuredWith("analyzer",
        WebsiteSchema,
        `You are a senior digital strategist, UX consultant, brand analyst, and CRO expert analyzing a client's website. Your analysis will directly power a web developer's outreach and mockup prompt — so extract everything with precision and business intelligence.

STEP 1 — SCORE THE WEBSITE (1-10 each, where 1 = critical failure, 5 = average, 10 = world-class):
- Branding: logo quality, color consistency, brand voice, visual identity coherence
- UX: navigation clarity, information architecture, user flow, friction points
- Visual Design: typography, layout, whitespace, hierarchy, design system consistency
- Content: clarity, persuasiveness, readability, storytelling, SEO copy quality
- Performance: page speed signals, image optimization, code bloat, render-blocking
- Trust: testimonials, social proof, credentials, guarantees, security signals
- Accessibility: contrast ratios, alt text, semantic HTML, keyboard navigation
- SEO: meta tags, heading structure, internal linking, schema markup
- Conversion: CTA clarity, urgency, lead capture, funnel optimization
- Motion Design: existing animations, transitions, micro-interactions quality

Identify the 3 LOWEST scoring areas — these drive every recommendation.

STEP 2 — EXTRACT COMPLETE ASSET INVENTORY:
Extract and document every design asset, component style, and content piece visible.

Return a JSON object with EXACTLY this structure:
{
  "brandName": "<business/brand name>",
  "title": "<exact main headline as written on the site>",
  "description": "<2-3 sentences: what they do, who they serve, what problem they solve>",
  "businessType": "<SaaS / E-commerce / Local Service / Agency / Personal Brand / B2B / Nonprofit / etc.>",
  "industry": "<specific: Healthcare, Real Estate, Fintech, Food & Beverage, Legal, etc.>",
  "primaryGoal": "<single primary conversion: Book a call / Buy a product / Generate leads / Sign up>",
  "secondaryGoals": ["<secondary conversion 1>", "<secondary conversion 2>"],
  "targetAudience": "<specific buyer persona — who they are, what they want, why they buy>",
  "uniqueValueProp": "<the core differentiating promise to customers>",
  "pricingPosition": "<premium / mid-market / budget / not visible — with any visible price points>",
  "scores": {
    "branding": <1-10>,
    "ux": <1-10>,
    "visualDesign": <1-10>,
    "content": <1-10>,
    "performance": <1-10>,
    "trust": <1-10>,
    "accessibility": <1-10>,
    "seo": <1-10>,
    "conversion": <1-10>,
    "motionDesign": <1-10>,
    "overall": <1-10, weighted average>,
    "weakestAreas": ["<lowest scoring area name>", "<second lowest>", "<third lowest>"],
    "scoreNotes": "<2-3 sentences on the biggest gaps and why they matter for this business>"
  },
  "brandColors": ["<hex if detectable, or descriptive e.g. 'deep navy #0A1628'>"],
  "buttonStyle": "<shape/style: e.g. 'pill with drop shadow, teal fill, white text, 14px font'>",
  "cardStyle": "<e.g. 'flat white with 1px border, subtle shadow, 16px radius'>",
  "borderRadius": "<e.g. '8px cards, 4px inputs, pill CTAs'>",
  "shadowStyle": "<e.g. 'subtle elevation shadows, no glow effects'>",
  "spacingSystem": "<e.g. '24px base unit, generous whitespace, section padding ~80px'>",
  "gridSystem": "<e.g. '12-column with 24px gutter, max-width 1200px'>",
  "layoutStyle": "<e.g. 'centered content blocks, full-width hero, asymmetric feature sections'>",
  "componentStyle": "<overall component language: e.g. 'minimal flat components, no decorative borders'>",
  "illustrationStyle": "<none / flat vector / 3D / hand-drawn / abstract / photographic collage>",
  "photographyStyle": "<none / studio / lifestyle / product / dark cinematic / bright editorial>",
  "motionStyle": "<none / subtle CSS transitions / scroll animations / parallax / video backgrounds>",
  "iconStyle": "<none / outline / filled / duotone / custom illustrated>",
  "navigationStructure": ["<nav item 1>", "<nav item 2>"],
  "keyPages": ["Home", "<other linked pages>"],
  "callsToAction": ["<exact CTA text as written>"],
  "trustSignals": ["<testimonial snippet or type>", "<badge/cert>", "<client logo mention>"],
  "existingTech": ["<WordPress / Shopify / Webflow / React / HubSpot / etc.>"],
  "existingAnimations": "<describe any visible animations or 'none detected'>",
  "interactiveElements": "<forms, calculators, chatbots, filters, accordions — or 'none detected'>",
  "contentSections": [
    {
      "section": "<Hero / About / Services / Features / Testimonials / Pricing / CTA / Footer>",
      "location": "<Above the fold / Upper / Mid-page / Lower / Footer>",
      "content": "<verbatim copy from this section — exact words — developer will reuse this>",
      "usefulness": "<specific reason to preserve this: 'strong headline', 'social proof to keep', 'service names to reuse'>"
    }
  ],
  "whatWorks": "<3 specific genuine strengths — content, design, or messaging that actually works>",
  "opportunities": "<4 specific strategic improvements addressing the LOWEST-scored areas>",
  "conversionBottlenecks": "<what is concretely losing them customers right now>",
  "designLanguage": "<full visual style description: typography mood, color energy, layout density, design era>",
  "seoStructure": "<H1/H2 usage, meta description presence, structured data, internal link quality>",
  "mobileExperience": "<mobile layout quality based on any responsive signals in the HTML>",
  "businessInsights": "<2-3 sentences: business context, market position, competitive angle — from a consultant's perspective>"
}

CRITICAL: contentSections must contain the REAL verbatim copy from the website. This is what the developer uses to reuse existing messaging. Include EVERY meaningful section.`,
        `Website URL: ${data.url}\n\nWebsite content:\n${stripped}`,
      );

      return {
        url: data.url,
        logoUrl,
        fontFamilies: [...new Set(fontFamilies)].slice(0, 8),
        imageUrls,
        videoUrls,
        ...analysis,
      } as WebsiteData;
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Inline text rewrite (selection on the proposal page) ----------
const RewriteActions = z.enum(["rewrite", "expand", "shorten", "formalize", "soften"]);

export const rewriteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; action: "rewrite" | "expand" | "shorten" | "formalize" | "soften"; context?: string }) =>
    z.object({
      text: z.string().min(1).max(4000),
      action: RewriteActions,
      context: z.string().max(8000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const guidance: Record<string, string> = {
        rewrite: "Rewrite this passage so it's sharper, more specific, and more confident. Keep the same meaning and roughly the same length.",
        expand: "Expand this passage with one or two more concrete details or examples. Add depth without padding. Keep the same voice.",
        shorten: "Tighten this passage to about 60% of its current length. Keep the punchiest words; drop filler. Same meaning.",
        formalize: "Rewrite this passage in a more professional, business-formal register without sounding stiff.",
        soften: "Rewrite this passage in a warmer, more conversational, plain-spoken register.",
      };
      const text = await generateWithFallback({
        system: `You rewrite freelance-proposal passages. Output ONLY the rewritten passage — no preamble, no quotes, no markdown. Preserve the user's intent and voice. Never invent claims the original didn't make.`,
        prompt: `${guidance[data.action]}\n\nPassage:\n"""\n${data.text}\n"""\n\n${data.context ? `Surrounding proposal context (for tone awareness only — do not repeat):\n"""\n${data.context.slice(0, 4000)}\n"""\n` : ""}Return only the rewritten passage.`,
      });
      return { text: text.trim().replace(/^["'`]+|["'`]+$/g, "") };
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Translate to English (Fix 11 — review-only preview) ----------
// A straightforward translation for sanity-checking a non-English proposal before
// sending. Uses the verifier role (cheap) — translation doesn't need the top model.
// This never replaces the real proposal; it's surfaced as a labeled preview only.
export const translateToEnglish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; sourceLanguage?: string }) =>
    z.object({
      text: z.string().min(1).max(8000),
      sourceLanguage: z.string().max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const src = data.sourceLanguage ? ` from ${data.sourceLanguage}` : "";
      const text = await generateWithProvider("verifier", {
        system: `You are a precise translator. Translate the freelance proposal${src} into natural, fluent English. Output ONLY the English translation — no preamble, no notes, no quotes, no markdown. Preserve meaning, tone, and paragraph breaks exactly. Do not add, remove, or invent any content — this is a faithful translation for review.`,
        prompt: `Translate this into English:\n\n${data.text}`,
      });
      return { text: text.trim() };
    } catch (err) {
      handleAiError(err);
    }
  });
