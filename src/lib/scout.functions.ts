import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoutRecord = {
  id: string;
  user_id: string;
  job_description: string;
  job_excerpt: string;
  job_type: string | null;
  subject_line: string | null;
  email_body: string | null;
  hook_rationale: string | null;
  strategy_note: string | null;
  dev_prompt_title: string | null;
  submitted: boolean;
  read_by_client: boolean;
  got_reply: boolean;
  converted: boolean;
  created_at: string;
};

export type OutreachTemplate = {
  id: string;
  user_id: string;
  name: string;
  email_content: string;
  category: "mockup" | "consultive" | "general";
  hook_style: string;
  insight_approach: string;
  cta_style: string;
  structure_analysis: string;
  created_at: string;
};

// ─── Save Scout Outreach ──────────────────────────────────────────────────────

export const saveScoutOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      job_description: z.string().min(1).max(15000),
      job_excerpt: z.string().max(300).default(""),
      job_type: z.string().max(50).optional(),
      subject_line: z.string().max(200).optional(),
      email_body: z.string().max(5000).optional(),
      hook_rationale: z.string().max(1000).optional(),
      strategy_note: z.string().max(1000).optional(),
      dev_prompt_title: z.string().max(200).optional(),
      submitted: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("scout_outreach")
      .insert({
        user_id: context.userId,
        job_description: data.job_description,
        job_excerpt: data.job_excerpt || data.job_description.slice(0, 200),
        job_type: data.job_type ?? null,
        subject_line: data.subject_line ?? null,
        email_body: data.email_body ?? null,
        hook_rationale: data.hook_rationale ?? null,
        strategy_note: data.strategy_note ?? null,
        dev_prompt_title: data.dev_prompt_title ?? null,
        submitted: data.submitted,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

// ─── List Scout Outreach ──────────────────────────────────────────────────────

export const listScoutOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScoutRecord[]> => {
    const { data, error } = await (context.supabase as any)
      .from("scout_outreach")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as ScoutRecord[];
  });

// ─── Update Scout Status ──────────────────────────────────────────────────────

export const updateScoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      submitted: z.boolean().optional(),
      read_by_client: z.boolean().optional(),
      got_reply: z.boolean().optional(),
      converted: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, boolean> = {};
    if (data.submitted !== undefined) patch.submitted = data.submitted;
    if (data.read_by_client !== undefined) patch.read_by_client = data.read_by_client;
    if (data.got_reply !== undefined) patch.got_reply = data.got_reply;
    if (data.converted !== undefined) patch.converted = data.converted;
    const { error } = await (context.supabase as any)
      .from("scout_outreach")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Update Proposal Full Status ─────────────────────────────────────────────

export const updateProposalFullStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      submitted: z.boolean().optional(),
      read_by_client: z.boolean().optional(),
      got_reply: z.boolean().optional(),
      converted: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, boolean> = {};
    if (data.submitted !== undefined) patch.submitted = data.submitted;
    if (data.read_by_client !== undefined) patch.read_by_client = data.read_by_client;
    if (data.got_reply !== undefined) patch.got_reply = data.got_reply;
    if (data.converted !== undefined) patch.converted = data.converted;
    const { error } = await (context.supabase as any)
      .from("proposals")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Analyze & Save Outreach Template ────────────────────────────────────────

export const analyzeAndSaveOutreachTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(100),
      email_content: z.string().min(50).max(5000),
      category: z.enum(["mockup", "consultive", "general"]).default("general"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateWithProvider } = await import("./ai-gateway.server");

    const analysis = await generateWithProvider("verifier", {
      system: "You analyze cold email outreach templates for freelancers and extract their persuasion structure as JSON.",
      prompt: `Analyze this outreach email and extract its structural DNA. Return ONLY valid JSON (no markdown):
{
  "hook_style": "<how it opens — e.g. Pattern interrupt, Problem identification, Curiosity gap, Social proof lead>",
  "insight_approach": "<how it demonstrates expertise — e.g. Names non-obvious problem, Cites specific outcome, References industry detail>",
  "cta_style": "<how it closes — e.g. Opinion ask, Discovery call, Low-friction reply, Proof offer>",
  "structure_analysis": "<2-3 sentences: what makes this email effective, what persuasion principles it uses, why it would get replies>",
  "detected_category": "<mockup|consultive|general — mockup if it leads with design/preview work, consultive if it leads with strategic insight>"
}

EMAIL TO ANALYZE:
${data.email_content}`,
    });

    let parsed: Record<string, string> = {};
    try {
      const clean = analysis.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        hook_style: "Custom",
        insight_approach: "Demonstrates expertise",
        cta_style: "Direct ask",
        structure_analysis: "Custom outreach template.",
        detected_category: data.category,
      };
    }

    const { data: row, error } = await (context.supabase as any)
      .from("outreach_templates")
      .insert({
        user_id: context.userId,
        name: data.name,
        email_content: data.email_content,
        category: parsed.detected_category ?? data.category,
        hook_style: parsed.hook_style ?? "",
        insight_approach: parsed.insight_approach ?? "",
        cta_style: parsed.cta_style ?? "",
        structure_analysis: parsed.structure_analysis ?? "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id, analysis: parsed };
  });

