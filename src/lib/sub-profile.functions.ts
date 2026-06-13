import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Credential } from "./profile.functions";

const MAX_SUB_PROFILES = 9;

const subProfileSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(60),
  niche: z.string().max(120).nullable().optional(),
  name: z.string().max(120).nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  my_story: z.string().max(3000).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  credentials: z.array(z.object({
    title: z.string().max(200),
    institution: z.string().max(200),
    year: z.string().max(10),
  })).max(20).optional(),
  brands_worked: z.array(z.string().max(100)).max(50).optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});

export type SubProfileInput = z.input<typeof subProfileSchema>;

export type SubProfile = {
  id: string;
  user_id: string;
  label: string;
  niche: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  my_story: string | null;
  skills: string[];
  credentials: Credential[];
  brands_worked: string[];
  avatar_url: string | null;
  avatar_signed_url?: string | null;
  created_at: string;
  updated_at: string;
};

function toSubProfile(row: Record<string, unknown>): SubProfile {
  return {
    ...row,
    skills: Array.isArray(row.skills) ? row.skills as string[] : [],
    credentials: Array.isArray(row.credentials) ? row.credentials as Credential[] : [],
    brands_worked: Array.isArray(row.brands_worked) ? row.brands_worked as string[] : [],
  } as unknown as SubProfile;
}

export const listSubProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sub_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return Promise.all((data ?? []).map(async (raw) => {
      const row = toSubProfile(raw);
      if (!row.avatar_url || /^https?:\/\//.test(row.avatar_url)) return { ...row, avatar_signed_url: row.avatar_url };
      const { data: signed } = await context.supabase.storage.from("avatars").createSignedUrl(row.avatar_url, 60 * 60 * 24 * 7);
      return { ...row, avatar_signed_url: signed?.signedUrl ?? null };
    }));
  });

export const upsertSubProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => subProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("sub_profiles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toSubProfile(row);
    }

    // Enforce max 9 sub-profiles
    const { count } = await context.supabase
      .from("sub_profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if ((count ?? 0) >= MAX_SUB_PROFILES) {
      throw new Error(`You can have at most ${MAX_SUB_PROFILES} sub-profiles (10 including head).`);
    }

    const { data: row, error } = await context.supabase
      .from("sub_profiles")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toSubProfile(row);
  });

export const deleteSubProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sub_profiles")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
