import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Verify the calling user is an admin (has role="admin" in user_roles).
// Uses supabaseAdmin to bypass RLS — the role check is always server-side.
async function requireAdmin(_supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role !== "admin") throw new Error("Forbidden: admin only.");
}

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  proposal_count: number;
  portfolio_count: number;
};

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);

    // Use service-role client to read auth.users
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);

    // Enrich with proposal + portfolio counts
    const ids = (users ?? []).map((u: any) => u.id);
    const [{ data: proposals }, { data: portfolios }] = await Promise.all([
      context.supabase.from("proposals").select("user_id").in("user_id", ids),
      context.supabase.from("generated_portfolios").select("user_id").in("user_id", ids),
    ]);

    const proposalCounts: Record<string, number> = {};
    const portfolioCounts: Record<string, number> = {};
    (proposals ?? []).forEach((r: any) => { proposalCounts[r.user_id] = (proposalCounts[r.user_id] ?? 0) + 1; });
    (portfolios ?? []).forEach((r: any) => { portfolioCounts[r.user_id] = (portfolioCounts[r.user_id] ?? 0) + 1; });

    return (users ?? []).map((u: any): AdminUser => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      proposal_count: proposalCounts[u.id] ?? 0,
      portfolio_count: portfolioCounts[u.id] ?? 0,
    }));
  });

export const getPageViewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    // page_views is locked down to service_role after the analytics RLS lockdown,
    // so authenticated reads return 0 rows. Use the admin client for the dashboard.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("page_views")
      .select("user_id, fingerprint, created_at, path")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordPageView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; fingerprint?: string; referrer?: string; userAgent?: string }) =>
    z.object({
      path: z.string().min(1).max(500),
      fingerprint: z.string().max(200).optional(),
      referrer: z.string().max(500).optional(),
      userAgent: z.string().max(500).optional(),
    }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("page_views").insert({
        path: data.path,
        fingerprint: data.fingerprint ?? null,
        referrer: data.referrer ?? null,
        user_agent: data.userAgent ?? null,
        user_id: context.userId,
      });
    } catch {
      // Never crash the page over analytics
    }
    return { ok: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (fetchErr || !user.user?.email) throw new Error("User not found");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(user.user.email);
    if (error) throw new Error(error.message);
    return { ok: true, email: user.user.email };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ApiKeyStatus = {
  name: string;
  envVar: string;
  configured: boolean;
  priority: number;
  free: boolean;
  signupUrl: string;
  description: string;
};

export const getApiKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const providers: Omit<ApiKeyStatus, "configured">[] = [
      {
        name: "Anthropic Claude",
        envVar: "ANTHROPIC_API_KEY",
        priority: 1,
        free: false,
        signupUrl: "https://console.anthropic.com",
        description: "Most reliable. Powers Claude Haiku (fast & affordable). Recommended primary key.",
      },
      {
        name: "Google Gemini Flash",
        envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
        priority: 2,
        free: true,
        signupUrl: "https://aistudio.google.com/app/apikey",
        description: "Free tier with 1M tokens/day. Gemini 2.0 Flash. Great free fallback.",
      },
      {
        name: "Groq (Llama 3.3)",
        envVar: "GROQ_API_KEY",
        priority: 3,
        free: true,
        signupUrl: "https://console.groq.com",
        description: "Free tier available. Ultra-fast inference for Llama 3.3 70B.",
      },
      {
        name: "Mistral",
        envVar: "MISTRAL_API_KEY",
        priority: 4,
        free: true,
        signupUrl: "https://console.mistral.ai",
        description: "Free tier for mistral-small. Good European alternative.",
      },
      {
        name: "OpenRouter",
        envVar: "OPENROUTER_API_KEY",
        priority: 5,
        free: true,
        signupUrl: "https://openrouter.ai/keys",
        description: "Access to many free models including Gemini Flash 1.5.",
      },
      {
        name: "OpenAI",
        envVar: "OPENAI_API_KEY",
        priority: 6,
        free: false,
        signupUrl: "https://platform.openai.com/api-keys",
        description: "Pay-per-use. Uses GPT-4o mini. Last-resort fallback.",
      },
    ];
    return providers.map((p) => ({
      ...p,
      configured: !!process.env[p.envVar],
    }));
  });

export const runAdminSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sql: string }) =>
    z.object({ sql: z.string().min(1).max(50000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("run_admin_sql", { sql: data.sql });
    if (error) throw new Error(error.message);
    // Serialize to plain JSON string to avoid TS serialization constraints
    return JSON.stringify(rows ?? []);
  });
