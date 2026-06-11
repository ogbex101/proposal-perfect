import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { FORBIDDEN_PHRASES, HOOKS, LENGTHS, STRATEGIES } from "./proposal-constants";

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
 * Pull a JSON value out of a model response that may be wrapped in markdown
 * code fences or surrounded by stray prose. Returns the raw JSON string.
 */
function extractJson(text: string): string {
  let t = (text ?? "").trim();

  // Strip a ```json ... ``` or ``` ... ``` fence if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  // If there's leading/trailing prose, slice from the first opening bracket
  // to the last closing bracket of the same outermost value.
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start > 0) {
    const lastObj = t.lastIndexOf("}");
    const lastArr = t.lastIndexOf("]");
    const end = Math.max(lastObj, lastArr);
    if (end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/**
 * Provider-agnostic structured generation: instruct the model to emit JSON,
 * then extract + validate it ourselves with Zod. Avoids the strict
 * response_format / json_schema path, which the Lovable AI gateway does not
 * reliably honor for Gemini (causing "response did not match schema").
 */
async function generateJson<S extends z.ZodTypeAny>(opts: {
  schema: S;
  system: string;
  prompt: string;
  shapeHint: string;
  maxOutputTokens?: number;
}): Promise<z.infer<S>> {
  const model = await getModel();
  const { text } = await generateText({
    model,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
    system:
      `${opts.system}\n\n` +
      `Respond with ONLY a single valid JSON value and nothing else. ` +
      `No markdown, no code fences, no commentary before or after. ` +
      `It must match this exact shape:\n${opts.shapeHint}`,
    prompt: opts.prompt,
  });

  const raw = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The AI returned a malformed response. Please try again.");
  }

  const result = opts.schema.safeParse(parsed);
  if (!result.success) {
    throw new Error("The AI response was incomplete. Please try again.");
  }
  return result.data;
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
});
export type JobAnalysis = z.infer<typeof AnalysisSchema>;

const ANALYSIS_SHAPE = `{
  "summary": "2-3 sentence interpretation of what the client really wants",
  "painPoint": "what is frustrating the client right now",
  "hiddenNeeds": "what they need but did not say",
  "technicalDifficulties": [{ "title": "short label", "explanation": "one sentence" }],
  "recommendedApproach": "how a skilled freelancer would tackle it",
  "suggestedHookId": "exact id from the HOOKS list",
  "hookReason": "why this hook fits this client",
  "suggestedStrategyId": "exact id from the STRATEGIES list",
  "strategyReason": "why this strategy fits this client"
}`;

export const analyzeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string }) => z.object({ jobDescription: z.string().min(20).max(15000) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const hookList = HOOKS.map((h) => `- ${h.id}: ${h.name} — ${h.description}`).join("\n");
      const strategyList = STRATEGIES.map((s) => `- ${s.id}: ${s.name} — ${s.description}`).join("\n");
      return await generateJson({
        schema: AnalysisSchema,
        shapeHint: ANALYSIS_SHAPE,
        system: `You analyze freelance job posts. Be specific, never generic. Interpret, don't repeat. Choose the single best matching hook id and strategy id from these exact lists:\nHOOKS:\n${hookList}\nSTRATEGIES:\n${strategyList}`,
        prompt: `Analyze this job post:\n\n${data.jobDescription}`,
      });
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Generate Milestones ----------
const MilestonesSchema = z.object({
  milestones: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      amount: z
        .union([z.string(), z.number()])
        .nullish()
        .transform((v) => (v === null || v === undefined ? undefined : String(v))),
    }),
  ),
});

const MILESTONES_SHAPE = `{
  "milestones": [
    { "title": "short title", "description": "one-sentence deliverable", "amount": "e.g. $300 — omit this field entirely if no budget" }
  ]
}`;

