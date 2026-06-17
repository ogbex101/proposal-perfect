import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export type ProfileImage = {
  id: string;
  storage_path: string;
  label: string | null;
  created_at: string;
  signed_url: string | null;
};

export const listProfileImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileImage[]> => {
    const { data, error } = await context.supabase
      .from("profile_images")
      .select("id, storage_path, label, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; storage_path: string; label: string | null; created_at: string }>;
    const out: ProfileImage[] = [];
    for (const row of rows) {
      const { data: signed } = await context.supabase.storage
        .from("avatars")
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      out.push({ ...row, signed_url: signed?.signedUrl ?? null });
    }
    return out;
  });

export const saveProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storage_path: string; label?: string }) =>
    z.object({
      storage_path: z.string().min(1).max(500),
      label: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.storage_path.startsWith(`${context.userId}/`)) {
      throw new Error("You can only save images from your own folder.");
    }
    const { data: row, error } = await context.supabase
      .from("profile_images")
      .insert({ user_id: context.userId, storage_path: data.storage_path, label: data.label ?? null })
      .select("id, storage_path, label, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profile_images")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
