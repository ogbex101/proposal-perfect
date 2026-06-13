export type ReferenceFamily = "developer" | "design" | "marketing" | "operations" | "video";

export type ReferenceProject = {
  title: string;
  description: string;
  tags: string[];
  imageKeywords: string;
  imageUrl?: string;
};

export type PortfolioReferenceTemplate = {
  family: ReferenceFamily;
  label: string;
  referenceUrls: string[];
  keywords: string[];
  services: { title: string; description: string }[];
  projects: ReferenceProject[];
  visualDirection: string;
};

const developer: PortfolioReferenceTemplate = {
  family: "developer",
  label: "Software & Full-Stack Development",
  referenceUrls: ["https://dolapoportfolio.lovable.app/", "https://multi-persona-portfolio.lovable.app/niche/fullstack-developer", "https://bubblejoshproj.lovable.app/"],
  keywords: ["developer", "development", "software", "website", "web app", "full stack", "frontend", "backend", "react", "next.js", "node", "python", "bubble", "no-code", "supabase", "database", "api", "programming", "saas"],
  visualDirection: "dark technical editorial, bold product imagery, code-inspired details, strong project case studies",
  services: [
    { title: "Application Development", description: "End-to-end product builds with responsive interfaces and maintainable architecture." },
    { title: "Database Architecture", description: "Structured data models, secure access rules, efficient queries, and reliable migrations." },
    { title: "APIs & Integrations", description: "Payments, AI, messaging, automation, and third-party services connected into one dependable workflow." },
    { title: "Responsive UI Engineering", description: "Polished interfaces that remain clear, fast, and usable across screen sizes." },
  ],
  projects: [
    { title: "AI Website Security & Analysis Tool", description: "A real-time scanner for security, performance, SEO, and accessibility with visual previews and prioritized fixes.", tags: ["TypeScript", "AI", "Security"], imageKeywords: "cybersecurity analytics dashboard website scanner UI", imageUrl: "https://slijjjzgalpgugyjouih.supabase.co/storage/v1/object/public/project-images/13802a08-26cc-4c61-8760-d33888d848cf.png" },
    { title: "Recruitment Management Portal", description: "A dual-interface recruitment system with job discovery, applications, document uploads, status tracking, and administration.", tags: ["Next.js", "Database", "Auth"], imageKeywords: "modern recruitment applicant tracking dashboard", imageUrl: "https://slijjjzgalpgugyjouih.supabase.co/storage/v1/object/public/project-images/b386fd0c-e16b-4e1f-9080-048c17249333.png" },
    { title: "Real-Time Communication Platform", description: "Role-based course communities with live messaging, file sharing, enrolment, and resource management.", tags: ["Realtime", "PostgreSQL", "JWT"], imageKeywords: "education chat collaboration web application", imageUrl: "https://slijjjzgalpgugyjouih.supabase.co/storage/v1/object/public/project-images/7b7a33f1-07b7-469a-bd8d-19e2d25dd073.png" },
    { title: "Scalable SaaS Workspace", description: "A multi-user product workspace combining reusable workflows, integrations, permissions, and production-ready data architecture.", tags: ["SaaS", "API", "Workflows"], imageKeywords: "saas project management application dashboard", imageUrl: "https://aiiyykdklfukbwfniexm.supabase.co/storage/v1/object/public/portfolio/projects/a6b2affd-4314-4c1f-9726-a2fdd1172906.png" },
  ],
};

const marketing: PortfolioReferenceTemplate = {
  family: "marketing",
  label: "Email & Social Marketing",
  referenceUrls: ["https://content-saver-pro.lovable.app/", "https://happy-campaign-hub-97.lovable.app/"],
  keywords: ["email", "klaviyo", "mailchimp", "campaign", "crm", "newsletter", "retention", "lifecycle", "social media", "content management", "hubspot", "segmentation"],
  visualDirection: "campaign-led editorial, tall email artwork, measurable outcomes, polished ecommerce energy",
  services: [
    { title: "Campaign Strategy", description: "End-to-end planning from audience and offer through send-time optimization and reporting." },
    { title: "Klaviyo & Mailchimp Automation", description: "Welcome, abandoned-cart, post-purchase, win-back, and retention flows." },
    { title: "Copywriting & Segmentation", description: "Focused messaging paired with behavioural segments for more relevant sends." },
    { title: "Testing & Optimization", description: "Structured experiments across subject lines, creative, timing, audience, and offers." },
  ],
  projects: [
    { title: "Ecommerce Welcome Series", description: "A branded welcome sequence that introduces the offer, handles objections, and moves new subscribers toward a first purchase.", tags: ["Klaviyo", "Lifecycle", "Design"], imageKeywords: "premium ecommerce welcome email design long form", imageUrl: "https://jfnvnjfxthkxqnjvlmkk.supabase.co/storage/v1/object/public/portfolio-media/1778998774088-AACa__illa.png" },
    { title: "Retention Flow System", description: "A coordinated post-purchase and win-back system built around customer behaviour and lifecycle timing.", tags: ["Automation", "Segmentation", "CRM"], imageKeywords: "email marketing automation flow dashboard", imageUrl: "https://jfnvnjfxthkxqnjvlmkk.supabase.co/storage/v1/object/public/portfolio-media/1778998829397-Welcome_Email___Dr._Baron_Shop____1_.png" },
    { title: "Promotional Campaign Suite", description: "A reusable campaign design system for launches, seasonal promotions, and product storytelling.", tags: ["Mailchimp", "Copywriting", "A/B Testing"], imageKeywords: "fashion ecommerce promotional email campaign design", imageUrl: "https://jfnvnjfxthkxqnjvlmkk.supabase.co/storage/v1/object/public/portfolio-media/1779253612885-Frame_18__1_.png" },
    { title: "Social Content Operations", description: "A practical content workflow covering research, scheduling, asset organization, approvals, and reporting.", tags: ["Social Media", "Canva", "Analytics"], imageKeywords: "social media content calendar analytics workspace", imageUrl: "https://svzpenybdkmkfzbfyafg.supabase.co/storage/v1/object/public/portfolio/projects/1779276129587-89zrw4o43oi.png" },
  ],
};

