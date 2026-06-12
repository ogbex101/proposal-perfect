import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RedFlagWord = { id: string; phrase: string; created_at: string };

export const listRedFlagWords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("red_flag_words")
      .select("id, phrase, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RedFlagWord[];
  });

export const addRedFlagWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phrase: string }) =>
    z.object({ phrase: z.string().min(2).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("red_flag_words")
      .insert({ user_id: context.userId, phrase: data.phrase.trim() })
      .select("id, phrase, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as RedFlagWord;
  });

export const deleteRedFlagWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("red_flag_words")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
