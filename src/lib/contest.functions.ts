import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function shortSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const saveContestBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { brief: unknown; contestTitle?: string }) =>
    z.object({ brief: z.any(), contestTitle: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let slug = shortSlug();
    for (let i = 0; i < 3; i++) {
      const { data: row, error } = await (context.supabase as any)
        .from("contests")
        .insert({
          user_id: context.userId,
          slug,
          brief: data.brief,
          title: data.contestTitle ?? "Untitled Contest",
        })
        .select("slug")
        .single();
      if (!error && row) return { slug: (row as { slug: string }).slug };
      slug = shortSlug();
    }
    throw new Error("Could not save contest brief — please try again.");
  });

export const getPublicContest = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured.");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: row, error } = await (supabase as any)
      .from("contests")
      .select("brief, title")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? { brief: (row as any).brief, title: (row as any).title } : null;
  });
