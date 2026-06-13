import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
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

const MODEL = "google/gemini-3-flash-preview";

async function getModel() {
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key)(MODEL);
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
  const model = await getModel();

  const { text } = await generateText({
    model,
    system:
      system +
      "\n\nCRITICAL: Your entire response must be a single valid JSON object — no markdown, no code fences, no commentary before or after. Start with { and end with }.",
    prompt,
  });

  // Strategy 1: strip code fences then parse
  // Strategy 2: find the first { ... } block spanning the whole response
  // Strategy 3: find any valid JSON object substring
  function extractJson(src: string): unknown {
    const attempts: string[] = [
      // Strip markdown fences
      src.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim(),
      // Take from first { to last }
      src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1).trim(),
      // Take from first [ to last ] (array root)
      src.slice(src.indexOf("["), src.lastIndexOf("]") + 1).trim(),
    ];
    for (const candidate of attempts) {
      if (!candidate) continue;
      try { return JSON.parse(candidate); } catch { /* try next */ }
    }
    // Last resort: regex extract first JSON object
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
Choose the single best matching hook id and strategy id from these exact lists:
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
  "suggestedHookId": "<exact id from list>",
  "hookReason": "...",
  "suggestedStrategyId": "<exact id from list>",
  "strategyReason": "...",
  "detectedLanguage": "<full English name of the language this job post is written in, e.g. English, French, Spanish, German, Portuguese, Arabic, etc.>",
  "suggestedLength": "<brief|robust|explanatory — brief for simple/quick tasks under $500 or short gigs, robust for most jobs, explanatory for complex technical or high-budget projects over $2000>",
  "detectedNiche": "<the primary freelance niche this job belongs to — e.g. Full-Stack Development, UI/UX Design, Email Marketing, Content Writing, Video Editing, Virtual Assistant, Social Media Management, Automation & Workflows, Data Analysis, Mobile Development, etc.>"
}${redFlagPromptBlock()}`,
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
        ? `Portfolio to weave in:\n${data.portfolioItems.map((p) => `- ${p.title} (${p.url}): ${p.description}`).join("\n")}`
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
  * robust: 2000–3000 characters. Hook → portfolio (2-3 links) → deliverables → one advice sentence → ${data.includePlan ? "execution plan → " : ""}question → CTA.
  * explanatory: 3000–5000 characters. All sections fully developed. Detailed execution plan. Full milestones if provided.
  You are writing a "${length.name}" proposal so the rules for "${length.id}" apply.
- Structure: Hook paragraph. ${data.portfolioItems.length > 0 && data.length !== "brief" ? "Portfolio paragraph with 2-3 links and one-line relevance for each. " : ""}Deliverables (2-4 sentences about outcomes, not steps). One non-obvious advice/warning sentence. ${data.includePlan ? "2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a simple list. " : ""}One open-ended question. Specific call to action.

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
      return { ...finalResult, content: scrubRedFlags(finalResult.content, customFlags) };
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

// ---------- Conversion Messages ----------
const ConversionSchema = z.object({ options: z.array(z.string()).min(1).max(3) });

export const generateConversionResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientMessage: string; replyLanguage?: string }) =>
    z.object({ clientMessage: z.string().min(5).max(5000), replyLanguage: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const customFlags = await loadCustomFlags(context);
      const languageInstruction = data.replyLanguage && data.replyLanguage.toLowerCase() !== "english"
        ? `\n\nWRITE ALL REPLIES IN ${data.replyLanguage}. Every word must be in ${data.replyLanguage}.`
        : "";
      const result = await structured(
        ConversionSchema,
        `You write professional, human follow-up replies for a freelancer to send to a client. Three distinct options, each 2-5 sentences, each addressing what the client said and moving toward a close. No "Hi". No "Let me know if you have questions". No fluff.${languageInstruction}

Return a JSON object with this exact shape:
{
  "options": ["reply 1 text", "reply 2 text", "reply 3 text"]
}${redFlagPromptBlock(customFlags)}`,
        `Client said:\n"${data.clientMessage}"\n\nGive me 3 reply options.`,
      );
      return result.options.map((o) => scrubRedFlags(o, customFlags));
    } catch (err) {
      handleAiError(err);
    }
  });
