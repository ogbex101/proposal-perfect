// Curated proposal starter templates organized by niche.
// Each template has 5 sections (intro / value / pricing / cta / closing)
// which compose into a single proposal draft. Users edit the placeholders.

export type TemplateSection = {
  intro: string;
  value: string;
  pricing: string;
  cta: string;
  closing: string;
};

export type ProposalTemplate = {
  id: string;
  niche: string;
  name: string;
  description: string;
  sections: TemplateSection;
};

const C = (s: TemplateSection) => s;

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  // ── Web Development ──────────────────────────────────────────────────
  {
    id: "webdev-fullstack",
    niche: "Web Development",
    name: "Full-stack build",
    description: "End-to-end web app build with auth, DB, and deploy.",
    sections: C({
      intro:
        "Hi {{client_name}}, I read your post about {{project_summary}} and I've shipped this exact pattern before — most recently a {{recent_similar_project}} that's live in production today.",
      value:
        "Here's how I'd approach it:\n• Architecture: {{stack}} with typed end-to-end contracts\n• Auth + roles wired in from day one (no painful retrofits)\n• Database schema reviewed with you before any code\n• CI/CD + preview deploys so you see progress daily\n\nI'm picky about: clean migrations, sensible error states, and not over-engineering. You'll get something maintainable, not a black box.",
      pricing:
        "Scope as I read it: {{deliverables}}\nEstimate: {{price_range}} fixed, or {{hourly}}/hr if you'd prefer T&M.\nTimeline: {{weeks}} weeks, with a working demo by week {{demo_week}}.",
      cta:
        "Want me to send a 1-page technical plan (stack, milestones, risks) before you decide? I can have it in your inbox today.",
      closing:
        "Either way, happy to answer questions on the post. — {{your_name}}\nPortfolio: {{portfolio_url}}",
    }),
  },
  {
    id: "webdev-frontend",
    niche: "Web Development",
    name: "Frontend / React specialist",
    description: "UI build-out, performance, or component-system work.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} caught my eye because I just finished {{recent_similar_project}} with the same constraints.",
      value:
        "What I'd bring:\n• Pixel-accurate from Figma (or I'll design as I go if there's no spec)\n• Accessibility baked in (WCAG AA, keyboard, screen reader tested)\n• Lighthouse 95+ on the routes you care about\n• Reusable components, not one-off divs",
      pricing:
        "For the scope listed: {{price_range}}.\nI can start {{start_date}} and have the first reviewable build in {{first_review_days}} days.",
      cta:
        "If it's useful, I can record a 2-min Loom walking through how I'd structure this. Want me to send it?",
      closing: "Thanks for reading. — {{your_name}}",
    }),
  },

  // ── Video Editing ────────────────────────────────────────────────────
  {
    id: "video-shortform",
    niche: "Video Editing",
    name: "Short-form / Reels / TikTok",
    description: "Hooks, captions, b-roll, sound design for short-form.",
    sections: C({
      intro:
        "Hey {{client_name}} — I edit short-form for {{niche_examples}} and your post about {{project_summary}} is exactly what I do every week.",
      value:
        "Every edit I deliver includes:\n• Hook tested in the first 1.5s (3 variants if you want to A/B)\n• Dynamic captions, brand-matched\n• Licensed music + clean sound mix\n• B-roll and motion graphics where they earn their keep\n• Vertical 9:16 + 1:1 export from the same project",
      pricing:
        "Pricing: {{per_video}} per edit, or {{pack_price}} for a {{pack_size}}-video pack (saves ~{{savings_pct}}%).\nTurnaround: {{turnaround_hours}}h from footage drop.",
      cta:
        "Want a free 15-second sample cut from a clip you already have? Send the raw and I'll send the edit before you commit.",
      closing:
        "Recent work: {{portfolio_url}}\n— {{your_name}}",
    }),
  },
  {
    id: "video-longform",
    niche: "Video Editing",
    name: "Long-form / YouTube",
    description: "Story-driven cuts, retention pacing, thumbnails optional.",
    sections: C({
      intro:
        "Hi {{client_name}}, I edit long-form YouTube for creators in {{niche_examples}}. Your channel/post about {{project_summary}} is the kind of work I optimize for.",
      value:
        "How I edit for retention:\n• First 30s reshaped around the strongest hook in your raw\n• Pacing curve mapped against your last 5 videos' analytics\n• J-cuts, L-cuts, and silence trims — not just cuts on every breath\n• Chapter markers + end-screen ready",
      pricing:
        "Rate: {{per_video}} per finished video (up to {{minutes}} min). Bulk: {{bulk_price}} for {{bulk_count}} videos/month.\nFirst delivery: {{first_delivery_days}} days from raw footage.",
      cta:
        "Happy to do a paid trial edit so you can judge fit on real footage before any retainer.",
      closing: "Reel: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── Design ───────────────────────────────────────────────────────────
  {
    id: "design-uiux",
    niche: "Design",
    name: "UI/UX product design",
    description: "Product flows, design systems, high-fidelity Figma.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} matches the work I do most often: turning rough product ideas into shippable, devs-ready Figma.",
      value:
        "What you get:\n• User flows mapped before any pixel work\n• Wireframes → high-fidelity → interactive prototype\n• Design tokens (colors, type, spacing) handed to dev as variables\n• Two rounds of structured revisions baked into the price",
      pricing:
        "Scope: {{deliverables}}\nFee: {{price_range}}, paid 50% upfront / 50% on delivery.\nTimeline: {{weeks}} weeks.",
      cta:
        "If helpful, I can do a 20-min audit of your current product and send a Loom with 3 concrete improvement ideas — free.",
      closing: "Selected work: {{portfolio_url}}\n— {{your_name}}",
    }),
  },
  {
    id: "design-brand",
    niche: "Design",
    name: "Brand identity / logo",
    description: "Logo, brand system, guidelines, launch assets.",
    sections: C({
      intro:
        "Hi {{client_name}} — I build brand identities for {{niche_examples}}. Your project for {{project_summary}} is the type of work I love.",
      value:
        "Deliverables:\n• 3 distinct logo directions (not 3 variations of one)\n• Color system + typography pairing with rationale\n• Brand guidelines PDF\n• Launch asset pack (social avatars, banners, favicon)",
      pricing:
        "Investment: {{price_range}}, with {{deposit_pct}}% to start.\nTimeline: {{weeks}} weeks, first concepts by week {{concepts_week}}.",
      cta:
        "Want to see a 2-min walk-through of my process before deciding? Reply and I'll send it.",
      closing: "Portfolio: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── Marketing ────────────────────────────────────────────────────────
  {
    id: "marketing-paidads",
    niche: "Marketing",
    name: "Paid ads (Meta / Google)",
    description: "Campaign build, creative testing, scaling for ROAS.",
    sections: C({
      intro:
        "Hi {{client_name}} — saw your post on {{project_summary}}. I run paid ads for {{niche_examples}} and just hit {{recent_result}} for a similar client.",
      value:
        "My playbook:\n• Account audit first (free) — find the leaks before spending more\n• Creative testing framework: 3 angles × 3 hooks × 2 formats\n• Weekly scorecards in plain English, not screenshots of dashboards\n• Landing-page feedback included (it's usually where ROAS dies)",
      pricing:
        "Management fee: {{monthly_fee}}/mo, no setup fee.\nMinimum ad spend recommended: {{min_spend}}/mo to get statistically useful results.",
      cta:
        "I can audit your current account this week and send a Loom with the top 3 fixes — no commitment. Want me to?",
      closing: "Case studies: {{portfolio_url}}\n— {{your_name}}",
    }),
  },
  {
    id: "marketing-seo",
    niche: "Marketing",
    name: "SEO / content strategy",
    description: "Keyword strategy, on-page, content briefs, link plans.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} is exactly the SEO work I focus on. I help {{niche_examples}} go from invisible to ranking for buyer-intent terms.",
      value:
        "How I work:\n• Keyword map tied to your funnel (not vanity volume)\n• Content briefs your writers can execute in a day\n• On-page fixes prioritized by traffic impact\n• Monthly report with movement, wins, and what's next",
      pricing:
        "Retainer: {{monthly_fee}}/mo (6-month minimum to see results) or one-time strategy: {{strategy_price}}.\nFirst deliverable in week 1.",
      cta:
        "Want a free 1-page audit of your top 3 competitors' rankings vs. yours before deciding?",
      closing: "Recent wins: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── Writing ──────────────────────────────────────────────────────────
  {
    id: "writing-copy",
    niche: "Writing",
    name: "Copywriting (sales / landing pages)",
    description: "Direct-response copy for landing pages and sales pages.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} is the kind of conversion copy I write every week. Recent example: {{recent_result}}.",
      value:
        "My process:\n• Voice-of-customer research (real reviews, support tickets, sales calls)\n• Message hierarchy before any wordsmithing\n• Two drafts: one direct-response, one brand-led — pick what fits\n• A/B test suggestions baked in",
      pricing:
        "Landing page: {{landing_price}}. Full sales page: {{sales_price}}. Email sequence: {{email_price}} per email.\nTurnaround: {{turnaround_days}} days from kickoff.",
      cta:
        "Want me to rewrite your current headline and hero copy as a free sample? Reply with the URL.",
      closing: "Portfolio: {{portfolio_url}}\n— {{your_name}}",
    }),
  },
  {
    id: "writing-blog",
    niche: "Writing",
    name: "Blog / SEO content",
    description: "Long-form articles optimized for search and engagement.",
    sections: C({
      intro:
        "Hi {{client_name}} — I write long-form SEO content for {{niche_examples}}. Your post about {{project_summary}} is right in my wheelhouse.",
      value:
        "Every article includes:\n• Keyword + intent research before drafting\n• Original quotes / data points (no LLM regurgitation)\n• Optimized headings, meta, internal links\n• Royalty-free imagery or AI illustrations as needed",
      pricing:
        "Rate: {{per_word}}/word or {{per_article}} per 1,500-word article.\nBulk: 4 articles/month for {{bulk_price}}.",
      cta:
        "Send a topic and I'll deliver an outline + first 300 words as a paid trial — judge fit before committing.",
      closing: "Samples: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── AI / Automation ──────────────────────────────────────────────────
  {
    id: "ai-automation",
    niche: "AI & Automation",
    name: "AI automation / agents",
    description: "Custom GPTs, n8n/Make workflows, AI integrations.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} is exactly what I build. I've shipped {{recent_similar_project}} that saves {{hours_saved}}h/week.",
      value:
        "What I'd build:\n• Workflow audit so we automate the right thing\n• Production-grade (error handling, retries, logging — not a demo)\n• Costs estimated upfront so the AI bill doesn't surprise you\n• Documentation + Loom walkthrough so your team can maintain it",
      pricing:
        "Fixed price: {{price_range}}, depending on integrations.\nTimeline: {{weeks}} weeks. Ongoing support: {{support_fee}}/mo (optional).",
      cta:
        "Want a free 20-min call to scope this properly? I'll send a written plan after, regardless of whether we work together.",
      closing: "Examples: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── Mobile Development ───────────────────────────────────────────────
  {
    id: "mobile-app",
    niche: "Mobile Development",
    name: "Mobile app (iOS / Android)",
    description: "React Native or native app build with store submission.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} matches my recent work on {{recent_similar_project}}, now live on both stores.",
      value:
        "How I'd ship this:\n• React Native + Expo for one codebase, two stores (unless you need native)\n• Push notifications, deep links, and analytics from v1\n• App Store + Play Store submission handled (assets, screenshots, copy)\n• Crash reporting and OTA updates baked in",
      pricing:
        "Build: {{price_range}}. Store submission: included.\nTimeline: {{weeks}} weeks to TestFlight, +{{review_weeks}} weeks for review.",
      cta:
        "I can send a 1-page spec (stack, screens, risks) before you decide — useful even if you go elsewhere. Want it?",
      closing: "Past apps: {{portfolio_url}}\n— {{your_name}}",
    }),
  },

  // ── VA / Ops ─────────────────────────────────────────────────────────
  {
    id: "va-general",
    niche: "Virtual Assistant",
    name: "Virtual assistant / ops support",
    description: "Inbox, calendar, research, light project management.",
    sections: C({
      intro:
        "Hi {{client_name}} — your post about {{project_summary}} sounds like the ops support I provide for {{niche_examples}}.",
      value:
        "What I take off your plate:\n• Inbox triage to zero, daily\n• Calendar booking + meeting prep notes\n• Research with sourced summaries (not just links)\n• SOPs documented so nothing lives only in my head",
      pricing:
        "{{hourly}}/hr, or {{monthly_fee}}/mo for {{monthly_hours}}h. No long-term lock-in.\nAvailable {{availability}} in your timezone.",
      cta:
        "Want to start with a 1-week paid trial? You see fit, I see if it's a match, no awkward exit.",
      closing: "References available on request. — {{your_name}}",
    }),
  },
];

export const NICHES = Array.from(new Set(PROPOSAL_TEMPLATES.map((t) => t.niche)));

export function composeTemplate(t: ProposalTemplate): string {
  const s = t.sections;
  return [s.intro, s.value, s.pricing, s.cta, s.closing].filter(Boolean).join("\n\n");
}
