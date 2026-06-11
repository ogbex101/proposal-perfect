import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  .inputValidator(
    (d: {
      name?: string | null;
      default_length?: "brief" | "robust" | "explanatory";
      default_plan?: boolean;
    }) =>
      z
        .object({
          name: z.string().max(120).nullable().optional(),
          default_length: z.enum(["brief", "robust", "explanatory"]).optional(),
          default_plan: z.boolean().optional(),
        })
        .parse(d),
  )
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
