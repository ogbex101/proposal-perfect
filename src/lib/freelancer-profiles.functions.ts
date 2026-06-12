import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_PROFILES = 10;

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

async function signAvatar(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(value, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreelancerProfile = {
  id: string;
  user_id: string;
  label: string; // e.g. "Web Dev", "Copywriter"
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_signed_url?: string | null;
  skills: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ─── List all profiles ────────────────────────────────────────────────────────

export const listFreelancerProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const profiles = await Promise.all(
      (data ?? []).map(async (p) => ({
        ...p,
        avatar_signed_url: await signAvatar(context.supabase, p.avatar_url),
      })),
    );
    return profiles as FreelancerProfile[];
  });

// ─── Get active profile ───────────────────────────────────────────────────────

export const getActiveFreelancerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const avatar_signed_url = await signAvatar(context.supabase, data.avatar_url);
    return { ...data, avatar_signed_url } as FreelancerProfile;
  });

// ─── Create profile ───────────────────────────────────────────────────────────

const createSchema = z.object({
  label: z.string().min(1).max(80),
  name: z.string().max(120).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
});

export const createFreelancerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Count existing profiles
    const { count } = await context.supabase
      .from("freelancer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    if ((count ?? 0) >= MAX_PROFILES) {
      throw new Error(`You can have at most ${MAX_PROFILES} profiles.`);
    }

    const { data: row, error } = await context.supabase
      .from("freelancer_profiles")
      .insert({
        user_id: context.userId,
        label: data.label,
        name: data.name ?? null,
        bio: data.bio ?? null,
        skills: data.skills ?? [],
        is_active: false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as FreelancerProfile;
  });

// ─── Update profile ───────────────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80).optional(),
  name: z.string().max(120).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

export const updateFreelancerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("freelancer_profiles")
      .update(rest as never)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as FreelancerProfile;
  });

// ─── Switch active profile ────────────────────────────────────────────────────

export const switchFreelancerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Deactivate all, then activate chosen one
    await context.supabase
      .from("freelancer_profiles")
      .update({ is_active: false })
      .eq("user_id", context.userId);

    const { data: row, error } = await context.supabase
      .from("freelancer_profiles")
      .update({ is_active: true })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as FreelancerProfile;
  });

// ─── Delete profile ───────────────────────────────────────────────────────────

export const deleteFreelancerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("freelancer_profiles")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
