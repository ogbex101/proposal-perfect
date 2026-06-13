import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Extract a project ID from a Freelancer.com URL
// Supports formats like:
//   https://www.freelancer.com/projects/python/build-something/
//   https://www.freelancer.com/contest/...
//   project IDs can appear in URL or slug
export function extractFreelancerProjectId(url: string): number | null {
  // Try to match numeric ID in URL
  const numericMatch = url.match(/\/projects?\/[^/]+\/[^/]+\/(\d+)/);
  if (numericMatch) return parseInt(numericMatch[1]);

  // Try to find ID at end of URL path
  const endMatch = url.match(/\/(\d{5,})\/?(?:\?|$|#)/);
  if (endMatch) return parseInt(endMatch[1]);

  return null;
}

// Look up a Freelancer project by URL (fetches project details including ID)
export const lookupFreelancerProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectUrl: string }) =>
    z.object({ projectUrl: z.string().url().max(500) }).parse(d)
  )
  .handler(async ({ data }) => {
    const token = process.env.FREELANCER_TOKEN;
    if (!token) throw new Error("Freelancer token not configured. Add FREELANCER_TOKEN in Lovable Cloud → Settings → Secrets.");

    // Try to extract project ID from URL
    const directId = extractFreelancerProjectId(data.projectUrl);

    // Fetch project details from the Freelancer API using the project slug or ID
    // The API accepts project IDs via query or slug-based lookup
    const url = directId
      ? `https://www.freelancer.com/api/projects/0.1/projects/${directId}/`
      : `https://www.freelancer.com/api/projects/0.1/projects/?query=${encodeURIComponent(data.projectUrl)}&limit=1`;

    const res = await fetch(url, {
      headers: {
        "freelancer-oauth-v1": token,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("Invalid Freelancer token. Check your FREELANCER_TOKEN environment variable.");
      if (res.status === 404) throw new Error("Project not found. Make sure the URL is correct.");
      throw new Error(`Freelancer API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const project = directId ? json.result : json.result?.projects?.[0];
    if (!project) throw new Error("Could not find project. Try pasting just the project ID instead of the URL.");

    return {
      id: project.id as number,
      title: (project.title ?? "Untitled Project") as string,
      description: (project.description ?? "") as string,
      budget: {
        minimum: project.budget?.minimum as number | undefined,
        maximum: project.budget?.maximum as number | undefined,
      },
      currency: (project.currency?.code ?? "USD") as string,
    };
  });

export const submitFreelancerBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: number; proposalText: string; bidAmount: number; deliveryDays: number }) =>
    z.object({
      projectId: z.number().int().positive(),
      proposalText: z.string().min(50).max(5000),
      bidAmount: z.number().positive(),
      deliveryDays: z.number().int().min(1).max(365),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const token = process.env.FREELANCER_TOKEN;
    if (!token) throw new Error("Freelancer token not configured. Add FREELANCER_TOKEN in Lovable Cloud → Settings → Secrets.");

    const payload = {
      project_id: data.projectId,
      amount: data.bidAmount,
      period: data.deliveryDays,
      description: data.proposalText,
      milestone_percentage: 100,
    };

    const res = await fetch("https://www.freelancer.com/api/projects/0.1/bids/", {
      method: "POST",
      headers: {
        "freelancer-oauth-v1": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { message?: string; error?: { message?: string } })?.message ?? (body as { message?: string; error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401) throw new Error("Invalid Freelancer token. Go to Settings → Integrations to update it.");
      if (res.status === 403) throw new Error("You don't have permission to bid on this project. You may have already bid, or the project is closed.");
      throw new Error(`Bid failed: ${msg}`);
    }

    const json = await res.json();
    return {
      bidId: (json as { result?: { id?: number } }).result?.id as number,
      status: "submitted",
    };
  });
