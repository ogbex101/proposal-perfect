import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Verify the calling user is an admin (has role="admin" in user_roles).
async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
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
    const { data, error } = await (context.supabase as any)
      .from("page_views")
      .select("user_id, fingerprint, created_at, path")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordPageView = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string; fingerprint?: string; referrer?: string; userAgent?: string; userId?: string }) =>
    z.object({
      path: z.string().max(500),
      fingerprint: z.string().max(200).optional(),
      referrer: z.string().max(500).optional(),
      userAgent: z.string().max(500).optional(),
      userId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("page_views").insert({
        path: data.path,
        fingerprint: data.fingerprint ?? null,
        referrer: data.referrer ?? null,
        user_agent: data.userAgent ?? null,
        user_id: data.userId ?? null,
      });
    } catch {
      // Never crash the page over analytics
    }
    return { ok: true };
  });
