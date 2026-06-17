import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback, generateObjectWithFallback } from "./ai-gateway.server";
import { z } from "zod";
import { FORBIDDEN_PHRASES, HOOKS, LENGTHS, STRATEGIES } from "./proposal-constants";
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
  detectedLanguage: z.string().default("English"),
  suggestedLength: z.enum(["brief", "robust", "explanatory"]).default("robust"),
  detectedNiche: z.string().default(""),
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
      return await structured(
        AnalysisSchema,
        `You analyze freelance job posts. Be specific, never generic. Interpret, don't repeat.
Choose the best matching hook id and strategy id from these exact lists:
HOOKS:
${hookList}
STRATEGIES:
${strategyList}

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
      "score": <integer 1-100 — how well this hook fits this specific job>,
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
  "detectedLanguage": "<full English name of the language this job post is written in, e.g. English, French, Spanish, German, Portuguese, Arabic, etc.>",
  "suggestedLength": "<brief|robust|explanatory — brief for simple/quick tasks under $500 or short gigs, robust for most jobs, explanatory for complex technical or high-budget projects over $2000>",
  "detectedNiche": "<the primary freelance niche this job belongs to — e.g. Full-Stack Development, UI/UX Design, Email Marketing, Content Writing, Video Editing, Virtual Assistant, Social Media Management, Automation & Workflows, Data Analysis, Mobile Development, etc.>"
}

IMPORTANT for hookSuggestions: The openingLine must be a specific, concrete sentence written for THIS job — not a template or description. It should be ready to paste as the first line of the proposal. Score 85-100 = excellent fit, 70-84 = good fit, 50-69 = workable.${redFlagPromptBlock()}`,
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
      const result = await structured(
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
      return await structured(
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
      return await structured(
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
  }) =>
    z.object({
      jobDescription: z.string().min(10),
      analysis: z.any().optional().nullable(),
      hookId: z.string(),
      strategyId: z.string(),
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
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      // Use AI-generated custom text if provided, otherwise fall back to preset lists
      const hookLabel = data.customHookText
        ? `AI-Generated Custom Hook — ${data.customHookText}`
        : (() => { const h = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0]; return `${h.name} — ${h.description}`; })();
      const strategyLabel = data.customStrategyText
        ? `AI-Generated Custom Strategy — ${data.customStrategyText}`
        : (() => { const s = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0]; return `${s.name} — ${s.description}`; })();
      // Keep legacy hook/strategy for non-AI paths
      const hook = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0];
      const strategy = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0];
      const length = LENGTHS.find((l) => l.id === data.length) ?? LENGTHS[1];

      const portfolioBlock = data.portfolioItems.length
        ? `PORTFOLIO ITEMS (MANDATORY — you MUST include ALL of these links in the proposal body, mentioning each by name with a one-line reason why it's relevant to this job):\n${data.portfolioItems.map((p) => `- ${p.title}: ${p.url} — ${p.description}`).join("\n")}`
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

      const result = await structured(
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
- LENGTH ENFORCEMENT (this is a hard rule):
  * brief: MAXIMUM 1500 characters total. This is for Freelancer.com where character limits are strict. Structure (in this order): Hook paragraph (3-4 sentences, each a distinct insight about THEIR specific problem — no filler, no transitions), one razor-sharp question that pivots from problem to solution, one confident CTA that gives a specific next step (e.g. timeline, a quick call, a scope doc — never "let me know"). Zero portfolio links. Zero milestones. Zero execution plan. These 1500 characters must hit harder than a 4000-character generic proposal.
  * robust: 2000–3000 characters. Hook paragraph → portfolio paragraph (PARAGRAPH 2 — immediately after hook) → deliverables → one advice sentence → ${data.includePlan ? "execution plan → " : ""}question → CTA.
  * explanatory: 3000–5000 characters. All sections fully developed. Detailed execution plan. Full milestones if provided.
  You are writing a "${length.name}" proposal so the rules for "${length.id}" apply.
- PARAGRAPH ORDER (mandatory): 1) Hook paragraph — your most compelling opening insight. ${data.portfolioItems.length > 0 ? "2) Portfolio paragraph — IMMEDIATELY after the hook, before anything else. Include EVERY portfolio link from the PORTFOLIO ITEMS section above, each with a one-line sentence explaining how it's relevant to THIS specific job. Do not bury portfolio links later in the proposal. 3) " : "2) "}Deliverables paragraph (2-4 sentences about outcomes, not steps). ${data.portfolioItems.length > 0 ? "4" : "3"}) One non-obvious advice/warning sentence. ${data.includePlan ? (data.portfolioItems.length > 0 ? "5" : "4") + ") 2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a natural paragraph. " : ""}Final paragraph: One open-ended question followed by a specific call to action.
- FORMATTING RULES: Write in clean flowing prose. Separate paragraphs with ONE blank line. No dashes, asterisks, or any markdown. No horizontal rules. No numbered lists. No bullet symbols of any kind.

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
      // Hard-enforce brief limit
      let finalResult = result;
      if (data.length === "brief") {
        const MAX = 1500;
        let text = result.content;
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
          finalResult = { ...result, content: text };
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
      const result = await structured(
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
      return await structured(
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
      const text = await generateWithFallback({
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

      const result = await structured(
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
      const result = await structured(
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
      const result = await structured(
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

      return await structured(
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
  .inputValidator((d: { jobDescription: string; freelancerContext?: string }) =>
    z.object({
      jobDescription: z.string().min(20).max(15000),
      freelancerContext: z.string().max(3000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      return await structured(
        ScoutOutreachSchema,
        `You are an elite cold-email strategist and senior software architect working for a freelance developer who scouts jobs from Upwork, Freelancer, and similar platforms and reaches out directly via email.

Your job has two parts:

PART 1 — COLD EMAIL (must not land in spam)
Write an email that will get opened, read, and replied to. The client is busy and gets hundreds of emails. You have 3 seconds to stop them from deleting it.

SUBJECT LINE RULES (most critical):
- Under 50 characters
- Specific to their project — reference something unique in the job post
- No ALL CAPS, no excessive punctuation, no emoji, no spam words (free, guaranteed, urgent, limited offer, click here, act now)
- Curiosity or specificity over hype: "Your checkout redesign idea" beats "Amazing web developer available!"
- Should feel like it came from a colleague or someone they know, not a salesperson

EMAIL BODY RULES:
- Plain conversational text — no HTML, no bullet lists, no headers, no bold
- First 2 sentences ARE the hook — must reference something specific from their job post that proves you actually read it (not a template)
- Hook should create instant recognition: "that is exactly what I need" feeling
- No "I saw your job post on..." openers — too generic
- No desperate language, no groveling, no "I'd love the opportunity to..."
- Write like a peer reaching out, not a vendor pitching
- No portfolio links — instead, offer a specific, concrete piece of value in the email (a quick insight about their problem, a specific approach you'd take)
- End with ONE simple, low-friction CTA: a specific question or "Worth a quick call?" — never "Let me know if interested"
- 150-250 words maximum for the body

PART 2 — DEVELOPMENT PROMPT
Generate a comprehensive, production-quality development prompt the freelancer can paste directly into Cursor, Lovable, Bolt, v0, or any AI coding tool. This prompt becomes their "sample work" — it must be so detailed and thoughtful that the client would be impressed by it alone.

Classify the job as one of: vibe-coding (no-code/low-code tools), full-stack (traditional code), automation (Zapier/Make/n8n type), ai-agent (LLM-based agents/tools), general-web

The vibeCodePrompt field must be a single, long, paste-ready prompt (400-800 words) written AS IF you are speaking to an AI coding assistant. It should:
- Start with "Build me a [description]..."
- Describe EVERY screen, page, and feature
- Include specific UI/UX details (colors, layout, components)
- Mention integrations (auth, payments, databases, APIs)
- Include error states, loading states, empty states
- List every enhancement and edge case
- Specify the tech stack to use
- Sound like it came from a product manager who knows exactly what they want

Return JSON:
{
  "subjectLine": "<under 50 chars, specific, not spammy>",
  "emailBody": "<full email text, 150-250 words, plain text, no formatting>",
  "hookRationale": "<why the opening lines work>",
  "strategyNote": "<the core persuasion strategy behind this email>",
  "spamAvoidanceTips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "devPrompt": {
    "projectTitle": "<short project name>",
    "jobType": "<vibe-coding|full-stack|automation|ai-agent|general-web>",
    "jobTypeName": "<human readable: Vibe Coding / No-Code, Full-Stack Development, etc.>",
    "overview": "<2-3 sentence project overview>",
    "techStack": ["<tech 1>", "<tech 2>"],
    "coreFeatures": [
      { "feature": "<name>", "description": "<what it does>", "priority": "Must Have" }
    ],
    "enhancements": [
      { "title": "<enhancement name>", "description": "<what to build>", "impact": "<why it matters>" }
    ],
    "architecture": "<paragraph on system architecture, data flow, component structure>",
    "integrations": ["<integration 1>", "<integration 2>"],
    "scalabilityNotes": "<how to build this to scale from day 1>",
    "vibeCodePrompt": "<the full paste-ready AI coding prompt, 400-800 words>",
    "estimatedComplexity": "<Simple|Medium|Complex|Enterprise>"
  }
}`,
        `JOB POST:\n${data.jobDescription}${data.freelancerContext ? `\n\nFREELANCER CONTEXT:\n${data.freelancerContext}` : ""}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });
