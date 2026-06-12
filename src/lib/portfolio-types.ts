// Shared types for AI-generated portfolios. Safe to import on client and server.

export type PortfolioProject = {
  title: string;
  description: string;
  tags: string[];
  imageUrl: string;
  imageKeywords?: string; // used to pick/generate the image
};

export type PortfolioTestimonial = {
  quote: string;
  author: string;
  role: string;
};

export type PortfolioFaq = {
  question: string;
  answer: string;
};

export type PortfolioCredential = {
  title: string;
  institution: string;
  year: string;
};

export type PortfolioData = {
  hero: {
    name: string;
    niche: string;
    tagline: string;
    avatarUrl: string;
  };
  aboutClient: string;
  myStory: string;
  whatIDo: { title: string; description: string }[];
  skills: string[];
  projects: PortfolioProject[];
  credentials: PortfolioCredential[];
  testimonials: PortfolioTestimonial[];
  faqs: PortfolioFaq[];
  brands: string[];
  contact: {
    email?: string;
    phone?: string;
    whatsapp?: string;
  };
};

export type GeneratedPortfolio = {
  id: string;
  slug: string;
  title: string;
  niche: string | null;
  job_excerpt: string | null;
  data: PortfolioData;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

// Build a URL-safe slug from free text + a short random suffix for uniqueness.
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "portfolio"}-${suffix}`;
}
