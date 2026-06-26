import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function adminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase admin credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Check if the current user has verified the access code
export const getUserAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("user_access")
      .select("verified_at")
      .eq("user_id", userId)
      .single();
    return { hasAccess: !!data };
  });

// Verify access code and grant access if correct
export const verifyAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // Read the current access code via service role (not blocked by RLS)
    const admin = adminClient();
    const { data: setting, error } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "access_code")
      .single();

    if (error || !setting) return { success: false, error: "System error. Please try again." };
    if (data.code.trim() !== setting.value.trim()) {
      return { success: false, error: "Incorrect access code." };
    }

    // Grant access
    await supabase
      .from("user_access")
      .upsert({ user_id: userId, verified_at: new Date().toISOString() });

    return { success: true };
  });

// Admin: update access code
export const updateAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newCode: string }) => z.object({ newCode: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const admin = adminClient();

    // Check admin
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Unauthorized");

    await admin
      .from("app_settings")
      .upsert({ key: "access_code", value: data.newCode.trim(), updated_at: new Date().toISOString() });

    return { success: true };
  });

// Admin: get current access code
export const getAccessCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const admin = adminClient();

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Unauthorized");

    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "access_code")
      .single();

    return { code: setting?.value ?? "" };
  });

// Admin: grant admin role to a user
export const makeUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string }) =>
    z.object({ targetUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const admin = adminClient();

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Unauthorized");

    await admin
      .from("user_roles")
      .upsert({ user_id: data.targetUserId, role: "admin" });

    return { success: true };
  });

// Admin: revoke admin role
export const revokeAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string }) =>
    z.object({ targetUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    if (userId === data.targetUserId) throw new Error("Cannot remove your own admin role");

    const admin = adminClient();

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Unauthorized");

    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("role", "admin");

    return { success: true };
  });

// Admin: revoke a user's access code verification (force re-entry)
export const revokeUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string }) =>
    z.object({ targetUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const admin = adminClient();

    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();
    if (!role) throw new Error("Unauthorized");

    await admin.from("user_access").delete().eq("user_id", data.targetUserId);
    return { success: true };
  });
