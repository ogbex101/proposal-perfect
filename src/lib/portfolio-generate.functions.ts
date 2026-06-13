import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { slugify, type PortfolioData } from "./portfolio-types";
import { matchPortfolioReference } from "./portfolio-reference-templates";

// ─── helpers (server-side) ────────────────────────────────────────────────────

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) throw new Error("Invalid image data");
  const contentType = match[1] || "image/png";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

const BUCKET = "portfolio-assets";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

// Upload bytes and return the storage PATH (bucket is private; we sign on read).
async function uploadImage(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  path: string,
  dataUrl: string,
): Promise<string> {
  const { bytes, contentType } = dataUrlToBytes(dataUrl);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// Sign a single stored value: external http(s) URLs pass through unchanged;
// storage paths get a signed URL.
async function signValue(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  value: string,
): Promise<string> {
  if (!value || /^https?:\/\//.test(value) || value.startsWith("data:")) return value;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, SIGNED_URL_TTL);
  return data?.signedUrl ?? value;
}

// Return a copy of the portfolio data with every image path turned into a
// signed URL ready to render.
async function signPortfolioImages(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  data: PortfolioData,
): Promise<PortfolioData> {
  const [avatarUrl, heroImageUrl, projects] = await Promise.all([
    signValue(supabase, data.hero.avatarUrl),
    signValue(supabase, data.hero.heroImageUrl ?? ""),
    Promise.all(
      data.projects.map(async (p) => ({ ...p, imageUrl: await signValue(supabase, p.imageUrl) })),
    ),
  ]);
  return { ...data, hero: { ...data.hero, avatarUrl, heroImageUrl: heroImageUrl || undefined }, projects };
}

// Keyword stock image (no API key needed), stable per seed.
function stockImageUrl(keywords: string, seed: number): string {
  const tags = keywords.trim().split(/\s+/).slice(0, 4).join(",");
  return `https://loremflickr.com/800/600/${encodeURIComponent(tags || "office,work")}?lock=${seed}`;
}

// Free AI image via Pollinations (no API key, no Lovable credits).
function pollinationsUrl(prompt: string, seed: number, w = 800, h = 600): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
}

// Fetch any image URL and return it as a base64 data URL we can upload.
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return `data:${contentType};base64,${btoa(binary)}`;
}

type ImageSource = "pollinations" | "stock" | "lovable";
function imageSource(): ImageSource {
  const v = (process.env.PORTFOLIO_IMAGE_SOURCE ?? "pollinations").toLowerCase();
  return v === "stock" || v === "lovable" ? v : "pollinations";
}

// Produce a project image as a data URL using the configured FREE source.
async function freeProjectImage(keywords: string, seed: number, projectTitle?: string, niche?: string): Promise<string> {
  if (imageSource() === "stock") {
    return fetchImageAsDataUrl(stockImageUrl(keywords, seed));
  }
  // Rich, context-specific prompt so the image actually relates to the project
  const context = [projectTitle && `Project: "${projectTitle}"`, niche && `Niche: ${niche}`, `Keywords: ${keywords}`].filter(Boolean).join(". ");
  const prompt = `High-quality professional photograph for a freelance portfolio. ${context}. Ultra-realistic, editorial quality. Either: a clean UI/app screenshot mockup on a device, or a professional workspace with relevant tools and equipment, or a finished product shot. No watermarks, no text overlays, no stock-photo clichés. Cinematic lighting.`;
  return fetchImageAsDataUrl(pollinationsUrl(prompt, seed));
}

// ─── generate (no DB write yet — returns data for preview) ─────────────────────

