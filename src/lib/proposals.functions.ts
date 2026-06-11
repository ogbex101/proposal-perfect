import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProposalInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().optional().nullable(),
  job_description: z.string().default(""),
  job_analysis: z.any().nullable().optional(),
  hook: z.string().nullable().optional(),
  strategy: z.string().nullable().optional(),
  length: z.enum(["brief", "robust", "explanatory"]),
  include_plan: z.boolean(),
  portfolio_ids: z.array(z.string().uuid()).default([]),
  budget: z.string().nullable().optional(),
  milestones: z.any().nullable().optional(),
  content: z.string().default(""),
  explanation: z.any().nullable().optional(),
});

export const saveProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ProposalInput>) => ProposalInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId } as any;
    const { data: row, error } = await context.supabase
      .from("proposals")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proposals")
      .select("id,title,job_description,length,content,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
