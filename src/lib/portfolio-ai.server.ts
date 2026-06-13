// SERVER-ONLY. Generates the structured copy for an AI portfolio from a job
// description + the freelancer's profile, using the multi-provider AI fallback
// system.

import { generateWithFallback } from "./ai-gateway.server";
import { z } from "zod";
import { redFlagPromptBlock, scrubRedFlags } from "./red-flags";
import type { PortfolioReferenceTemplate } from "./portfolio-reference-templates";

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
  })),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    imageKeywords: z.string(),
  })),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string(),
    role: z.string(),
  })),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
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
  reference: PortfolioReferenceTemplate,
): Promise<PortfolioCopy> {
  try {
    const profileBlock = [
      `Name: ${profile.name || "(not provided)"}`,
      `Bio: ${profile.bio || "(not provided)"}`,
      `My Story: ${profile.myStory || "(not provided)"}`,
      `Skills: ${profile.skills.length ? profile.skills.join(", ") : "(none listed)"}`,
      `Credentials: ${profile.credentials.length ? profile.credentials.map((c) => `${c.title} — ${c.institution} (${c.year})`).join("; ") : "(none listed)"}`,
      `Brands worked with: ${profile.brands.length ? profile.brands.join(", ") : "(none listed)"}`,
    ].join("\n");

    const referenceBlock = [
      `Template family: ${reference.label}`,
      `Visual direction: ${reference.visualDirection}`,
      `Fixed services: ${reference.services.map((service) => `${service.title}: ${service.description}`).join(" | ")}`,
      `Fixed project samples: ${reference.projects.map((project) => `${project.title}: ${project.description} [${project.tags.join(", ")}]`).join(" | ")}`,
    ].join("\n");

    const system = `You tailor a reference-backed freelancer portfolio to ONE specific job. The supplied template and samples are 70% of the result; your writing is the remaining 30%.
Rules:
- Ground everything in the freelancer's real profile below. Do NOT invent credentials, brands, or skills that contradict it.
- Keep the fixed service titles and project titles from the reference template. You may tailor descriptions to the job, but do not replace the project concepts with generic inventions.
- Return exactly ${reference.services.length} whatIDo entries and ${reference.projects.length} projects in the same order as the reference.
- Match the freelancer's actual skills to what the job needs in service descriptions.
- Write like a confident professional, not a marketer. No clichés ("passionate", "go-getter", "results-driven"), no exclamation marks.
- "aboutClient" must reference specifics from the job post so it feels personal.
- Testimonials must never reuse names, identities, or personal claims from any reference website. Keep them clearly illustrative and role-based.

FREELANCER PROFILE:
${profileBlock}

REFERENCE TEMPLATE (preserve approximately 70%):
${referenceBlock}

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

    const text = await generateWithFallback({
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