// ─── List Outreach Templates ──────────────────────────────────────────────────

export const listOutreachTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OutreachTemplate[]> => {
    const { data, error } = await (context.supabase as any)
      .from("outreach_templates")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OutreachTemplate[];
  });

// ─── Delete Outreach Template ─────────────────────────────────────────────────

export const deleteOutreachTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("outreach_templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Match Template to Job ────────────────────────────────────────────────────

export const matchTemplateToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      jobDescription: z.string().min(20).max(5000),
      templates: z.array(z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        hook_style: z.string(),
        cta_style: z.string(),
        structure_analysis: z.string(),
      })),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.templates.length === 0) return { bestId: null, reason: "No templates saved yet." };
    const { generateWithProvider } = await import("./ai-gateway.server");
    const list = data.templates.map((t, i) =>
      `${i + 1}. ID: ${t.id} | Name: ${t.name} | Category: ${t.category} | Hook: ${t.hook_style} | CTA: ${t.cta_style} | Analysis: ${t.structure_analysis}`
    ).join("\n");
    const res = await generateWithProvider("verifier", {
      system: "You match outreach email templates to job descriptions. Respond only with valid JSON.",
      prompt: `Given this job post, which outreach template would be the best fit?

JOB POST:
${data.jobDescription.slice(0, 1000)}

AVAILABLE TEMPLATES:
${list}

Return ONLY: {"bestId": "<the id of the best matching template>", "reason": "<one sentence why>"}`,
    });
    try {
      const clean = res.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
      return JSON.parse(clean) as { bestId: string; reason: string };
    } catch {
      return { bestId: data.templates[0].id, reason: "Defaulted to most recent template." };
    }
  });

// ─── Combined Tracking Data ───────────────────────────────────────────────────

export type TrackingRow = {
  id: string;
  kind: "proposal" | "scout";
  excerpt: string;
  hook: string | null;
  strategy: string | null;
  cta: string | null;
  subject_line: string | null;
  email_body: string | null;
  job_type: string | null;
  analyzed: boolean;
  generated: boolean;
  submitted: boolean;
  read_by_client: boolean;
  got_reply: boolean;
  converted: boolean;
  created_at: string;
};

export const getTrackingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrackingRow[]> => {
    const [{ data: proposals }, { data: scouts }] = await Promise.all([
      (context.supabase as any)
        .from("proposals")
        .select("id,title,job_description,hook,strategy,cta,client_responded,submitted,read_by_client,got_reply,converted,created_at,job_analysis")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(300),
      (context.supabase as any)
        .from("scout_outreach")
        .select("id,job_excerpt,job_type,subject_line,email_body,submitted,read_by_client,got_reply,converted,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const rows: TrackingRow[] = [];

    for (const p of (proposals ?? [])) {
      rows.push({
        id: p.id,
        kind: "proposal",
        excerpt: p.title ?? p.job_description?.slice(0, 120) ?? "Proposal",
        hook: p.hook ?? null,
        strategy: p.strategy ?? null,
        cta: p.cta ?? null,
        subject_line: null,
        email_body: null,
        job_type: null,
        analyzed: !!p.job_analysis,
        generated: true,
        submitted: p.submitted ?? false,
        read_by_client: p.read_by_client ?? false,
        got_reply: p.got_reply ?? p.client_responded ?? false,
        converted: p.converted ?? false,
        created_at: p.created_at,
      });
    }

    for (const s of (scouts ?? [])) {
      rows.push({
        id: s.id,
        kind: "scout",
        excerpt: s.job_excerpt ?? "Scout outreach",
        hook: null,
        strategy: null,
        cta: null,
        subject_line: s.subject_line ?? null,
        email_body: s.email_body ?? null,
        job_type: s.job_type ?? null,
        analyzed: false,
        generated: true,
        submitted: s.submitted ?? false,
        read_by_client: s.read_by_client ?? false,
        got_reply: s.got_reply ?? false,
        converted: s.converted ?? false,
        created_at: s.created_at,
      });
    }

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return rows;
  });
