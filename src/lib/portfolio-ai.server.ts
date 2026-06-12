// SERVER-ONLY. Generates the structured copy for an AI portfolio from a job
// description + the freelancer's profile, using the Lovable AI gateway (the
// same server-side provider the proposal features use).

import { generateText } from "ai";
import { z } from "zod";
import { redFlagPromptBlock, scrubRedFlags } from "./red-flags";

const MODEL = "google/gemini-3-flash-preview";

async function getModel() {
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY. Connect the Lovable AI connector in Lovable Cloud.");
  return createLovableAiGatewayProvider(key)(MODEL);
}

export type PortfolioProfileInput = {
  name: string;
  bio: string;
  myStory: string;
  skills: string[];
  credentials: { title: string; institution: string; year: string }[];
  brands: string[];
};

// AI-authored portions only. Everything factual (name, story, skills,
// credentials, brands, contact) comes straight from the profile.
const CopySchema = z.object({
  niche: z.string(),
  tagline: z.string(),
  aboutClient: z.string(),
  whatIDo: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).max(5),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).max(4),
    imageKeywords: z.string(),
  })).max(4),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string(),
  })).max(3),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).max(6),
});

export type PortfolioCopy = z.infer<typeof CopySchema>;

function handleAiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) throw new Error("Rate limit hit. Please wait a moment and try again.");
  if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in Lovable Cloud → Settings → Cloud & AI balance.");
  throw new Error(msg);
}

export async function generatePortfolioCopy(
  jobDescription: string,
  profile: PortfolioProfileInput,
): Promise<PortfolioCopy> {
  try {
    const model = await getModel();

    const profileBlock = [
      `Name: ${profile.name || "(not provided)"}`,
      `Bio: ${profile.bio || "(not provided)"}`,
      `My Story: ${profile.myStory || "(not provided)"}`,
      `Skills: ${profile.skills.length ? profile.skills.join(", ") : "(none listed)"}`,
      `Credentials: ${profile.credentials.length ? profile.credentials.map((c) => `${c.title} — ${c.institution} (${c.year})`).join("; ") : "(none listed)"}`,
      `Brands worked with: ${profile.brands.length ? profile.brands.join(", ") : "(none listed)"}`,
    ].join("\n");

    const system = `You write a freelancer's portfolio landing page tailored to ONE specific job.
Rules:
- Ground everything in the freelancer's real profile below. Do NOT invent credentials, brands, or skills that contradict it.
- The "projects" and "testimonials" are illustrative samples — make them realistic, specific, and clearly relevant to the job, never generic filler.
- Match the freelancer's actual skills to what the job needs in "whatIDo".
- Write like a confident professional, not a marketer. No clichés ("passionate", "go-getter", "results-driven"), no exclamation marks.
- "aboutClient" must reference specifics from the job post so it feels personal.

FREELANCER PROFILE:
${profileBlock}

CRITICAL: Your entire response must be a single valid JSON object — no markdown, no code fences, no commentary before or after. Start with { and end with }.

Return a JSON object with this exact shape:
{
  "niche": "...",
  "tagline": "...",
  "aboutClient": "...",
  "whatIDo": [{"title": "...", "description": "..."}, ...],
  "projects": [{"title": "...", "description": "...", "tags": ["...", "..."], "imageKeywords": "..."}, ...],
  "testimonials": [{"quote": "...", "author": "...", "role": "..."}, ...],
  "faqs": [{"question": "...", "answer": "..."}, ...]
}${redFlagPromptBlock()}`;

    const { text } = await generateText({
      model,
      system,
      prompt: `Here is the job the client posted. Tailor the portfolio to win it:\n\n${jobDescription}`,
    });

    const extractJson = (src: string): unknown => {
      const attempts = [
        src.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim(),
        src.slice(src.indexOf("{"), src.lastIndexOf("}") + 1).trim(),
      ];
      for (const c of attempts) {
        if (!c) continue;
        try { return JSON.parse(c); } catch { /* next */ }
      }
      const m = src.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
      throw new Error("AI returned malformed JSON. Please try again.");
    };
    const raw = extractJson(text);

    const parsed = CopySchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("AI response did not match the expected format. Please try again.");
    }
    // Scrub red-flag phrases from the human-readable copy fields.
    const d = parsed.data;
    return {
      ...d,
      tagline: scrubRedFlags(d.tagline),
      aboutClient: scrubRedFlags(d.aboutClient),
      whatIDo: d.whatIDo.map((w) => ({ ...w, description: scrubRedFlags(w.description) })),
      projects: d.projects.map((p) => ({ ...p, description: scrubRedFlags(p.description) })),
      faqs: d.faqs.map((f) => ({ ...f, answer: scrubRedFlags(f.answer) })),
    };
  } catch (err) {
    handleAiError(err);
  }
}
