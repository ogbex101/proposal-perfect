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

// ─── AI: Enhance avatar description (generate enhanced avatar via AI) ─────────

export const generateAiAvatarPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string; bio?: string }) =>
    z.object({ name: z.string().optional(), bio: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    // Returns a polished image-generation prompt the client can use
    // with an image service of choice (e.g. Replicate, fal.ai, etc.)
    const name = data.name ?? "a professional freelancer";
    const bio = data.bio ?? "";
    const prompt = [
      `Professional LinkedIn-style headshot portrait of ${name}.`,
      bio ? `Context: ${bio.slice(0, 120)}.` : "",
      "Studio lighting, neutral background, business casual attire,",
      "sharp focus, high resolution, photorealistic.",
    ]
      .filter(Boolean)
      .join(" ");
    return { prompt };
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
