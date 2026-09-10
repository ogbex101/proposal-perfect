import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Plus,
  Star,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Pin,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  listPortfolio,
  upsertPortfolio,
  deletePortfolio,
  seedFaithPortfolios,
} from "@/lib/portfolio.functions";
import { listGeneratedPortfolios } from "@/lib/portfolio-generate.functions";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioPage,
});

type Item = {
  id: string;
  title: string;
  url: string;
  description: string;
  is_primary: boolean;
  is_favorite: boolean;
  niche_tags?: string[] | null;
  created_at: string;
};

type Draft = {
  id?: string;
  title: string;
  url: string;
  description: string;
  is_primary: boolean;
  is_favorite: boolean;
  niche_tags: string[];
};

const EMPTY: Draft = {
  title: "",
  url: "",
  description: "",
  is_primary: false,
  is_favorite: false,
  niche_tags: [],
};

// Common skill/niche tags offered as quick-add chips. Users can also type any freeform tag.
const SUGGESTED_TAGS = [
  "Email Marketing", "Klaviyo", "AI Video", "Motion Graphics", "Social Media Management",
  "VA/Admin", "Lead Generation", "Web Development", "Full-Stack", "React", "Landing Page",
  "Copywriting", "Content Writing", "SEO", "Shopify", "Webflow", "Automation", "UI Design",
];

function PortfolioPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => listPortfolio(),
  });
  const items = (data ?? []) as Item[];

  const [draft, setDraft] = useState<Draft | null>(null);
  const [tagInput, setTagInput] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || !draft) return;
    if (draft.niche_tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    setDraft({ ...draft, niche_tags: [...draft.niche_tags, tag] });
    setTagInput("");
  }
  function removeTag(tag: string) {
    if (!draft) return;
    setDraft({ ...draft, niche_tags: draft.niche_tags.filter((t) => t !== tag) });
  }
  const [toDelete, setToDelete] = useState<Item | null>(null);

  const seed = useMutation({
    mutationFn: () => seedFaithPortfolios(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      const r = result as { seeded: number; skipped: number };
      if (r.seeded > 0) {
        toast.success(`Added ${r.seeded} niche portfolio${r.seeded > 1 ? "s" : ""}${r.skipped > 0 ? ` (${r.skipped} already existed)` : ""}`);
      } else {
        toast.info("All niche portfolios already exist");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Could not seed portfolios"),
  });

  const save = useMutation({
    mutationFn: (d: Draft) => upsertPortfolio({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setDraft(null);
      toast.success("Portfolio saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePortfolio({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setToDelete(null);
      toast.success("Entry removed");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  const quickPatch = (item: Item, patch: Partial<Draft>) =>
    save.mutate({
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      is_primary: item.is_primary,
      is_favorite: item.is_favorite,
      niche_tags: item.niche_tags ?? [],
      ...patch,
    });

  return (
    <div>
      <PageHeader
        eyebrow="Asset library"
        title="Portfolio Manager"
        description="Curate the work you cite in proposals. Primary entries are suggested first; favorites surface for quick access."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-teal/40 text-teal hover:bg-teal/10"
              disabled={seed.isPending}
              onClick={() => seed.mutate()}
            >
              {seed.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Seed niche portfolios
            </Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold-bright"
              onClick={() => setDraft({ ...EMPTY })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add entry
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading portfolio…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No portfolio entries yet"
          description="Add the projects you want to reference when pitching. Each one needs a title, a live link, and a short description of the work and stack."
          action={
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold-bright"
              onClick={() => setDraft({ ...EMPTY })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add your first entry
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <CropCard
              key={item.id}
              glow={item.is_primary ? "gold" : "teal"}
              className="flex flex-col p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    {item.is_primary && (
                      <span className="annotation rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 !text-gold">
                        primary
                      </span>
                    )}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-teal hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{item.url}</span>
                  </a>
                </div>
                <button
                  aria-label="Toggle favorite"
                  onClick={() => quickPatch(item, { is_favorite: !item.is_favorite })}
                  className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-white/5"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      item.is_favorite
                        ? "fill-gold text-gold"
                        : "text-muted-foreground",
                    )}
                  />
                </button>
              </div>

              {item.description && (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}

              {((item as any).niche_tags ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {((item as any).niche_tags as string[]).slice(0, 6).map((t) => (
                    <span key={t} className="rounded-full border border-teal/20 bg-teal/5 px-2 py-0.5 text-[10px] text-teal/90">{t}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-1.5 border-t border-line/60 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-white"
                  onClick={() => quickPatch(item, { is_primary: !item.is_primary })}
                >
                  <Pin
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      item.is_primary && "text-gold",
                    )}
                  />
                  {item.is_primary ? "Unset primary" : "Set primary"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-white"
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      title: item.title,
                      url: item.url,
                      description: item.description,
                      is_primary: item.is_primary,
                      is_favorite: item.is_favorite,
                      niche_tags: (item as any).niche_tags ?? [],
                    })
                  }
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setToDelete(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CropCard>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit entry" : "Add portfolio entry"}</DialogTitle>
            <DialogDescription>
              A clear title, a live URL, and a short note on what you built and the stack.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-title">Title</Label>
                <Input
                  id="pf-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="JobCondi Marketplace"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-url">Live URL</Label>
                <Input
                  id="pf-url"
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-desc">Description</Label>
                <Textarea
                  id="pf-desc"
                  rows={4}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="A two-sided marketplace built with Next.js, Supabase, and Stripe Connect…"
                />
              </div>
              {/* Fix 9 — niche/skill tags for auto-matching to jobs */}
              <div className="space-y-1.5">
                <Label>Skill / niche tags</Label>
                <p className="text-[11px] text-muted-foreground">Used to auto-match this portfolio to jobs. Add your own or pick from suggestions.</p>
                {draft.niche_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.niche_tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-xs text-teal">
                        {t}
                        <button onClick={() => removeTag(t)} className="hover:text-white" aria-label={`Remove ${t}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                    placeholder="Type a tag and press Enter (e.g. Klaviyo)"
                  />
                  <Button variant="outline" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTED_TAGS.filter((s) => !draft.niche_tags.some((t) => t.toLowerCase() === s.toLowerCase())).slice(0, 12).map((s) => (
                    <button key={s} onClick={() => addTag(s)} className="rounded-full border border-line/60 bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-teal/40 hover:text-teal">
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={draft.is_primary}
                    onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
                  />
                  Primary
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={draft.is_favorite}
                    onChange={(e) => setDraft({ ...draft, is_favorite: e.target.checked })}
                  />
                  Favorite
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-primary-foreground hover:bg-gold-bright"
              disabled={save.isPending || !draft?.title || !draft?.url}
              onClick={() => draft && save.mutate(draft)}
            >
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the portfolio entry permanently. Proposals already generated keep their text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GeneratedPortfoliosSection />
    </div>
  );
}

function GeneratedPortfoliosSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["generated-portfolios"],
    queryFn: () => listGeneratedPortfolios(),
  });
  const portfolios = data ?? [];
  const [filter, setFilter] = useState<string>("all");

  if (isLoading) return null;
  if (portfolios.length === 0) return null;

  // Group by niche
  const byNiche = new Map<string, typeof portfolios>();
  for (const p of portfolios) {
    const key = p.niche?.trim() || "Uncategorized";
    if (!byNiche.has(key)) byNiche.set(key, []);
    byNiche.get(key)!.push(p);
  }
  const niches = [...byNiche.keys()];

  const filtered = filter === "all"
    ? portfolios
    : portfolios.filter((p) => (p.niche || "Uncategorized") === filter);

  const filteredByNiche = new Map<string, typeof portfolios>();
  for (const p of filtered) {
    const key = p.niche?.trim() || "Uncategorized";
    if (!filteredByNiche.has(key)) filteredByNiche.set(key, []);
    filteredByNiche.get(key)!.push(p);
  }

  return (
    <div className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Eyebrow>Generated portfolios</Eyebrow>
          <p className="annotation mt-1 !text-muted-foreground">AI-generated portfolios, organized by niche.</p>
        </div>
      </div>

      {/* Niche filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            filter === "all"
              ? "border-gold/60 bg-gold/10 text-gold"
              : "border-line/60 text-muted-foreground hover:border-teal/40 hover:text-white"
          )}
        >
          All ({portfolios.length})
        </button>
        {niches.map((n) => (
          <button
            key={n}
            onClick={() => setFilter(n)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === n
                ? "border-teal/60 bg-teal/10 text-teal"
                : "border-line/60 text-muted-foreground hover:border-teal/40 hover:text-white"
            )}
          >
            {n} ({byNiche.get(n)!.length})
          </button>
        ))}
      </div>

      {/* Grouped list */}
      <div className="space-y-8">
        {[...filteredByNiche.entries()].map(([niche, items]) => (
          <div key={niche}>
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-teal" />
              <h3 className="text-sm font-semibold text-white">{niche}</h3>
              <span className="font-mono text-[10px] text-muted-foreground">({items.length})</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <CropCard key={p.id} className="p-4">
                  <h4 className="truncate text-sm font-medium text-white">{p.title}</h4>
                  <p className="annotation mt-1 !text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-teal hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> View portfolio
                  </a>
                </CropCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
