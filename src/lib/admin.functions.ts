import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Confirms the calling user holds the 'admin' role. The check runs against the
 * caller's RLS-scoped client (they can only read their OWN roles), so it can't
 * be spoofed by passing another user's id. Throws if not an admin.
 */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Service-role client bypasses RLS — only reachable after the admin check above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: proposals, error: prErr }, { data: roles }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id,email,name,created_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("proposals").select("user_id"),
        supabaseAdmin.from("user_roles").select("user_id,role"),
      ]);
    if (pErr) throw new Error(pErr.message);
    if (prErr) throw new Error(prErr.message);

    const counts = new Map<string, number>();
    for (const p of proposals ?? []) {
      counts.set(p.user_id, (counts.get(p.user_id) ?? 0) + 1);
    }
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    return (profiles ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      created_at: u.created_at,
      proposal_count: counts.get(u.id) ?? 0,
      is_admin: adminIds.has(u.id),
    }));
  });

export const adminGetUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: proposals }, { data: saved }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin
        .from("proposals")
        .select("id,title,job_description,length,content,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("saved_items")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      profile,
      proposals: proposals ?? [],
      saved: saved ?? [],
    };
  });
