import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback, generateWithProvider, generateObjectWithFallback, generateObjectWithProvider, verifyOutput } from "./ai-gateway.server";
import { z } from "zod";
import { CTAS, FORBIDDEN_PHRASES, HOOKS, LENGTHS, STRATEGIES } from "./proposal-constants";
import { redFlagPromptBlock, scrubRedFlags } from "./red-flags";

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
});
export type JobAnalysis = z.infer<typeof AnalysisSchema>;

export const analyzeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string }) =>
    z.object({ jobDescription: z.string().min(20).max(15000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const hookList = HOOKS.map((h) => `- ${h.id}: ${h.name} — ${h.description}`).join("\n");
      const strategyList = STRATEGIES.map((s) => `- ${s.id}: ${s.name} — ${s.description}`).join("\n");
      const ctaList = CTAS.map((c) => `- ${c.id}: ${c.name} — ${c.description}`).join("\n");
      // Gemini Flash handles structured extraction — fast, free, excellent at JSON
      return await structuredWith(
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
    } catch (err) {
      handleAiError(err);
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
        `You are an expert freelance proposal strategist. Based on the job description, craft ONE highly specific hook opening and ONE tailored strategy that are uniquely designed for THIS job — not generic templates.

The hook should:
- Be specific to details visible in this job post (mention their industry, problem, or an insight they wouldn't expect)
- Immediately signal the freelancer has done this exact kind of work before
- Not start with "I" — use an observation, a question, a fact, or a reframe

The strategy should:
- Define how the ENTIRE proposal flows (not just the opening)
- Be shaped by what this client actually cares about (urgency, quality, cost, trust)
- Give a structural approach the proposal writer can execute

Return a JSON object with this exact shape:
{
  "hookName": "<short memorable name for this hook, 2-4 words>",
  "hookOpeningLine": "<the actual opening sentence or two the freelancer should use — ready to paste>",
  "hookRationale": "<why this specific hook works for this specific job>",
  "strategyName": "<short memorable name for this strategy, 2-4 words>",
  "strategyApproach": "<describe how the proposal should be structured from hook to CTA — specific to this job>",
  "strategyRationale": "<why this strategy will work for this client>"
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
      const hook = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0];
      const a = data.analysis as JobAnalysis | null;
      const context = a
        ? `Pain point: ${a.painPoint}\nHidden needs: ${a.hiddenNeeds}\nRecommended approach: ${a.recommendedApproach}\nEntities: ${(a.extractedEntities ?? []).join(", ")}`
        : "";
      return await structuredWith(
        "writer",
        z.object({ hookParagraph: z.string() }),
        `You craft the opening paragraph of freelance proposals. Write the FIRST PARAGRAPH ONLY — 2-4 sentences, nothing else.

Hook technique to deploy: "${hook.name}" — ${hook.description}

Rules:
- Do NOT start with "I" — open with an observation, question, fact, or reframe
- Reference at least one SPECIFIC detail from the job post or client context
- The client must read this and think "this person has done this exact work before"
- Sound like a confident human being, not a pitch machine
- No generic opener, no praise for the job posting, no "I came across your post"
- 2-4 sentences maximum

Return JSON: { "hookParagraph": "<the opening paragraph — ready to paste>" }`,
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
      const cta = CTAS.find((c) => c.id === data.ctaId) ?? CTAS[0];
      const a = data.analysis as JobAnalysis | null;
      const context = a ? `Pain point: ${a.painPoint}\nHidden needs: ${a.hiddenNeeds}` : "";
      return await structuredWith(
        "challenger",
        z.object({ ctaLine: z.string() }),
        `You craft the closing CTA (1-2 sentences) for freelance proposals. Write the CLOSING LINE ONLY — nothing else.

CTA style: "${cta.name}" — ${cta.description}

Rules:
- MUST be either a sharp question OR a specific concrete suggestion with a clear next step
- Reference something SPECIFIC from the job post — their timeline, their tool, their challenge, their goal
- NEVER use: "Let me know if interested", "Feel free to reach out", "Looking forward to hearing from you", "I'd love the opportunity"
- Sound direct and confident — not desperate, not stiff
- 1-2 sentences only

Return JSON: { "ctaLine": "<the closing line — ready to paste>" }`,
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

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    jobDescription: string;
    analysis?: JobAnalysis | null;
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
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      // Use AI-generated custom text if provided, otherwise fall back to preset lists
      const hookLabel = data.craftedHookParagraph
        ? `PRE-CRAFTED OPENING — use this EXACTLY as your first paragraph: "${data.craftedHookParagraph}"`
        : data.customHookText
        ? `AI-Generated Custom Hook — ${data.customHookText}`
        : (() => { const h = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0]; return `${h.name} — ${h.description}`; })();
      const strategyLabel = data.customStrategyText
        ? `AI-Generated Custom Strategy — ${data.customStrategyText}`
        : (() => { const s = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0]; return `${s.name} — ${s.description}`; })();
      const cta = CTAS.find((c) => c.id === data.ctaId) ?? CTAS[0];
      const ctaLabel = data.craftedCtaLine
        ? `PRE-CRAFTED CLOSING — use this EXACTLY as your final sentence(s): "${data.craftedCtaLine}"`
        : `${cta.name} — ${cta.description}`;
      const hook = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0];
      const strategy = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0];
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

      // Claude handles proposal writing — best prose quality
      const result = await structuredWith(
        "writer",
        ProposalSchema,
        `You write freelance proposals that win because the client FEELS understood — not impressed, not sold to, understood.

The gold standard: the client reads this and thinks "this person has seen my exact problem before and knows exactly how it ends." That feeling comes from specificity, not claims. Never say "I understand your needs." Instead, name the specific thing they're dealing with, name the downstream cost of it, name the thing they probably haven't tried yet.

Hard rules:
- No greeting. No "Hi". Start directly with the hook.${languageInstruction}${toneInstruction}
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
  The CTA is the VERY LAST sentence(s) of the proposal. It MUST take one of these two forms (pick whichever fits the CTA style assigned):
  FORM A — A QUESTION: Ask one sharp, specific question that directly relates to a detail from their job post — their timeline, their existing setup, their specific challenge, their decision-making, or their goal. The question must make them want to answer it. It should NOT be answerable with yes/no. It should open a conversation about the project. Examples: "Are you looking to have the MVP ready before [their stated date], or is there flexibility on phasing the features?" / "What does your current [their tool/process] look like — are you starting from scratch or migrating existing data?" / "Which part of the project concerns you most — the [technical challenge] or getting the first version live fast?"
  FORM B — A SPECIFIC NEXT STEP: Offer one concrete, low-friction action. Not "let me know if interested" — a real invite with specificity. Examples: "If you want, I can put together a quick scope breakdown for the first phase before we even agree on anything." / "Happy to jump on a 15-minute call this week to walk through my approach — no pitch, just the plan." / "I can have a first concept ready in 48 hours if you want to see the direction before deciding."
  HARD RULES for the CTA: Never use "Let me know if interested", "Feel free to reach out", "Looking forward to hearing from you", "I'd love the opportunity", or any variation of these. The CTA must reference something SPECIFIC from their job post — a timeline, a feature, a concern they mentioned, their industry. Generic CTAs are not acceptable.
- LENGTH ENFORCEMENT (this is a hard rule):
  * brief: MAXIMUM 1500 characters total. This is for Freelancer.com where character limits are strict. Structure (in this order): Hook paragraph (3-4 sentences, each a distinct insight about THEIR specific problem — no filler, no transitions), one razor-sharp question that pivots from problem to solution, one confident CTA that gives a specific next step (e.g. timeline, a quick call, a scope doc — never "let me know"). Zero portfolio links. Zero milestones. Zero execution plan. These 1500 characters must hit harder than a 4000-character generic proposal.
  * robust: 2000–3000 characters. Hook paragraph → portfolio paragraph (PARAGRAPH 2 — immediately after hook) → deliverables → one advice sentence → ${data.includePlan ? "execution plan → " : ""}question → CTA.
  * explanatory: 3000–5000 characters. All sections fully developed. Detailed execution plan. Full milestones if provided.
  You are writing a "${length.name}" proposal so the rules for "${length.id}" apply.
- PARAGRAPH ORDER (mandatory): 1) Hook paragraph — your most compelling opening insight. ${data.portfolioItems.length > 0 ? "2) Portfolio paragraph — IMMEDIATELY after the hook, before anything else. Include EVERY portfolio link from the PORTFOLIO ITEMS section above, each with a one-line sentence explaining how it's relevant to THIS specific job. Do not bury portfolio links later in the proposal. 3) " : "2) "}Deliverables paragraph (2-4 sentences about outcomes, not steps). ${data.portfolioItems.length > 0 ? "4" : "3"}) One non-obvious advice/warning sentence. ${data.includePlan ? (data.portfolioItems.length > 0 ? "5" : "4") + ") 2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a natural paragraph. " : ""}Final paragraph: One open-ended question followed by a specific call to action.
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
        `Job post:\n${data.jobDescription}\n\n${analysisBlock}\n\n${portfolioBlock}\n\n${milestoneBlock}\n\nBudget: ${data.budget || "not specified"}${data.strategyDocument ? `\n\nStrategy reference:\n${data.strategyDocument}` : ""}\n\n${strategyBlock}${data.targetLanguage && data.targetLanguage.toLowerCase() !== "english" ? `\n\nOUTPUT LANGUAGE: ${data.targetLanguage}` : ""}`,
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

The gold standard: the client reads this and thinks "this person has seen my exact problem before and knows exactly how it ends." That feeling comes from specificity, not claims. Never say "I understand your needs." Instead, name the specific thing they're dealing with, name the downstream cost of it, name the thing they probably haven't tried yet.

Hard rules:
- No greeting. No "Hi". Start directly with the hook.${data.targetLanguage && data.targetLanguage.toLowerCase() !== "english" ? `\n- LANGUAGE: Write the ENTIRE proposal in ${data.targetLanguage}.` : ""}
- NO BULLET POINTS. NO HYPHENS. NO DASHES as list markers. Write in clean flowing prose only.
- CONFIDENCE WITHOUT ARROGANCE: Write like someone who has solved this exact type of problem before and is not anxious about it.
- DO NOT parrot or restate the job post. Echo the client's stated needs at most ~30%. The other ~70% must be YOUR original interpretation, deeper insight, and value they did NOT explicitly ask for.
- Forbidden phrases (NEVER use any of these): ${FORBIDDEN_PHRASES.map((p) => `"${p}"`).join(", ")}
- Use the assigned HOOK: ${data.customHookText ? `AI-Generated Custom Hook — ${data.customHookText}` : (() => { const h = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0]; return `${h.name} — ${h.description}`; })()}
- Use the assigned STRATEGY: ${data.customStrategyText ? `AI-Generated Custom Strategy — ${data.customStrategyText}` : (() => { const s = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0]; return `${s.name} — ${s.description}`; })()}
- GROUNDING ENFORCEMENT (non-negotiable): The following specific entities MUST appear in the proposal. Reference AT LEAST 3 naturally: ${(data.extractedEntities ?? []).join(", ")}
- SPECIFICITY FAILURE DETECTED — previous draft scored ${verification.specificity}/10 with only ${verification.entityUsage} entity references. Verifier complaint: "${verification.complaint}". Fix this by anchoring EVERY paragraph to a specific detail from the job post.
- FORMATTING RULES: Write in clean flowing prose. Separate paragraphs with ONE blank line. No markdown.

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
      if (data.length === "brief") {
        const MAX = 1500;
        let text = currentResult.content;
        if (text.length > MAX) {
          // Find the last question mark before MAX — keep the CTA after it
          const cut = text.slice(0, MAX);
          const lastQ = cut.lastIndexOf("?");
          if (lastQ > 800) {
            // Keep through the question, then find the first sentence end after it
            const afterQ = text.slice(lastQ + 1).trimStart();
            const firstEnd = afterQ.search(/[.!?]/);
            text = firstEnd > -1 && (lastQ + firstEnd + 2) < MAX + 300
              ? text.slice(0, lastQ + firstEnd + 3).trimEnd()
              : cut.slice(0, lastQ + 1).trimEnd();
          } else {
            const lastPunct = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
            text = lastPunct > 800 ? cut.slice(0, lastPunct + 1).trimEnd() : cut.trimEnd();
          }
          finalResult = { ...currentResult, content: text };
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
      return { ...finalResult, content: scrubRedFlags(cleanContent, customFlags) };
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
  .inputValidator((d: { proposalText: string; instruction: string }) =>
    z.object({
      proposalText: z.string().min(10).max(10000),
      instruction: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      const text = await generateWithProvider("writer", {
        system: `You are a professional proposal editor. The user gives you a freelance proposal and an instruction to improve it. Apply the instruction surgically — change ONLY what is asked. Preserve the overall structure and voice unless instructed otherwise. Return ONLY the revised proposal text with no commentary, no preamble, no "Here is the revised..." prefix. Just the proposal text itself.

Rules:
- Never add greeting lines ("Hi", "Hello", "Dear")
- Never add generic openers
- Preserve line breaks and paragraph structure
- If asked to shorten, cut filler but keep every specific point
- If asked to change tone, apply it throughout consistently
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

      const result = await structuredWith("writer",
        ConversionSchema,
        `You are a rapid-response conversion coach for freelancers. The client is waiting. Read the FULL conversation history carefully so you can continue the thread naturally — do not restart or summarize what was already said. Generate:

1. The single BEST reply — the one most likely to move the conversation toward a hire RIGHT NOW, serving Stage ${stage} goal: "${stageLabel}".
2. A brief reason (1-2 sentences) explaining why this reply wins given the full context.
3. 5 alternative replies, each with a distinct approach.
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

Return a JSON object:
{
  "bestReply": "<the single best reply to send>",
  "bestReplyReason": "<1-2 sentence explanation of why this approach wins>",
  "alternatives": [
    { "mode": "Founder-to-Founder", "reply": "<strategic, peer-to-peer>" },
    { "mode": "As a Friend", "reply": "<warm, genuine, casual>" },
    { "mode": "Show Knowledge", "reply": "<demonstrates domain expertise>" },
    { "mode": "Strong Understanding", "reply": "<leads with empathy and precision>" },
    { "mode": "Sharp & Brief", "reply": "<1-2 sentences, for busy clients>" }
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
      const portfolioBlock = data.portfolioItems.map((p) => `- ${p.title}: ${p.url} — ${p.description}`).join("\n");
      const result = await structuredWith("verifier",
        z.object({ content: z.string() }),
        `You are editing a freelance proposal. Your ONLY task: update the portfolio paragraph (paragraph 2, right after the hook) to include EXACTLY these portfolio links, each with a one-line relevance note. Keep every other sentence and paragraph 100% identical — word for word. Do not add, remove, or change anything else. If there's no portfolio paragraph yet, insert one as paragraph 2.

Portfolio links to include:
${portfolioBlock}

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
4. Recommend proposal length: "brief" (Freelancer.com / crowded market), "robust" (standard Upwork), "explanatory" (complex technical / high-budget)
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
      websiteData: z.string().max(5000).optional(),
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
        ? `\n\nCLIENT EXISTING WEBSITE DATA (use these details in the email — reference their brand, existing design, assets):\n${data.websiteData}`
        : "";

      const animation3dInstruction = data.enable3d
        ? `\n\n3D ANIMATION DESIGN: The freelancer specializes in 3D web experiences. The vibeCodePrompt MUST include: Three.js or React Three Fiber for 3D scenes, GSAP for smooth animations, parallax scrolling effects, interactive 3D elements that respond to mouse/scroll, particle systems where appropriate, 3D product showcases or hero sections. The overall design language must be premium, cinematic, and motion-rich. Add these to the tech stack.`
        : "";

      // Claude handles scout outreach — both the email and the Lovable prompt are client-facing
      return await structuredWith(
        "writer",
        ScoutOutreachSchema,
        `You are a Senior Creative Director, UX Strategist, Conversion Optimization Expert, Brand Consultant, Product Designer, Motion Designer, and AI Vibe Coding Specialist. You write two things: a consultative email and a production-ready Lovable prompt. Both must be exceptional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — EMAIL OUTREACH (non-negotiable rules)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER mention Upwork, Freelancer, or where the lead came from.
2. Start with a genuine observation that proves the website was reviewed — specific detail only someone who visited would know.
3. Identify ONE business problem, not ten. Focus kills ambiguity. Ambiguity kills replies.
4. Explain the business impact of that ONE problem — in revenue, trust, or customer terms.
5. Offer ONE clear improvement rather than a complete redesign. An evolution, not a revolution.
6. Sound like a consultant sharing an insight, not a freelancer pitching services. No "I'd love to help", no "amazing opportunity".
7. End with a low-friction CTA — offer a free concept, or ask whether the direction aligns with their goals.
8. Keep the email under 220 words. Shorter is always stronger.
9. Avoid buzzwords, exaggerated claims, emojis, and overly promotional language.

SCORING CONTEXT: If website data includes scores, the WEAKEST areas drive the ONE problem you identify. Never mention scores in the email — translate them into business observations only.

SUBJECT LINE: Under 50 characters. Natural, specific, curiosity-provoking. Reads like it came from someone who knows their business. No hype, no ALL CAPS, no emoji.

EMAIL STRUCTURE:
- Opening: genuine observation about something specific (a strength first, then the gap)
- Business problem: the one issue that costs them customers or revenue
- Business impact: what this problem actually costs them
- Improvement: one clear direction — evolution of what exists, not replacement
- Proof: ${mockupInstruction}
- CTA: one sentence asking for their reaction or offering a free look

Plain text only. No lists. No bold. No headers. Write like a peer.
${customInstruction}${websiteInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — LOVABLE DEVELOPMENT PROMPT (13-phase master instruction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your job is NOT to create a beautiful website. Your job is to create a website that solves the client's business problem while looking like a premium agency designed it.

PHASE 1 — DEEP BRAND DISCOVERY
Analyze every available source before making any design decisions: existing website, competitor context, brand assets, images, videos, logo, fonts, color palette, brand voice, content, CTA strategy, product positioning, services, navigation, SEO structure, user journey. Extract: business goals, target audience, customer pain points, value proposition, trust signals, brand personality, visual identity, existing strengths and weaknesses. Never redesign blindly.

PHASE 2 — BRAND PRESERVATION
Do NOT reinvent the company. Preserve everything that already builds trust: logo, brand colors, typography, photography, videos, existing content, SEO structure, product information, brand personality. Only improve presentation, hierarchy, usability, storytelling and conversion. Rewrite content only when it improves clarity, trust, conversion, or readability — never just to make it different.

PHASE 3 — BUSINESS STRATEGY
Identify hidden business problems, UX friction, trust issues, conversion bottlenecks, navigation problems, information hierarchy problems, CTA problems, mobile usability issues, and accessibility issues. Design every section to solve an actual business problem. Every design decision must increase at least one of: Trust, Clarity, Authority, Conversion, Engagement, or Brand Perception.

PHASE 4 — REFERENCE ANALYSIS (if references provided)
Extract inspiration from: layout rhythm, typography hierarchy, white space, motion language, transition style, image treatment, storytelling, scroll behavior, CTA presentation, navigation, component system, grid, section spacing, premium interactions. Never clone. Merge the best ideas into a unique experience.

PHASE 5 — PREMIUM ART DIRECTION
Design like an award-winning digital agency. Aim for the quality of Cuberto, Active Theory, Locomotive, Dogstudio, Instrument, Basic Agency. The website should feel premium without sacrificing usability.

PHASE 6 — PREMIUM MOTION SYSTEM
Every section must include motion. Describe (in experience terms, not implementation): page load animation, hero reveal, scroll animation, hover animation, cursor interaction, micro-interactions, card animations, button animations, text reveals, section transitions, footer reveal. Motion must feel cinematic and intentional. Never generic fade-ins.${animation3dInstruction}

PHASE 7 — MODERN 3D EXPERIENCE (when appropriate)
3D must communicate business value, not decoration. Possible approaches: depth layers, floating objects, ambient lighting, glass morphism, soft shadows, parallax, camera movement, interactive product showcases, particle systems, dynamic lighting. Describe the EXPERIENCE, not the implementation. "A floating 3D product that responds to scroll" not "use Three.js".

PHASE 8 — UX PSYCHOLOGY
Every section must answer one psychological question:
- Hero → Why should I care?
- About → Why should I trust you?
- Services → Why are you different?
- Case Studies → Can you prove it?
- Testimonials → Can people like me succeed?
- CTA → What should I do next?
Never place a section without a psychological purpose.

PHASE 9 — CONVERSION COPYWRITING
Rewrite content using: outcome-driven messaging, benefit-first headlines, short paragraphs, high readability, premium tone, founder-focused language, strong CTAs, trust-building copy. Never use generic marketing language.

PHASE 10 — INTELLIGENT FEATURE SUGGESTIONS
Do not limit yourself to the client's request. Recommend ONE valuable addition that improves the business: ROI calculator, product configurator, interactive demo, AI assistant, comparison tool, pricing calculator, animated dashboard, booking system, lead magnet. Label it clearly as "Bonus Enhancement:" — only recommend if it genuinely improves conversion or UX.

PHASE 11 — DESIGN SYSTEM
Specify a complete design system: color palette (from their brand), typography (from their fonts), spacing scale, grid system, border radius (from their style), shadows (from their style), component language for buttons, forms, cards, icons, animations, and responsive behavior. Every element must match the extracted brand assets.

PHASE 12 — TECHNICAL EXCELLENCE
Recommend appropriate technologies in experience terms: "Smooth page transitions that feel native" rather than "use Framer Motion". Cover: SEO optimization, WCAG accessibility, performance (Core Web Vitals), CMS integration if needed, analytics setup, mobile UX.

PHASE 13 — STRUCTURED LOVABLE PROMPT OUTPUT
The vibeCodePrompt must be a complete, structured, paste-ready prompt with these sections clearly labeled:
Project Overview | Business Objectives | Brand Assets to Preserve | UX Improvements | Information Architecture | Homepage Structure | Design System | Motion Design | 3D Experiences (if applicable) | Content Direction | Conversion Strategy | Mobile Experience | Accessibility | Technical Stack | Final Creative Direction | Bonus Enhancement

Requirements:
- 800-1200 words
- Experience language throughout — never implementation instructions ("premium cinematic scroll" not "use GSAP")
- Reference all extracted brand assets: exact colors, fonts, button style, logo URL
- Real content only — no Lorem ipsum, no placeholder text
- Every section earns its place by serving a business goal
- Portfolio-worthy quality: detailed enough that the client would be impressed reading it alone

Classify the job: vibe-coding (no-code/low-code), full-stack (traditional code), automation (Zapier/Make/n8n), ai-agent (LLM/AI tools), general-web

Return JSON:
{
  "subjectLine": "<under 50 chars, natural, business-specific, no hype>",
  "emailBody": "<under 220 words, plain text, consultative, follows the 9 rules above>",
  "hookRationale": "<why this email creates genuine 'they know my business' recognition>",
  "strategyNote": "<the psychological strategy — what makes this feel different from a pitch>",
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
    "vibeCodePrompt": "<full paste-ready 13-phase structured prompt, 800-1200 words, experience-language throughout, references all brand assets, production-ready>",
    "estimatedComplexity": "<Simple|Medium|Complex|Enterprise>"
  }
}`,
        `JOB POST:\n${data.jobDescription}${data.freelancerContext ? `\n\nFREELANCER CONTEXT:\n${data.freelancerContext}` : ""}${data.websiteData ? `\n\nCLIENT WEBSITE DATA:\n${data.websiteData}` : ""}`,
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