export const generatePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; subProfileId?: string }) =>
    z.object({
      jobDescription: z.string().min(20).max(15000),
      subProfileId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // 1. Load the freelancer's profile.
    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("Complete your profile before generating a portfolio.");

    // Merge with the explicitly selected persona if specified.
    let activeProfile = profile;
    let personaNiche = "";
    if (data.subProfileId) {
      const { data: sub } = await context.supabase
        .from("sub_profiles")
        .select("*")
        .eq("id", data.subProfileId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (sub) {
        personaNiche = (sub as any).niche ?? "";
        activeProfile = {
          ...profile,
          name: (sub as any).name ?? profile.name,
          bio: (sub as any).bio ?? profile.bio,
          my_story: (sub as any).my_story ?? profile.my_story,
          skills: ((sub as any).skills?.length ? (sub as any).skills : profile.skills),
          credentials: ((sub as any).credentials?.length ? (sub as any).credentials : profile.credentials),
          brands_worked: ((sub as any).brands_worked?.length ? (sub as any).brands_worked : profile.brands_worked),
          avatar_url: (sub as any).avatar_url ?? profile.avatar_url,
          email: (sub as any).email ?? profile.email,
          phone: (sub as any).phone ?? profile.phone,
          whatsapp: (sub as any).whatsapp ?? profile.whatsapp,
        };
      }
    }

    const skills: string[] = (activeProfile.skills as string[] | null) ?? [];
    const brands: string[] = (activeProfile.brands_worked as string[] | null) ?? [];
    const credentials =
      ((activeProfile.credentials as { title: string; institution: string; year: string }[] | null) ?? []);

    // 2. Deterministically select the closest supplied reference family, then
    // let AI tailor only the variable 30% of its content to this job.
    const reference = matchPortfolioReference(`${personaNiche}\n${data.jobDescription}`);
    const { generatePortfolioCopy } = await import("./portfolio-ai.server");
    const copy = await generatePortfolioCopy(data.jobDescription, {
      name: activeProfile.name ?? "",
      bio: activeProfile.bio ?? "",
      myStory: activeProfile.my_story ?? "",
      skills,
      credentials,
      brands,
    }, reference);

    const folder = `${context.userId}/gen-${Date.now()}`;

    // 3. Profile picture: saved avatar (enhanced or regular) → else AI headshot.
    //    Everything is stored as a portfolio-assets PATH (or external URL) so the
    //    public page can sign it uniformly.
    let avatarUrl = "";
    const savedAvatar = activeProfile.avatar_url ?? "";
    if (savedAvatar) {
      if (/^https?:\/\//.test(savedAvatar)) {
        avatarUrl = savedAvatar; // legacy external/public URL — use as-is
      } else {
        // Copy the saved avatar (in the private "avatars" bucket) into this
        // portfolio so it can be signed alongside the other images.
        try {
          const { data: blob } = await context.supabase.storage.from("avatars").download(savedAvatar);
          if (blob) {
            const ab = await blob.arrayBuffer();
            const bytes = new Uint8Array(ab);
            const ext = (savedAvatar.split(".").pop() || "png").toLowerCase();
            const path = `${folder}/headshot.${ext}`;
            const { error } = await context.supabase.storage
              .from(BUCKET)
              .upload(path, bytes, { contentType: blob.type || "image/png", upsert: true });
            if (!error) avatarUrl = path;
          }
        } catch {
          /* fall through to generation */
        }
      }
    }
    if (!avatarUrl) {
      try {
        let headshot: string;
        if (imageSource() === "lovable") {
          const { generateImage } = await import("./avatar-ai.server");
          headshot = await generateImage(activeProfile.name ?? undefined, `${copy.niche}. ${activeProfile.bio ?? ""}`);
        } else {
          // Free AI headshot (no Lovable credits).
          const prompt = `Professional corporate headshot portrait of a person, ${copy.niche}, neutral studio background, business attire, friendly confident expression, high quality, sharp focus.`;
          headshot = await fetchImageAsDataUrl(pollinationsUrl(prompt, 7, 600, 600));
        }
        avatarUrl = await uploadImage(context.supabase, `${folder}/headshot.png`, headshot);
      } catch {
        avatarUrl = ""; // template falls back to an initial monogram
      }
    }

    // 4. Project images. Default to a FREE source (Pollinations AI or stock) so
    //    portfolios don't burn Lovable AI credits. Each image is fetched and
    //    stored in the bucket so the portfolio is self-contained. External URL
    //    kept as the ultimate fallback if both fetch and upload fail.
    const source = imageSource();
    const projects = await Promise.all(
       copy.projects.map(async (proj, i) => {
         const fallback = reference.projects[i];
         const keywords = fallback?.imageKeywords || proj.imageKeywords || proj.tags.join(" ");
        let imageUrl = stockImageUrl(keywords, i + 1); // external fallback
        try {
          let dataUrl: string;
          if (source === "lovable") {
            const { generateImagePrompted } = await import("./avatar-ai.server");
            dataUrl = await generateImagePrompted(
              `Photorealistic portfolio image for a freelance project titled "${proj.title}". ${keywords}. Niche: ${copy.niche}. Modern, clean, professional UI or workspace. No text, no logos.`,
            );
          } else {
            dataUrl = await freeProjectImage(keywords, i + 1, proj.title, copy.niche);
          }
          imageUrl = await uploadImage(context.supabase, `${folder}/project-${i + 1}.png`, dataUrl);
        } catch {
          // keep external stock fallback
        }
        return {
           title: fallback?.title ?? proj.title,
          description: proj.description,
           tags: fallback?.tags ?? proj.tags,
          imageUrl,
          imageKeywords: keywords,
        };
      }),
    );

    // 4b. Hero background image — niche-specific wide landscape.
    let heroImageUrl = "";
    try {
      const heroPrompt = `Professional workspace photograph representing ${copy.niche}. Wide landscape format. Modern, clean, well-lit. No people, no faces, no text, no logos. Cinematic depth of field. High quality editorial photo.`;
      const heroDataUrl = await freeProjectImage(heroPrompt, 99, undefined, copy.niche);
      heroImageUrl = await uploadImage(context.supabase, `${folder}/hero-bg.png`, heroDataUrl);
    } catch {
      // fallback: no hero image, gradient used instead
    }

    // 5. Assemble — factual fields straight from the profile.
    const portfolio: PortfolioData = {
      hero: {
        name: activeProfile.name || "Your Name",
        niche: copy.niche,
        tagline: copy.tagline,
        avatarUrl,
        heroImageUrl,
      },
      aboutClient: copy.aboutClient,
      myStory: activeProfile.my_story ?? "",
      whatIDo: copy.whatIDo,
      skills,
      projects,
      credentials,
      testimonials: copy.testimonials,
      faqs: copy.faqs,
      brands,
      contact: {
        email: activeProfile.email ?? undefined,
        phone: activeProfile.phone ?? undefined,
        whatsapp: activeProfile.whatsapp ?? undefined,
      },
    };

    // `data` holds storage paths (for saving); `displayData` has signed URLs
    // (for the immediate in-app preview).
    const displayData = await signPortfolioImages(context.supabase, portfolio);

    return {
      data: portfolio,
      displayData,
      niche: copy.niche,
      jobExcerpt: data.jobDescription.slice(0, 280),
    };
  });

// ─── save (persist for reuse, returns slug for the public URL) ────────────────

export const saveGeneratedPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title?: string; niche?: string; jobExcerpt?: string; data: unknown }) =>
    z
      .object({
        title: z.string().max(120).optional(),
        niche: z.string().max(120).optional(),
        jobExcerpt: z.string().max(500).optional(),
        data: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const pd = data.data as PortfolioData;
    const title = data.title?.trim() || `${pd?.hero?.name ?? "My"} — ${data.niche ?? "Portfolio"}`;
    const slug = slugify(`${pd?.hero?.name ?? "portfolio"}-${data.niche ?? ""}`);

    const { data: row, error } = await (context.supabase as any).from("generated_portfolios")
      .insert({
        user_id: context.userId,
        slug,
        title,
        niche: data.niche ?? null,
        job_excerpt: data.jobExcerpt ?? null,
        data: pd,
        is_published: true,
      })
      .select("id, slug, title")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; slug: string; title: string };
  });

// ─── list (for the "Use my saved portfolio" dropdown) ─────────────────────────

export const listGeneratedPortfolios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).from("generated_portfolios")
      .select("id, slug, title, niche, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      slug: string;
      title: string;
      niche: string | null;
      created_at: string;
    }>;
  });

// ─── public read (no auth — powers the shareable /p/<slug> page) ──────────────

export const getPublicPortfolio = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase is not configured.");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error } = await supabase
      .from("generated_portfolios")
      .select("title, niche, data")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    // Stored image values are private storage paths — sign them so anonymous
    // visitors can load them. (Our SELECT policy permits signing for anyone.)
    const signed = await signPortfolioImages(supabase, (row as { data: PortfolioData }).data);
    return {
      title: (row as { title: string }).title,
      niche: (row as { niche: string | null }).niche,
      data: signed,
    };
  });
