import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateObjectWithProvider } from "./ai-gateway.server";

// A concrete, four-part portfolio piece — never a generic "optimized for results" blurb.
export type FourPartPiece = {
  niche: string;
  situation: string;   // one line
  approach: string;    // 2-3 lines, niche-specific language
  visualDirection: string; // a concrete, niche-accurate image/video subject (no generic stock)
  takeaway: string;    // one line, framed toward what a future client in that niche cares about
};

const FourPartSchema = z.object({
  situation: z.string(),
  approach: z.string(),
  visualDirection: z.string(),
  takeaway: z.string(),
});

// The reusable per-niche template (the SHAPE + niche language guidance), stored once
// per niche and repopulated with job specifics on each generation.
const TemplateGuidanceSchema = z.object({
  situationGuidance: z.string(),
  approachGuidance: z.string(),
  visualDirection: z.string(),
  takeawayGuidance: z.string(),
});

/**
 * Generate a four-part portfolio piece for a specific job, using (or creating) the
 * per-niche template. If a template exists for the niche, its slots are repopulated
 * with fresh job-specific specifics. If none exists, one is built and saved as the
 * template for that niche going forward. Invents nothing.
 */
export const generateNichePortfolioPiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobDescription: string; niche: string; realProjectContext?: string }) =>
    z.object({
      jobDescription: z.string().min(10).max(15000),
      niche: z.string().min(1).max(120),
      realProjectContext: z.string().max(4000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ piece: FourPartPiece; createdTemplate: boolean }> => {
    const { supabase, userId } = context as any;
    const nicheKey = data.niche.trim();

    // 1) Look up an existing per-niche template.
    let templateGuidance: z.infer<typeof TemplateGuidanceSchema> | null = null;
    try {
      const { data: row } = await (supabase as any)
        .from("niche_portfolio_templates")
        .select("*")
        .eq("user_id", userId)
        .eq("niche", nicheKey)
        .maybeSingle();
      if (row) {
        templateGuidance = {
          situationGuidance: row.situation_guidance ?? "",
          approachGuidance: row.approach_guidance ?? "",
          visualDirection: row.visual_direction ?? "",
          takeawayGuidance: row.takeaway_guidance ?? "",
        };
      }
    } catch {
      /* table may not exist yet in a not-yet-migrated env; fall through to build */
    }

    let createdTemplate = false;

    // 2) If no template exists for this niche, build one (the reusable shape + niche
    //    language) and save it for future generations.
    if (!templateGuidance) {
      // No silent degrade: if the niche template itself can't be generated, every
      // downstream slot would be populated from empty guidance, producing a generic
      // piece dressed up as niche-specific. Fail loudly instead.
      try {
        templateGuidance = await generateObjectWithProvider("writer", {
          schema: TemplateGuidanceSchema,
          system: `You define a REUSABLE four-part portfolio template for a specific freelance niche. This is the SHAPE + the niche's real vocabulary — not a finished piece. The four parts:
- Situation: how to frame the client's starting problem in this niche (one line).
- Approach: what a real practitioner in this niche actually does — use the niche's genuine terminology (e.g. email marketing: flows, segments, deliverability, subject-line testing; video editing: pacing, b-roll, color grade, hook retention), never generic "optimized for results" filler.
- Visual direction: the concrete, niche-accurate subject a portfolio image/video should depict (e.g. "a Klaviyo flow builder canvas", "a video timeline with b-roll layers") — never a generic office desk or stock handshake.
- Takeaway: what a FUTURE client in this niche most cares about, framed as the payoff.
Write concise guidance for each part, specific to this niche's real practice.`,
          prompt: `Niche: ${nicheKey}\n\nDefine the four-part template guidance for this niche.`,
        });
      } catch (err) {
        throw new Error(
          `Could not generate a niche-specific template for "${nicheKey}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      // Save it (non-fatal — the template guidance itself is still valid to use below;
      // only future reuse from storage is lost).
      try {
        await (supabase as any).from("niche_portfolio_templates").upsert({
          user_id: userId,
          niche: nicheKey,
          situation_guidance: templateGuidance.situationGuidance,
          approach_guidance: templateGuidance.approachGuidance,
          visual_direction: templateGuidance.visualDirection,
          takeaway_guidance: templateGuidance.takeawayGuidance,
        }, { onConflict: "user_id,niche" });
        createdTemplate = true;
      } catch (err) {
        console.warn(`[niche-portfolio-template] failed to save template for "${nicheKey}", will regenerate next time:`, err);
      }
    }

    // 3) Populate the four slots with job-specific specifics using the niche template.
    const piece4 = await generateObjectWithProvider("writer", {
      schema: FourPartSchema,
      system: `You write ONE four-part portfolio piece tailored to a specific job, following the niche template guidance. Rules:
- Use the niche's real vocabulary; NEVER generic phrasing like "optimized for results", "high quality", "seamless experience".
- NO FABRICATION: never invent a metric, client name, result, or certification that isn't in the supplied context. If you have no real number, describe the mechanism, not an invented outcome.
- Situation: one line. Approach: 2-3 lines, concrete and niche-specific. Visual direction: a single concrete niche-accurate subject for the image/video (no generic stock). Takeaway: one line toward what a future client in this niche cares about.`,
      prompt: `NICHE: ${nicheKey}
TEMPLATE GUIDANCE:
- Situation: ${templateGuidance.situationGuidance}
- Approach: ${templateGuidance.approachGuidance}
- Visual: ${templateGuidance.visualDirection}
- Takeaway: ${templateGuidance.takeawayGuidance}

JOB POST:
${data.jobDescription.slice(0, 3000)}
${data.realProjectContext ? `\nREAL PROJECT CONTEXT (the only facts you may use):\n${data.realProjectContext.slice(0, 3000)}` : ""}

Write the four-part piece now, populated with specifics for THIS job.`,
    });

    return {
      piece: { niche: nicheKey, ...piece4 },
      createdTemplate,
    };
  });
