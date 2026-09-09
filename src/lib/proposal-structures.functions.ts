import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type StructureRecordResult = {
  fingerprint: string;
  occurrences: number;
  shouldPrompt: boolean;
};

/**
 * Record one occurrence of a structural fingerprint for the signed-in user.
 * Prompting rules:
 *  - never on the first occurrence
 *  - never once the structure was saved as a template
 *  - never twice for the same occurrence (declining is remembered)
 *  - a later recurrence may prompt again if still unsaved
 */
export const recordStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fingerprint: string; blocks: string[]; goldenKeyPattern?: string | null }) =>
    z
      .object({
        fingerprint: z.string().min(1).max(300),
        blocks: z.array(z.string().max(40)).max(40),
        goldenKeyPattern: z.string().max(60).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<StructureRecordResult> => {
    const { supabase, userId } = context;

    const { data: existing, error: readErr } = await supabase
      .from("proposal_structures")
      .select("id, occurrences, prompted_at_occurrence, saved_as_template")
      .eq("user_id", userId)
      .eq("fingerprint", data.fingerprint)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    if (!existing) {
      const { error } = await supabase.from("proposal_structures").insert({
        user_id: userId,
        fingerprint: data.fingerprint,
        blocks: data.blocks,
        golden_key_pattern: data.goldenKeyPattern ?? null,
      } as never);
      if (error) throw new Error(error.message);
      // First-ever occurrence: never prompt.
      return { fingerprint: data.fingerprint, occurrences: 1, shouldPrompt: false };
    }

    const occurrences = (existing.occurrences ?? 1) + 1;
    const { error } = await supabase
      .from("proposal_structures")
      .update({ occurrences })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const shouldPrompt =
      occurrences >= 2 &&
      !existing.saved_as_template &&
      occurrences > (existing.prompted_at_occurrence ?? 0);

    return { fingerprint: data.fingerprint, occurrences, shouldPrompt };
  });

/** Remember that we already asked at the current occurrence (user declined). */
export const dismissStructurePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fingerprint: string; occurrence: number }) =>
    z.object({ fingerprint: z.string().min(1).max(300), occurrence: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_structures")
      .update({ prompted_at_occurrence: data.occurrence })
      .eq("user_id", context.userId)
      .eq("fingerprint", data.fingerprint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mark a structure as saved so it never prompts again. */
export const markStructureSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fingerprint: string }) =>
    z.object({ fingerprint: z.string().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_structures")
      .update({ saved_as_template: true })
      .eq("user_id", context.userId)
      .eq("fingerprint", data.fingerprint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
