// Shared, pure portfolio↔job matching (client- and server-safe).
//
// Word-boundary aware so "react" never matches inside "reaction"/"overreact", and a
// multi-word tag ("ai video") must appear as a contiguous whole-word phrase. A "strong"
// match requires a multi-word tag hit OR >=2 distinct single-word hits — one generic
// single-word coincidence is never enough — and a lone short (<=5 char) single-word hit
// (ai/ui/seo) is treated as no match.

import { escapeRegExp } from "./utils";

export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

export function tagHitsInBlob(tags: string[], blob: string): string[] {
  const b = normalizeForMatch(blob);
  return tags.filter((tag) => {
    const t = normalizeForMatch(tag);
    if (!t) return false;
    return new RegExp(`\\b${escapeRegExp(t)}\\b`).test(b);
  });
}

export type PortfolioTaggable = { id: string; title: string; niche_tags?: string[] | null; niche?: string | null };
export type PortfolioMatchItem = {
  id: string;
  title: string;
  matchedTags: string[];
  score: number;
  multiWordHits: number;
  distinctSingle: number;
};

/** Score every item, then return only the "strong" matches, best first. */
export function scorePortfolioMatches(items: PortfolioTaggable[], blob: string): PortfolioMatchItem[] {
  const scored = items.map((p) => {
    const tags = [...(p.niche_tags ?? []), p.niche].filter(Boolean) as string[];
    const hits = tagHitsInBlob(tags, blob);
    const multiWordHits = hits.filter((t) => normalizeForMatch(t).includes(" ")).length;
    const distinctSingle = new Set(
      hits.filter((t) => !normalizeForMatch(t).includes(" ")).map(normalizeForMatch),
    ).size;
    return { id: p.id, title: p.title, matchedTags: hits, score: hits.length, multiWordHits, distinctSingle };
  });

  return scored
    .filter((s) => {
      const strong = s.multiWordHits >= 1 || s.distinctSingle >= 2;
      if (!strong) return false;
      // Reject a lone short single-word coincidence (ai/ui/seo).
      const weakCoincidence =
        s.score === 1 && s.multiWordHits === 0 &&
        s.matchedTags.every((t) => normalizeForMatch(t).replace(/\s/g, "").length <= 5);
      return !weakCoincidence;
    })
    .sort((a, b) => b.score - a.score);
}

export function matchConfidence(score: number): "High" | "Medium" | "Low" {
  return score >= 3 ? "High" : score === 2 ? "Medium" : "Low";
}
