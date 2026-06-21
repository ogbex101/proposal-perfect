import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Digital skills categories we auto-detect and generate samples for
export const DIGITAL_SKILLS_CATEGORIES = [
  "SEO",
  "Content Writing",
  "Copywriting",
  "Digital Marketing",
  "Social Media Management",
  "Email Marketing",
  "Blog Writing",
  "Article Writing",
  "Technical Writing",
] as const;
export type DigitalSkillsCategory = typeof DIGITAL_SKILLS_CATEGORIES[number];

// Client-side detection — call this before deciding to generate
export function detectDigitalSkillsCategory(jobDescription: string): DigitalSkillsCategory | null {
  const jd = jobDescription.toLowerCase();
  if (/\bseo\b|search engine optim/.test(jd)) return "SEO";
  if (/email marketing|email campaign|email sequence|newsletter/.test(jd)) return "Email Marketing";
  if (/social media|instagram post|twitter|linkedin post|content calendar|caption/.test(jd)) return "Social Media Management";
  if (/\bcopywriting\b|copy writer|sales copy|landing page copy|ad copy/.test(jd)) return "Copywriting";
  if (/blog post|blog writing/.test(jd)) return "Blog Writing";
  if (/article writing|article creation/.test(jd)) return "Article Writing";
  if (/technical writ|documentation|user manual|api doc/.test(jd)) return "Technical Writing";
  if (/content writ|content creat|content strateg|content market/.test(jd)) return "Content Writing";
  if (/digital marketing|online marketing|ppc|google ads|facebook ads/.test(jd)) return "Digital Marketing";
  return null;
}

function shortSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type SampleItem = {
  title: string;
  subtitle: string;
  format: string;
  content: string;
  brandRef?: string;
};

export type PortfolioSamplesDoc = {
  category: string;
  freelancerName: string;
  jobExcerpt: string;
  generatedAt: string;
  samples: SampleItem[];
};

export const generateAndSavePortfolioSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      jobDescription: z.string().min(20).max(5000),
      category: z.string().min(1).max(60),
      subProfileId: z.string().uuid().optional(),
      profileImageUrl: z.string().url().optional(),
      brandName: z.string().max(100).optional(),
      brandDescription: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateWithFallback } = await import("./ai-gateway.server");

    // Load profile for personalisation
    const { data: profile } = await (context.supabase as any).from("profiles").select("*").eq("user_id", context.userId).maybeSingle();
    let subProfile: Record<string, unknown> | null = null;
    if (data.subProfileId) {
      const { data: sp } = await context.supabase.from("sub_profiles").select("*").eq("id", data.subProfileId).maybeSingle();
      subProfile = sp;
    }

    const active = (subProfile ?? profile) as Record<string, unknown> | null;
    const freelancerName = (active?.name as string | null) ?? "The Freelancer";
    const profileImage = data.profileImageUrl ?? (active?.avatar_url as string | null) ?? null;
    const skills = ((active?.skills ?? []) as string[]).slice(0, 10).join(", ");
    const brands = ((active?.brands_worked ?? []) as string[]).slice(0, 6);
    const brandsText = brands.length
      ? `Past clients / brands: ${brands.join(", ")}`
      : "Past clients include: JobCondi, Bloom Trader Pro, Xpers Stream Arena, Dexta, Xperience Props";
    const bio = (active?.bio as string | null) ?? "";
    const jobExcerpt = data.jobDescription.slice(0, 300);
    const brandBlock = data.brandName
      ? `\nBRAND INFO:\nBrand: ${data.brandName}\n${data.brandDescription ? `Description: ${data.brandDescription}` : ""}\nUse this brand in the samples where natural.`
      : "";
    const imageBlock = profileImage
      ? `\nFREELANCER PROFILE IMAGE URL: ${profileImage}\nMANDATORY: In the "content" field of the first sample, include a realistic portfolio page description that prominently features this exact image URL as the freelancer's profile photo. Write it as: "Profile photo: ${profileImage}" on its own line within the content. The portfolio page should feel like a real personal brand page with this photo as the hero.`
      : "";

    // Pick the right sample formats per category
    const sampleFormats = getSampleFormats(data.category as DigitalSkillsCategory);

    // Build AI prompt
    const prompt = `You are a portfolio sample generator for a professional freelancer. Generate ${sampleFormats.length} portfolio samples as a JSON array.

FREELANCER CONTEXT:
Name: ${freelancerName}
Skills: ${skills || data.category}
${brandsText}
${bio ? `Bio: ${bio}` : ""}${brandBlock}${imageBlock}

JOB DESCRIPTION (excerpt):
${jobExcerpt}

CATEGORY: ${data.category}

Generate EXACTLY ${sampleFormats.length} samples, one for each format below:
${sampleFormats.map((f, i) => `${i + 1}. ${f.format}: ${f.instruction}`).join("\n")}

RULES:
- Each sample must look 100% REAL and professional — like actual client work, not a template
- Reference specific industry details from the job description
- Include specific numbers, metrics, and details (not placeholders like [INSERT X])
- ${brands.length ? `Reference these real brands where natural: ${brands.join(", ")}` : "Create believable brand names that feel real"}
- Match the exact tone and format of real professional deliverables
- Each sample should be detailed enough to impress a client (150-400 words of content)

Respond ONLY with a JSON array, no other text. Each element must have:
{
  "title": "Clear title of the sample piece",
  "subtitle": "Brief description of what this demonstrates",
  "format": "The format type (e.g. SEO Audit, Blog Post)",
  "content": "The full sample content — make it look COMPLETELY REAL",
  "brandRef": "Brand name referenced in this sample (optional)"
}`;

    let samplesJson: SampleItem[] = [];
    try {
      const raw = await generateWithFallback({ system: "You are a professional portfolio content generator. Respond only with valid JSON.", prompt });
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      samplesJson = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Fallback: generate a single sample
      samplesJson = [createFallbackSample(data.category, freelancerName, brands, jobExcerpt)];
    }

    const doc: PortfolioSamplesDoc = {
      category: data.category,
      freelancerName,
      jobExcerpt: data.jobDescription.slice(0, 200),
      generatedAt: new Date().toISOString(),
      samples: samplesJson,
    };

    // Save to Supabase
    let slug = shortSlug();
    for (let i = 0; i < 3; i++) {
      const { data: row, error } = await (context.supabase as any)
        .from("portfolio_samples")
        .insert({
          user_id: context.userId,
          slug,
          category: data.category,
          job_excerpt: data.jobDescription.slice(0, 300),
          samples: doc,
        })
        .select("slug")
        .single();
      if (!error && row) return { slug: (row as { slug: string }).slug };
      slug = shortSlug();
    }
    throw new Error("Could not save portfolio samples — please try again.");
  });

