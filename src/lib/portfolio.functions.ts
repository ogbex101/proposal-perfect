import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { escapeRegExp } from "./utils";

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

// ─── Fix 10 — Curation-based AI portfolio (NOT fabrication) ────────────────────
// Pulls the user's REAL tagged portfolio entries, matches them to the detected job
// niche, orders/excerpts them by relevance, and writes an honest framing paragraph
// that leads with the most relevant real project(s). It invents NOTHING — no fake
// projects, no invented metrics, no synthetic visuals. If nothing matches strongly,
// it returns a note telling the user to add matching content rather than fabricating.
export const curateRealPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; detectedNiche?: string; detectedSkills?: string[] }) =>
    z.object({
      jobDescription: z.string().min(10).max(15000),
      detectedNiche: z.string().max(200).optional(),
      detectedSkills: z.array(z.string()).max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("portfolio_items")
      .select("*")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const items = (rows ?? []) as Array<{ id: string; title: string; url: string; description: string; niche?: string; niche_tags?: string[] }>;

    if (items.length === 0) {
      return { framing: "", ordered: [], note: "You have no portfolio entries yet. Add real projects (with skill tags) under Portfolio, then curate them for a job." };
    }

    // Score real entries by tag/niche overlap with the detected job needs.
    // Word-boundary aware so "react" doesn't match "reaction"/"overreact", and
    // multi-word tags ("ai video") must appear as a contiguous whole-word phrase.
    const norm = (s: string) => s.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
    const blob = norm((data.detectedNiche ?? "") + " " + (data.detectedSkills ?? []).join(" ") + " " + data.jobDescription);
    const tagMatches = (tag: string): boolean => {
      const t = norm(tag);
      if (!t) return false;
      // \b works at the word level for both single- and multi-word phrases once
      // punctuation/hyphens are normalized to spaces.
      return new RegExp(`\\b${escapeRegExp(t)}\\b`).test(blob);
    };
    const scored = items
      .map((p) => {
        const tags = [...(p.niche_tags ?? []), p.niche].filter(Boolean) as string[];
        const hitTags = tags.filter(tagMatches);
        const multiWordHits = hitTags.filter((t) => norm(t).includes(" "));
        const singleWordHits = hitTags.filter((t) => !norm(t).includes(" "));
        // Distinct single-word hits (dedupe by normalized form).
        const distinctSingle = new Set(singleWordHits.map(norm));
        return {
          item: p,
          score: hitTags.length,
          matchedTags: hitTags,
          multiWordHits: multiWordHits.length,
          distinctSingle: distinctSingle.size,
        };
      })
      .sort((a, b) => b.score - a.score);

    // A "strong" match requires either a multi-word tag hit OR ≥2 distinct
    // single-word tag hits. One generic single-word hit is not enough.
    const strong = scored.filter((s) => s.multiWordHits >= 1 || s.distinctSingle >= 2);

    // Sanity check: if the top item scored only 1 via a short (≤5 char) single-word
    // tag like "ai"/"ui"/"seo", treat it as no-match — it's a coincidental hit.
    const top = strong[0];
    const topIsWeakCoincidence =
      top && top.score === 1 && top.multiWordHits === 0 &&
      top.matchedTags.every((t) => norm(t).replace(/\s/g, "").length <= 5);

    if (strong.length === 0 || topIsWeakCoincidence) {
      return {
        framing: "",
        ordered: [],
        note: `No strongly matching portfolio content found for this niche${data.detectedNiche ? ` ("${data.detectedNiche}")` : ""}. Consider adding a real project for this niche under Portfolio rather than presenting unrelated work.`,
      };
    }

    // Order real entries by relevance; excerpt to the top few.
    const ordered = strong.slice(0, 4).map((s) => ({
      id: s.item.id,
      title: s.item.title,
      url: s.item.url,
      description: s.item.description,
      matchedTags: s.matchedTags,
    }));

    // Write an HONEST framing paragraph over the REAL entries. Hard fabrication guard.
    let framing = "";
    try {
      const { generateWithProvider } = await import("./ai-gateway.server");
      framing = await generateWithProvider("writer", {
        system: `You write ONE short, honest framing paragraph (2-4 sentences) that introduces a freelancer's REAL portfolio for a specific job. You lead with the single most relevant real project first.

ABSOLUTE RULES — NO FABRICATION:
- Use ONLY the real portfolio entries provided. Never invent a project, a client, a metric, a percentage, or a result that isn't in the supplied entry descriptions.
- Do not attach numbers or outcomes to a project unless that number is written in its description.
- If a description is thin, describe it honestly and generally rather than embellishing.
- No hype words (stunning, world-class, cutting-edge). Plain, confident, specific to what the real work actually is.
Your job is to connect the freelancer's real, relevant work to this job's needs — not to sell with invented proof.`,
        prompt: `JOB (what they need):\n${data.jobDescription.slice(0, 2500)}\n\nDETECTED NICHE: ${data.detectedNiche ?? "unspecified"}\n\nREAL PORTFOLIO ENTRIES (ordered by relevance — lead with the first):\n${ordered.map((o, i) => `${i + 1}. "${o.title}" — ${o.description || "(no description)"} [${o.url}]`).join("\n")}\n\nWrite the 2-4 sentence framing paragraph now. Lead with entry 1. Invent nothing.`,
      });
    } catch {
      framing = "";
    }

    return { framing: framing.trim(), ordered, note: null as string | null };
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
