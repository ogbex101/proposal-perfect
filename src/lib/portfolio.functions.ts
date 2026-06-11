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
  .inputValidator((d: { id?: string; title: string; url: string; description: string; is_primary?: boolean; is_favorite?: boolean }) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(120),
      url: z.string().url().max(500),
      description: z.string().max(2000).default(""),
      is_primary: z.boolean().optional(),
      is_favorite: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId } as any;
    const { data: row, error } = await context.supabase
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
    const { error } = await context.supabase.from("portfolio_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
