import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function shortSlug(): string {
  return Math.random().toString(36).slice(2, 10); // e.g. "a3x9kz2m"
}

export const saveStrategyDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { doc: unknown }) => z.object({ doc: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    let slug = shortSlug();
    // Retry once on the unlikely collision
    for (let i = 0; i < 3; i++) {
      const { data: row, error } = await (context.supabase as any)
        .from("strategies")
        .insert({ user_id: context.userId, slug, doc: data.doc })
        .select("slug")
        .single();
      if (!error && row) return { slug: (row as { slug: string }).slug };
      slug = shortSlug();
    }
    throw new Error("Could not save strategy — please try again.");
  });

export const getPublicStrategy = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured.");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: row, error } = await (supabase as any)
      .from("strategies")
      .select("doc")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (row ? (row as any).doc : null) as any;
  });
