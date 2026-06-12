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
      .select("id,title,job_description,length,content,hook,strategy,client_responded,responded_at,created_at")
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

// ─── Phase 3: response tracking ──────────────────────────────────────────────

export const markProposalResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; responded: boolean | null }) =>
    z.object({ id: z.string().uuid(), responded: z.boolean().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposals")
      .update({
        client_responded: data.responded,
        responded_at: data.responded !== null ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type HookStat = { id: string; total: number; responded: number; responseRate: number };
export type StrategyStat = { id: string; total: number; responded: number; responseRate: number };
export type ProposalAnalytics = {
  totalProposals: number;
  totalResponded: number;
  totalTracked: number;
  overallRate: number;
  hookStats: HookStat[];
  strategyStats: StrategyStat[];
  bestHook: string | null;
  bestStrategy: string | null;
};

export const getProposalAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProposalAnalytics> => {
    const { data, error } = await context.supabase
      .from("proposals")
      .select("hook, strategy, client_responded")
      .order("created_at", { ascending: false })
      .limit(500) as { data: Array<{ hook: string | null; strategy: string | null; client_responded: boolean | null }> | null; error: unknown };
    if (error) throw new Error((error as { message: string }).message);

    const proposals = data ?? [];
    const hookMap: Record<string, { total: number; responded: number }> = {};
    const stratMap: Record<string, { total: number; responded: number }> = {};

    for (const p of proposals) {
      const h = p.hook ?? "unknown";
      const s = p.strategy ?? "unknown";
      if (!hookMap[h]) hookMap[h] = { total: 0, responded: 0 };
      if (!stratMap[s]) stratMap[s] = { total: 0, responded: 0 };
      hookMap[h].total++;
      stratMap[s].total++;
      if (p.client_responded === true) {
        hookMap[h].responded++;
        stratMap[s].responded++;
      }
    }

    const toStats = (map: typeof hookMap): HookStat[] =>
      Object.entries(map)
        .map(([id, v]) => ({
          id,
          total: v.total,
          responded: v.responded,
          responseRate: v.total > 0 ? Math.round((v.responded / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.responseRate - a.responseRate || b.total - a.total);

    const hookStats = toStats(hookMap);
    const strategyStats = toStats(stratMap);
    const totalTracked = proposals.filter((p) => p.client_responded !== null).length;
    const totalResponded = proposals.filter((p) => p.client_responded === true).length;

    return {
      totalProposals: proposals.length,
      totalResponded,
      totalTracked,
      overallRate: totalTracked > 0 ? Math.round((totalResponded / totalTracked) * 100) : 0,
      hookStats,
      strategyStats,
      bestHook: hookStats.find((h) => h.total >= 2 && h.responded > 0)?.id ?? null,
      bestStrategy: strategyStats.find((s) => s.total >= 2 && s.responded > 0)?.id ?? null,
    };
  });
