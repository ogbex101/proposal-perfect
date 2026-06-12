// SERVER-ONLY. Generates the structured copy for an AI portfolio from a job
// description + the freelancer's profile, using the Lovable AI gateway (the
// same server-side provider the proposal features use).

import { generateText, Output } from "ai";
import { z } from "zod";

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
  niche: z.string().describe("The freelancer's positioning for THIS job, e.g. 'Conversion-focused Webflow Designer'. 2-5 words."),
  tagline: z.string().describe("One punchy sentence under the name. Specific, benefit-led, no buzzwords."),
  aboutClient: z.string().describe("2-3 sentences speaking directly to this client about their situation and what they need, inferred from the job post. Second person ('you')."),
  whatIDo: z.array(z.object({
    title: z.string().describe("A service/offering relevant to this job. 2-4 words."),
    description: z.string().describe("One concrete sentence about the outcome it delivers."),
  })).min(3).max(5),
  projects: z.array(z.object({
    title: z.string().describe("A realistic, specific project name relevant to this job."),
    description: z.string().describe("2 sentences: what the project was and the measurable result. Concrete and credible, not generic."),
    tags: z.array(z.string()).min(2).max(4).describe("Short tech/skill tags."),
    imageKeywords: z.string().describe("3-5 comma-free space-separated visual keywords describing a photo for this project, e.g. 'modern ecommerce website dashboard'."),
  })).min(3).max(4),
  testimonials: z.array(z.object({
    quote: z.string().describe("A realistic 1-2 sentence client testimonial relevant to this kind of work. Specific, not gushing."),
    author: z.string().describe("A plausible full name."),
    role: z.string().describe("Their role + company type, e.g. 'Founder, DTC skincare brand'."),
  })).min(2).max(3),
  faqs: z.array(z.object({
    question: z.string().describe("A real question THIS client would ask before hiring."),
    answer: z.string().describe("A confident, specific 1-3 sentence answer."),
  })).min(4).max(6),
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
${profileBlock}`;

    const { experimental_output } = await generateText({
      model,
      experimental_output: Output.object({ schema: CopySchema }),
      system,
      prompt: `Here is the job the client posted. Tailor the portfolio to win it:\n\n${jobDescription}`,
    });
    return experimental_output;
  } catch (err) {
    handleAiError(err);
  }
}
