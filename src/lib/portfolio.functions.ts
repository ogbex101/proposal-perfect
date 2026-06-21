import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("portfolio_items")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; title: string; url: string; description: string; is_primary?: boolean; is_favorite?: boolean; niche?: string; niche_tags?: string[] }) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(120),
      url: z.string().url().max(500),
      description: z.string().max(2000).default(""),
      is_primary: z.boolean().optional(),
      is_favorite: z.boolean().optional(),
      niche: z.string().max(60).default(""),
      niche_tags: z.array(z.string()).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId } as any;
    const { data: row, error } = await (context.supabase as any)
      .from("portfolio_items")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("portfolio_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FAITH_PORTFOLIOS = [
  {
    title: "Email Marketing & VA Portfolio",
    url: "https://happy-campaign-hub-97.lovable.app/",
    description: "Full-service email marketing and virtual assistant portfolio — campaign strategy, automation sequences, list management, and client reporting. Includes real campaign examples with open rates, click-through rates, and revenue impact. Covers Mailchimp, ConvertKit, ActiveCampaign, HubSpot, and GoHighLevel.",
    niche: "email-marketing",
    niche_tags: ["email-marketing", "virtual-assistant", "digital-marketing", "automation", "campaign"],
    is_primary: false,
  },
  {
    title: "Content & Digital Marketing Portfolio",
    url: "https://content-saver-pro.lovable.app/",
    description: "Digital marketing portfolio covering content strategy, social media management, copywriting, lead generation funnels, and brand growth. Features documented results across organic and paid channels. Includes content calendars, ad copy samples, and analytics reports.",
    niche: "email-marketing",
    niche_tags: ["digital-marketing", "content-writing", "copywriting", "social-media", "email-marketing"],
    is_primary: false,
  },
  {
    title: "AI Video Editing Portfolio",
    url: "https://caleb-ai-vision.lovable.app/faith",
    description: "AI-powered video editing portfolio — short-form content for social media, YouTube long-form, brand videos, reels, TikToks, and promotional videos. Specialises in AI-enhanced editing workflows, motion graphics, colour grading, and cinematic storytelling. Tools: CapCut, Premiere Pro, After Effects, Runway ML, ElevenLabs voiceover.",
    niche: "video-editing",
    niche_tags: ["video-editing", "ai-video", "reels", "youtube", "content-creation", "motion-graphics"],
    is_primary: false,
  },
  {
    title: "Full-Stack Web Development Portfolio",
    url: "https://multi-persona-portfolio.lovable.app/niche/fullstack-developer",
    description: "Full-stack web development portfolio with live projects — SaaS platforms, e-commerce stores, web apps, landing pages, and custom dashboards. Built with React, Next.js, TypeScript, Tailwind CSS, Node.js, Supabase, and PostgreSQL. Features responsive design, clean architecture, and production-grade code.",
    niche: "web-development",
    niche_tags: ["web-development", "full-stack", "react", "nextjs", "saas", "frontend"],
    is_primary: false,
  },
  {
    title: "Web Design & UI Portfolio",
    url: "https://bubblejoshproj.lovable.app/",
    description: "Web design and UI portfolio showcasing modern, premium websites — landing pages, business sites, portfolio sites, and product pages. Focus on clean UI, strong visual hierarchy, conversion-optimised layouts, and mobile-first design. Built with Webflow, Framer, React, and Lovable.",
    niche: "web-development",
    niche_tags: ["web-design", "ui-design", "landing-page", "webflow", "framer", "web-development"],
    is_primary: false,
  },
];

export const seedFaithPortfolios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const urls = FAITH_PORTFOLIOS.map((p) => p.url);

    // Check which URLs already exist for this user
    const { data: existing, error: fetchError } = await (context.supabase as any)
      .from("portfolio_items")
      .select("url")
      .eq("user_id", context.userId)
      .in("url", urls);

    if (fetchError) throw new Error(fetchError.message);

    const existingUrls = new Set((existing ?? []).map((r: { url: string }) => r.url));
    const toInsert = FAITH_PORTFOLIOS.filter((p) => !existingUrls.has(p.url)).map((p) => ({
      ...p,
      user_id: context.userId,
      is_favorite: false,
    }));

    if (toInsert.length > 0) {
      const { error: insertError } = await (context.supabase as any)
        .from("portfolio_items")
        .insert(toInsert);
      if (insertError) throw new Error(insertError.message);
    }

    return { seeded: toInsert.length, skipped: existingUrls.size };
  });
