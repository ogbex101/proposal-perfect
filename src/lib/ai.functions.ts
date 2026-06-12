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

  // Strip ```json ... ``` or ``` ... ``` wrappers the model sometimes adds anyway
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned malformed JSON. Please try again.");
  }

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
  "strategyReason": "..."
}`,
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
      portfolioItems: z.array(
        z.object({ title: z.string(), url: z.string(), description: z.string() }),
      ),
      milestones: z
        .array(z.object({ title: z.string(), description: z.string(), amount: z.string().optional() }))
        .optional(),
      budget: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
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

      return await structured(
        ProposalSchema,
        `You write human, high-converting freelance proposals. Hard rules:
- No greeting. No "Hi". Start directly with the hook.
- Forbidden phrases (NEVER use any of these or close variants):
${FORBIDDEN_PHRASES.map((p) => `  • "${p}"`).join("\n")}
- Use the assigned HOOK: "${hook.name}" — ${hook.description}
- Use the assigned STRATEGY: "${strategy.name}" — ${strategy.description}
- Target length: ~${length.target} characters (${length.name}).
- Structure: Hook paragraph. ${data.portfolioItems.length > 0 && data.length !== "brief" ? "Portfolio paragraph with 2-3 links and one-line relevance for each. " : ""}Deliverables (2-4 sentences about outcomes, not steps). One non-obvious advice/warning sentence. ${data.includePlan ? "2-3 sentence execution plan. " : ""}${data.milestones && data.milestones.length > 0 ? "Milestones as a simple list. " : ""}One open-ended question. Specific call to action.

Return a JSON object with this exact shape:
{
  "content": "<the full proposal text, ready to paste>",
  "explanation": {
    "hook": "<why this hook works for this job>",
    "strategy": "<why this strategy works for this job>",
    "question": "<why this closing question works>"
  }
}`,
        `Job post:\n${data.jobDescription}\n\n${analysisBlock}\n\n${portfolioBlock}\n\n${milestoneBlock}\n\nBudget: ${data.budget || "not specified"}`,
      );
    } catch (err) {
      handleAiError(err);
    }
  });

// ---------- Conversion Messages ----------
const ConversionSchema = z.object({ options: z.array(z.string()).min(1).max(3) });

export const generateConversionResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientMessage: string }) =>
    z.object({ clientMessage: z.string().min(5).max(5000) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const result = await structured(
        ConversionSchema,
        `You write professional, human follow-up replies for a freelancer to send to a client. Three distinct options, each 2-5 sentences, each addressing what the client said and moving toward a close. No "Hi". No "Let me know if you have questions". No fluff.

Return a JSON object with this exact shape:
{
  "options": ["reply 1 text", "reply 2 text", "reply 3 text"]
}`,
        `Client said:\n"${data.clientMessage}"\n\nGive me 3 reply options.`,
      );
      return result.options;
    } catch (err) {
      handleAiError(err);
    }
  });
