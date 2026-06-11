import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const KIND = z.enum(["hook", "strategy", "portfolio", "proposal"]);

export const listSaved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: z.infer<typeof KIND>; ref_id?: string | null; snapshot: unknown }) =>
    z
      .object({
        kind: KIND,
        ref_id: z.string().max(200).nullable().optional(),
        snapshot: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Avoid duplicate favorites for the same ref + kind
    if (data.ref_id) {
      const { data: existing } = await context.supabase
        .from("saved_items")
        .select("id")
        .eq("kind", data.kind)
        .eq("ref_id", data.ref_id)
        .limit(1);
      if (existing && existing.length > 0) return existing[0];
    }
    const { data: row, error } = await context.supabase
      .from("saved_items")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        ref_id: data.ref_id ?? null,
        snapshot: data.snapshot,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
