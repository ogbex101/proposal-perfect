import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireOwnedThread(supabase: any, threadId: string, userId: string) {
  const { data, error } = await supabase
    .from("conversion_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Conversation not found or access denied.");
}

// ── Threads ──────────────────────────────────────────────────────────────────

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("conversion_threads")
      .select("id, title, job_description, sent_proposal, stage, context_dump, extracted, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title?: string; job_description?: string; sent_proposal?: string }) =>
    z.object({
      title: z.string().max(200).default("Untitled conversation"),
      job_description: z.string().max(10000).default(""),
      sent_proposal: z.string().max(10000).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("conversion_threads")
      .insert({
        user_id: context.userId,
        title: data.title,
        job_description: data.job_description,
        sent_proposal: data.sent_proposal,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title?: string; job_description?: string; sent_proposal?: string; stage?: number; context_dump?: string; extracted?: Record<string, unknown> }) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().max(200).optional(),
      job_description: z.string().max(10000).optional(),
      sent_proposal: z.string().max(10000).optional(),
      stage: z.number().int().min(1).max(4).optional(),
      context_dump: z.string().max(20000).optional(),
      extracted: z.record(z.unknown()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const { data: row, error } = await (context.supabase as any)
      .from("conversion_threads")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("conversion_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Thread messages ──────────────────────────────────────────────────────────

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireOwnedThread(context.supabase, data.threadId, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("conversion_thread_messages")
      .select("id, thread_id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; role: "client" | "you"; content: string }) =>
    z.object({
      threadId: z.string().uuid(),
      role: z.enum(["client", "you"]),
      content: z.string().min(1).max(10000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireOwnedThread(context.supabase, data.threadId, context.userId);
    const { data: row, error } = await (context.supabase as any)
      .from("conversion_thread_messages")
      .insert({ thread_id: data.threadId, role: data.role, content: data.content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Bump thread updated_at
    await (context.supabase as any)
      .from("conversion_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    return row;
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: message, error: lookupError } = await (context.supabase as any)
      .from("conversion_thread_messages")
      .select("thread_id")
      .eq("id", data.id)
      .maybeSingle();
    if (lookupError || !message) throw new Error("Message not found or access denied.");
    await requireOwnedThread(context.supabase, message.thread_id, context.userId);
    const { error } = await (context.supabase as any)
      .from("conversion_thread_messages")
      .delete()
      .eq("id", data.id)
      .eq("thread_id", message.thread_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Legacy (keep for backward compat) ────────────────────────────────────────

export const listConversions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("conversion_messages")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return data ?? [];
  });

export const saveConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { input: string; outputs: string[] }) =>
    z.object({ input: z.string().min(1).max(5000), outputs: z.array(z.string()).default([]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversion_messages")
      .insert({ user_id: context.userId, input: data.input, outputs: data.outputs } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversion_messages")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
