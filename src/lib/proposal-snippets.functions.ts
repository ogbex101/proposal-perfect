import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ProposalSnippet = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
};

export const listSnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProposalSnippet[]> => {
    const { data, error } = await context.supabase
      .from("proposal_snippets")
      .select("id, title, body, category, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProposalSnippet[];
  });

export const upsertSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; title: string; body: string; category?: string }) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(150),
      body: z.string().min(1).max(8000),
      category: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = { title: data.title, body: data.body, category: data.category ?? "general" };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("proposal_snippets")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("proposal_snippets")
      .insert({ ...payload, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_snippets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