const operations: PortfolioReferenceTemplate = {
  ...marketing,
  family: "operations",
  label: "Virtual Assistance & Automation",
  keywords: ["virtual assistant", "assistant", "automation", "workflow", "zapier", "make.com", "n8n", "notion", "calendar", "data entry", "research", "administrative", "project management"],
  visualDirection: "warm editorial workspace, organized systems, clear service categories, practical before-and-after workflows",
  services: [
    { title: "Executive & Inbox Support", description: "Calendar, inbox, follow-up, documentation, and day-to-day coordination kept under control." },
    { title: "Workflow Automation", description: "Repeatable processes connected with Zapier, Make, n8n, and practical AI tools." },
    { title: "Research & Operations", description: "Accurate research, data organization, reporting, and process documentation in plain English." },
    { title: "Project Coordination", description: "Tasks, owners, deadlines, assets, and updates organized across the tools your team already uses." },
  ],
};

const video: PortfolioReferenceTemplate = {
  family: "video",
  label: "AI Video Editing",
  referenceUrls: ["https://caleb-ai-vision.lovable.app/"],
  keywords: ["video", "video editing", "ai video", "runway", "sora", "kling", "capcut", "davinci", "premiere", "after effects", "motion", "youtube", "reels"],
  visualDirection: "cinematic black studio, cyan highlights, full-bleed frames, editing-suite imagery, high-energy showreel",
  services: [
    { title: "AI-Assisted Editing", description: "Fast, intentional edits enhanced with modern generation, cleanup, and upscaling tools." },
    { title: "Short-Form Content", description: "Platform-aware reels, ads, hooks, captions, pacing, and visual storytelling." },
    { title: "Motion & Visual Effects", description: "Motion graphics, compositing, transitions, and effects that support the story." },
    { title: "Color & Finishing", description: "Professional color, sound polish, format delivery, and quality control." },
  ],
  projects: [
    { title: "Cinematic Brand Launch", description: "A polished launch film combining AI-generated scenes, product footage, motion design, and controlled pacing.", tags: ["Runway", "Premiere Pro", "VFX"], imageKeywords: "cinematic brand launch video editing timeline" },
    { title: "Short-Form Growth Series", description: "A repeatable short-form package with strong opening hooks, captions, pattern interrupts, and platform-ready exports.", tags: ["CapCut", "Reels", "Captions"], imageKeywords: "vertical social video editing creator studio" },
    { title: "AI Presenter Production", description: "A presenter-led educational video system with AI avatars, supporting visuals, and consistent branded scenes.", tags: ["Synthesia", "HeyGen", "AI Video"], imageKeywords: "AI presenter video production workspace" },
    { title: "Documentary Story Edit", description: "A narrative-focused edit shaped from interviews, archival footage, sound design, and cinematic finishing.", tags: ["DaVinci Resolve", "Story", "Color"], imageKeywords: "documentary film editing color grading suite" },
  ],
};

const design: PortfolioReferenceTemplate = {
  family: "design",
  label: "UI/UX & Product Design",
  referenceUrls: [],
  keywords: ["ui", "ux", "ui/ux", "product design", "figma", "wireframe", "prototype", "design system", "user research", "web design", "mobile design"],
  visualDirection: "bright gallery-led product design, oversized typography, annotated screens, restrained color and generous whitespace",
  services: [
    { title: "Product Discovery", description: "User needs, business goals, journeys, and product constraints translated into a clear direction." },
    { title: "UX & Prototyping", description: "Flows, wireframes, interactive prototypes, and usability decisions grounded in the task." },
    { title: "Interface Design", description: "Distinctive responsive screens with strong hierarchy, accessibility, and thoughtful interaction states." },
    { title: "Design Systems", description: "Reusable tokens, components, patterns, and documentation that help teams ship consistently." },
  ],
  projects: [
    { title: "Fintech Mobile Experience", description: "A clear mobile product for onboarding, account insights, transfers, and everyday financial decisions.", tags: ["Figma", "Mobile", "Research"], imageKeywords: "premium fintech mobile app UI case study" },
    { title: "SaaS Analytics Redesign", description: "A dense operational dashboard reorganized for faster scanning, comparison, and confident action.", tags: ["Dashboard", "UX", "Design System"], imageKeywords: "modern SaaS analytics dashboard UI design" },
    { title: "Marketplace Design System", description: "A scalable component library covering discovery, listing, trust, checkout, and responsive states.", tags: ["Components", "Ecommerce", "Accessibility"], imageKeywords: "marketplace UI design system component library" },
    { title: "Healthcare Service Journey", description: "An accessible booking and care-management flow that reduces friction across complex user needs.", tags: ["Service Design", "Prototype", "A11y"], imageKeywords: "healthcare booking app UX case study" },
  ],
};

export const PORTFOLIO_REFERENCE_TEMPLATES = [developer, design, marketing, operations, video];

export function matchPortfolioReference(jobDescription: string): PortfolioReferenceTemplate {
  const text = jobDescription.toLowerCase();
  let best = design;
  let bestScore = 0;
  for (const template of PORTFOLIO_REFERENCE_TEMPLATES) {
    const score = template.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? keyword.split(" ").length : 0), 0);
    if (score > bestScore) {
      best = template;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : design;
}