export const getPublicPortfolioSamples = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured.");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: row, error } = await (supabase as any)
      .from("portfolio_samples")
      .select("samples")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ? (row as any).samples : null) as PortfolioSamplesDoc | null;
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SampleFormat = { format: string; instruction: string };

function getSampleFormats(category: DigitalSkillsCategory): SampleFormat[] {
  const map: Record<DigitalSkillsCategory, SampleFormat[]> = {
    "SEO": [
      { format: "SEO Audit Report", instruction: "A mini SEO audit for a website in the same industry as the job. Include current issues, keyword gaps, and 3 quick wins. Use specific URLs and metrics." },
      { format: "Keyword Research Summary", instruction: "A keyword research summary with 8-10 target keywords, search volumes (realistic numbers), difficulty scores, and content recommendations." },
    ],
    "Content Writing": [
      { format: "Blog Article", instruction: "A complete, publish-ready 400-word blog post article relevant to the job's industry. Professional headline, subheadings, strong CTA." },
      { format: "Content Brief", instruction: "A detailed content brief for a content piece in the job's industry — target audience, angle, outline, keywords, and tone guide." },
    ],
    "Copywriting": [
      { format: "Landing Page Copy", instruction: "Full landing page copy for a product/service in the same industry as the job. Headline, subheadline, benefits, social proof, and CTA. Persuasive and conversion-focused." },
      { format: "Ad Copy Variants", instruction: "3 Facebook/Google ad copy variants for a product/service in the job's industry. Each with headline, body, and CTA. Show A/B testing mindset." },
    ],
    "Digital Marketing": [
      { format: "Campaign Strategy", instruction: "A mini digital marketing campaign strategy for a brand in the same industry. Include objectives, target audience, channels, messaging, and KPIs." },
      { format: "Performance Report", instruction: "A sample marketing performance report showing campaign results with realistic metrics — CTR, ROAS, conversions, CPL, recommendations." },
    ],
    "Social Media Management": [
      { format: "Content Calendar", instruction: "A 7-day social media content calendar for a brand in the job's industry. Include day, platform, post type, caption (written out fully), and hashtags." },
      { format: "Sample Posts", instruction: "5 ready-to-publish social media posts (Instagram/LinkedIn) for a brand in the job's industry. Each fully written with captions and hashtag suggestions." },
    ],
    "Email Marketing": [
      { format: "Email Sequence", instruction: "A 3-email welcome/nurture sequence for a business in the job's industry. Each email fully written: subject line, preview text, body, and CTA." },
      { format: "Campaign Report", instruction: "A sample email campaign performance report showing open rates, CTR, conversions, revenue, and actionable next steps." },
    ],
    "Blog Writing": [
      { format: "Blog Post", instruction: "A complete, engaging 400-word blog post tailored to the job's industry/topic. Professional SEO-optimised format with H2s, strong intro, and clear CTA." },
      { format: "Blog Strategy", instruction: "A blog content strategy document with content pillars, topic clusters, posting frequency, and 10 specific post ideas for the industry." },
    ],
    "Article Writing": [
      { format: "Feature Article", instruction: "A 350-word feature article on a topic relevant to the job's industry. Journalistic tone, well-researched feel, quotes, and clear structure." },
      { format: "Listicle Article", instruction: "A '7 Ways to...' or 'Top 5...' article fully written for the job's industry. Engaging, scannable, practical." },
    ],
    "Technical Writing": [
      { format: "How-To Guide", instruction: "A step-by-step technical how-to guide for a process relevant to the job. Clear numbered steps, notes, warnings, and expected outcomes. Professional documentation style." },
      { format: "API Documentation Sample", instruction: "A sample API endpoint documentation page with description, parameters, request/response examples, and error codes. Developer-ready format." },
    ],
  };
  return map[category] ?? [
    { format: "Work Sample", instruction: "A professional work sample demonstrating expertise relevant to the job description." },
  ];
}

function createFallbackSample(category: string, name: string, brands: string[], jobExcerpt: string): SampleItem {
  const brand = brands[0] ?? "a leading brand";
  return {
    title: `${category} Sample — ${brand}`,
    subtitle: `Demonstrating ${category} expertise`,
    format: category,
    content: `This is a portfolio sample showcasing ${category} work for ${brand}. The project involved developing a comprehensive ${category.toLowerCase()} strategy tailored to their target audience and business objectives.\n\nKey deliverables included in-depth analysis, strategic recommendations, and measurable outcomes that aligned with the client's goals.\n\nThis work demonstrates the ability to deliver professional, results-driven ${category.toLowerCase()} solutions — the same approach I would bring to ${jobExcerpt.slice(0, 80)}...`,
    brandRef: brand,
  };
}