export const generateMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; budget?: string }) =>
    z.object({ jobDescription: z.string().min(10), budget: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const out = await generateJson({
        schema: MilestonesSchema,
        shapeHint: MILESTONES_SHAPE,
        system: `Create 2-4 sensible project milestones. Each has a short title and a one-sentence deliverable description. If a budget is given, distribute amounts realistically; otherwise omit the amount field.`,
        prompt: `Job:\n${data.jobDescription}\n\nBudget: ${data.budget || "not provided"}`,
      });
      return out.milestones;
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

const PROPOSAL_SHAPE = `{
  "content": "the finished proposal text, ready to paste",
  "explanation": {
    "hook": "why this hook works for this job",
    "strategy": "why this strategy fits this client",
    "question": "why the closing question will get a reply"
  }
}`;

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    jobDescription: string;
    analysis?: JobAnalysis | null;
    hookId: string;
    strategyId: string;
    length: "brief" | "robust" | "explanatory";
    includePlan: boolean;
    portfolioItems: Array<{ title: string; url: string; description: string }>;
    milestones?: Array<{ title: string; description: string; amount?: string }>;
    budget?: string;
  }) =>
    z.object({
      jobDescription: z.string().min(10),
      analysis: z.any().optional().nullable(),
      hookId: z.string(),
      strategyId: z.string(),
      length: z.enum(["brief", "robust", "explanatory"]),
      includePlan: z.boolean(),
      portfolioItems: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })),
      milestones: z.array(z.object({ title: z.string(), description: z.string(), amount: z.string().optional() })).optional(),
      budget: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const hook = HOOKS.find((h) => h.id === data.hookId) ?? HOOKS[0];
      const strategy = STRATEGIES.find((s) => s.id === data.strategyId) ?? STRATEGIES[0];
      const length = LENGTHS.find((l) => l.id === data.length) ?? LENGTHS[1];

      const system = `You write human, high-converting freelance proposals. Hard rules:
- No greeting. No "Hi". Start directly with the hook.
- Forbidden phrases (NEVER use any of these or close variants):
${FORBIDDEN_PHRASES.map((p) => `  • "${p}"`).join("\n")}
- Use the assigned HOOK: "${hook.name}" — ${hook.description}
- Use the assigned STRATEGY: "${strategy.name}" — ${strategy.description}
- Target length: ~${length.target} characters (${length.name}).
- Structure: Hook paragraph. ${data.portfolioItems.length > 0 && data.length !== "brief" ? "Portfolio paragraph with 2-3 links and one-line relevance for each. " : ""}Deliverables (2-4 sentences about outcomes, not steps). One non-obvious advice/warning sentence. ${data.includePlan ? "2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a simple list. " : ""}One open-ended question. Specific call to action.
- Put the entire finished proposal in the "content" field, with real newlines. The "explanation" field is for the freelancer (why this hook, why this strategy, why this question worked).`;

      const portfolioBlock = data.portfolioItems.length
        ? `Portfolio to weave in:\n${data.portfolioItems.map((p) => `- ${p.title} (${p.url}): ${p.description}`).join("\n")}`
        : "No portfolio items provided.";
      const milestoneBlock = data.milestones?.length
        ? `Milestones:\n${data.milestones.map((m) => `- ${m.title}${m.amount ? ` (${m.amount})` : ""}: ${m.description}`).join("\n")}`
        : "";
      const analysisBlock = data.analysis ? `Job analysis:\n${JSON.stringify(data.analysis, null, 2)}` : "";

      return await generateJson({
        schema: ProposalSchema,
        shapeHint: PROPOSAL_SHAPE,
        maxOutputTokens: 4096,
        system,
        prompt: `Job post:\n${data.jobDescription}\n\n${analysisBlock}\n\n${portfolioBlock}\n\n${milestoneBlock}\n\nBudget: ${data.budget || "not specified"}`,
      });
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Conversion Messages ----------
const ConversionSchema = z.object({ options: z.array(z.string()).min(1).max(3) });

const CONVERSION_SHAPE = `{ "options": ["reply option 1", "reply option 2", "reply option 3"] }`;

export const generateConversionResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientMessage: string }) =>
    z.object({ clientMessage: z.string().min(5).max(5000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const out = await generateJson({
        schema: ConversionSchema,
        shapeHint: CONVERSION_SHAPE,
        system: `You write professional, human follow-up replies for a freelancer to send to a client. Three distinct options, each 2-5 sentences, each addressing what the client said and moving toward a close. No "Hi". No "Let me know if you have questions". No fluff.`,
        prompt: `Client said:\n"${data.clientMessage}"\n\nGive me 3 reply options.`,
      });
      return out.options;
    } catch (err) {
      handleAiError(err);
    }
  });
