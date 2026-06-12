import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Credential = {
  title: string;
  institution: string;
  year: string;
};

export type CustomHook = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type CustomStrategy = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

// ─── Validators ──────────────────────────────────────────────────────────────

const credentialSchema = z.object({
  title: z.string().max(200),
  institution: z.string().max(200),
  year: z.string().max(10),
});

const profileUpdateSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  whatsapp: z.string().max(30).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  my_story: z.string().max(3000).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  credentials: z.array(credentialSchema).max(20).optional(),
  brands_worked: z.array(z.string().max(100)).max(50).optional(),
  default_length: z.enum(["brief", "robust", "explanatory"]).optional(),
  default_plan: z.boolean().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

// ─── Profile ─────────────────────────────────────────────────────────────────

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return { profile, isAdmin };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update(data as never)
      .eq("id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ─── Avatar upload (returns a signed upload URL) ──────────────────────────────
// The client uploads directly to Supabase Storage; we just generate the path.

export const getAvatarUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileName: string; contentType: string }) =>
    z
      .object({
        fileName: z.string().max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ext = data.fileName.split(".").pop() ?? "jpg";
    const objectPath = `${context.userId}/avatar.${ext}`;

    const { data: signedData, error } = await context.supabase.storage
      .from("avatars")
      .createSignedUploadUrl(objectPath);

    if (error) throw new Error(error.message);

    // Public URL for the avatar after upload
    const { data: publicData } = context.supabase.storage
      .from("avatars")
      .getPublicUrl(objectPath);

    return {
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      path: objectPath,
      publicUrl: publicData.publicUrl,
    };
  });

// ─── AI avatar helpers (server-only) ─────────────────────────────────────────

// Decode a "data:image/...;base64,XXXX" URL into bytes + content type.
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) throw new Error("Invalid image data returned by AI");
  const contentType = match[1] || "image/png";
  const b64 = match[2];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

// Read an avatar from storage and return it as a base64 data URL the AI can read.
async function storagePathToDataUrl(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from("avatars").download(path);
  if (error || !data) throw new Error(error?.message ?? "Could not read the uploaded image");
  const arrayBuffer = await data.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const contentType = data.type || "image/jpeg";
  return `data:${contentType};base64,${base64}`;
}

// Upload AI-produced image bytes to the user's avatar folder; return public URL + path.
async function uploadGeneratedAvatar(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  dataUrl: string,
): Promise<{ publicUrl: string; path: string }> {
  const { bytes, contentType } = dataUrlToBytes(dataUrl);
  const ext = contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] || "png";
  const path = `${userId}/avatar-ai.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return { publicUrl: pub.publicUrl, path };
}

// ─── AI: Enhance uploaded avatar into a professional headshot ─────────────────

export const enhanceAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) =>
    z.object({ path: z.string().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Guard: users may only enhance images inside their own folder.
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("You can only enhance your own profile picture");
    }
    const { enhanceImage } = await import("./avatar-ai.server");
    const sourceDataUrl = await storagePathToDataUrl(context.supabase, data.path);
    const enhancedDataUrl = await enhanceImage(sourceDataUrl);
    const { publicUrl, path } = await uploadGeneratedAvatar(
      context.supabase,
      context.userId,
      enhancedDataUrl,
    );
    return { publicUrl, path };
  });

// ─── AI: Generate a professional avatar from scratch (no photo) ───────────────

export const generateAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string; bio?: string }) =>
    z.object({ name: z.string().optional(), bio: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateImage } = await import("./avatar-ai.server");
    const generatedDataUrl = await generateImage(data.name, data.bio);
    const { publicUrl, path } = await uploadGeneratedAvatar(
      context.supabase,
      context.userId,
      generatedDataUrl,
    );
    return { publicUrl, path };
  });

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

export const listCustomHooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("custom_hooks")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as CustomHook[];
  });

export const upsertCustomHook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; content: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        content: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("custom_hooks")
        .update({ name: data.name, content: data.content })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("custom_hooks")
      .insert({ name: data.name, content: data.content, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomHook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("custom_hooks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Custom Strategies ────────────────────────────────────────────────────────

export const listCustomStrategies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("custom_strategies")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as CustomStrategy[];
  });

export const upsertCustomStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; content: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        content: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("custom_strategies")
        .update({ name: data.name, content: data.content })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("custom_strategies")
      .insert({ name: data.name, content: data.content, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("custom_strategies")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
