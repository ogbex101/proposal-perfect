import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ProposalIntelligenceObject } from "./proposal-intelligence";

export type MemoryOutcome = "won" | "lost" | "no_response" | "pending";

export type ProposalMemoryRow = {
  id: string;
  user_id: string;
  created_at: string;
  client_type: string | null;
  platform: string | null;
  detected_niche: string | null;
  primary_strategy: string | null;
  hook_id: string | null;
  strategy_id: string | null;
  cta_id: string | null;
  opening_line: string | null;
  cta_line: string | null;
  overall_confidence: number | null;
  required_human_review: boolean;
  outcome: MemoryOutcome | null;
  outcome_note: string | null;
  outcome_at: string | null;
  job_excerpt: string | null;
};

export type MemoryInsights = {
  totalProposals: number;
  wonCount: number;
  lostCount: number;
  noResponseCount: number;
  pendingCount: number;
  winRate: number;
  topStrategies: Array<{ strategy: string; count: number; winRate: number }>;
  topHooks: Array<{ hookId: string; count: number; winRate: number }>;
  avgConfidence: number;
};

/**
 * Non-fatally save a proposal memory entry after generation.
 * Exported as a plain async function (not a server function) so it can be
 * called from within another server function handler.
 */
export async function saveProposalMemoryInternal(
  supabase: any,
  userId: string,
  intelligence: ProposalIntelligenceObject,
  platform: string,
  jobDescription: string,
): Promise<string | null> {
  try {
    const bp = intelligence.proposalBlueprint;
    const ci = intelligence.clientIntelligence;
    const { data, error } = await supabase
      .from("proposal_memory")
      .insert({
        user_id: userId,
        client_type: ci.hiringMaturity ?? null,
        platform: platform || "upwork",
        detected_niche: (ci as any).detectedNiche ?? (ci as any).projectType ?? null,
        primary_strategy: bp.primaryStrategy,
        hook_id: bp.mappedHookId,
        strategy_id: bp.mappedStrategyId,
        cta_id: bp.mappedCtaId,
        opening_line: bp.openingLine,
        cta_line: bp.ctaLine,
        overall_confidence: intelligence.overallConfidence,
        required_human_review: intelligence.requiresHumanReview,
        outcome: "pending",
        job_excerpt: jobDescription.slice(0, 500),
      })
      .select("id")
      .single();

    if (error) return null;
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Server function to explicitly save a proposal memory entry.
 */
export const saveProposalMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    intelligence: ProposalIntelligenceObject;
    platform: string;
    jobDescription: string;
  }) =>
    z.object({
      intelligence: z.any(),
      platform: z.string(),
      jobDescription: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const id = await saveProposalMemoryInternal(
      supabase,
      userId,
      data.intelligence,
      data.platform,
      data.jobDescription,
    );
    return { id };
  });

/**
 * Mark a previously saved proposal memory with an outcome.
 */
export const markMemoryOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    memoryId: string;
    outcome: MemoryOutcome;
    outcomeNote?: string;
  }) =>
    z.object({
      memoryId: z.string().uuid(),
      outcome: z.enum(["won", "lost", "no_response", "pending"]),
      outcomeNote: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase
      .from("proposal_memory")
      .update({
        outcome: data.outcome,
        outcome_note: data.outcomeNote ?? null,
        outcome_at: new Date().toISOString(),
      })
      .eq("id", data.memoryId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Get aggregate insights from a user's proposal memory.
 */
export const getMemoryInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: rows, error } = await supabase
      .from("proposal_memory")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    const memories = (rows ?? []) as ProposalMemoryRow[];

    const total = memories.length;
    const won = memories.filter((m) => m.outcome === "won").length;
    const lost = memories.filter((m) => m.outcome === "lost").length;
    const noResponse = memories.filter((m) => m.outcome === "no_response").length;
    const pending = memories.filter((m) => m.outcome === "pending").length;

    const stratMap: Record<string, { count: number; wins: number }> = {};
    const hookMap: Record<string, { count: number; wins: number }> = {};

    for (const m of memories) {
      if (m.primary_strategy) {
        stratMap[m.primary_strategy] ??= { count: 0, wins: 0 };
        stratMap[m.primary_strategy].count++;
        if (m.outcome === "won") stratMap[m.primary_strategy].wins++;
      }
      if (m.hook_id) {
        hookMap[m.hook_id] ??= { count: 0, wins: 0 };
        hookMap[m.hook_id].count++;
        if (m.outcome === "won") hookMap[m.hook_id].wins++;
      }
    }

    const topStrategies = Object.entries(stratMap)
      .map(([strategy, v]) => ({ strategy, count: v.count, winRate: v.count > 0 ? v.wins / v.count : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topHooks = Object.entries(hookMap)
      .map(([hookId, v]) => ({ hookId, count: v.count, winRate: v.count > 0 ? v.wins / v.count : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const confScores = memories
      .map((m) => m.overall_confidence)
      .filter((c): c is number => c !== null);
    const avgConfidence =
      confScores.length > 0 ? confScores.reduce((a, b) => a + b, 0) / confScores.length : 0;

    const insights: MemoryInsights = {
      totalProposals: total,
      wonCount: won,
      lostCount: lost,
      noResponseCount: noResponse,
      pendingCount: pending,
      winRate: total > 0 ? won / total : 0,
      topStrategies,
      topHooks,
      avgConfidence,
    };

    return { insights, recent: memories.slice(0, 20) };
  });
