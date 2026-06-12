import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Star,
  Trash2,
  Loader2,
  Copy,
  Anchor,
  Compass,
  Briefcase,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { HOOKS, STRATEGIES } from "@/lib/proposal-constants";
import { listSaved, saveItem, deleteSaved } from "@/lib/saved.functions";
import { copyText } from "@/lib/export";
import { listGeneratedPortfolios } from "@/lib/portfolio-generate.functions";

export const Route = createFileRoute("/_authenticated/saved")({
  component: SavedPage,
});

type Saved = {
  id: string;
  kind: "hook" | "strategy" | "portfolio" | "proposal";
  ref_id: string | null;
  snapshot: any;
  created_at: string;
};

const KIND_META: Record<
  Saved["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  hook: { label: "Hook", icon: Anchor },
  strategy: { label: "Strategy", icon: Compass },
  portfolio: { label: "Portfolio", icon: Briefcase },
  proposal: { label: "Template", icon: FileText },
};

function SavedPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: () => listSaved(),
  });
  const saved = (data ?? []) as Saved[];

  const portfoliosQuery = useQuery({ queryKey: ["generated-portfolios"], queryFn: () => listGeneratedPortfolios() });

  const [viewing, setViewing] = useState<Saved | null>(null);

  const favHooks = useMemo(
    () => new Set(saved.filter((s) => s.kind === "hook").map((s) => s.ref_id)),
    [saved],
  );
  const favStrategies = useMemo(
    () => new Set(saved.filter((s) => s.kind === "strategy").map((s) => s.ref_id)),
    [saved],
  );
  const savedByRef = useMemo(() => {
    const m = new Map<string, Saved>();
    for (const s of saved) if (s.ref_id) m.set(`${s.kind}:${s.ref_id}`, s);
    return m;
  }, [saved]);

  const add = useMutation({
    mutationFn: (v: { kind: Saved["kind"]; ref_id: string; snapshot: unknown }) =>
      saveItem({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSaved({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved"] }),
    onError: (e: Error) => toast.error(e.message || "Could not remove"),
  });

  const toggleHook = (h: (typeof HOOKS)[number]) => {
    const existing = savedByRef.get(`hook:${h.id}`);
    if (existing) remove.mutate(existing.id);
    else add.mutate({ kind: "hook", ref_id: h.id, snapshot: h });
  };
  const toggleStrategy = (s: (typeof STRATEGIES)[number]) => {
    const existing = savedByRef.get(`strategy:${s.id}`);
    if (existing) remove.mutate(existing.id);
    else add.mutate({ kind: "strategy", ref_id: s.id, snapshot: s });
  };

  const snapshotTitle = (s: Saved) => {
    const snap = s.snapshot ?? {};
    return snap.name || snap.title || snap.hook || "Saved item";
  };
  const snapshotBody = (s: Saved) => {
    const snap = s.snapshot ?? {};
    return snap.description || snap.content || snap.url || "";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Quick access"
        title="Saved Items"
        description="Favorite the hooks and strategies you reach for most, and keep proposal templates one click away."
      />

      <Tabs defaultValue="library">
        <TabsList className="mb-6">
          <TabsTrigger value="library">Saved library</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="portfolios">Portfolios</TabsTrigger>
        </TabsList>

        {/* Saved library */}
        <TabsContent value="library">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : saved.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              description="Star hooks and strategies in the other tabs, or save a proposal as a template from the generator."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {saved.map((s) => {
                const Meta = KIND_META[s.kind] ?? KIND_META.proposal;
                return (
                  <CropCard key={s.id} className="flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Eyebrow>
                        <Meta.icon className="mr-1 inline h-3 w-3" />
                        {Meta.label}
                      </Eyebrow>
                      <button
                        aria-label="Remove"
                        onClick={() => remove.mutate(s.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="mt-2 truncate font-medium text-white">
                      {snapshotTitle(s)}
                    </h3>
                    {snapshotBody(s) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {snapshotBody(s)}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2 border-t border-line/60 pt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-muted-foreground hover:text-white"
                        onClick={() => setViewing(s)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-muted-foreground hover:text-white"
                        onClick={async () => {
                          await copyText(snapshotBody(s) || snapshotTitle(s));
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                  </CropCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Hooks */}
        <TabsContent value="hooks">
          <div className="grid gap-3 md:grid-cols-2">
            {HOOKS.map((h) => {
              const fav = favHooks.has(h.id);
              return (
                <CropCard
                  key={h.id}
                  glow={fav ? "gold" : "teal"}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <div>
                    <h3 className="font-medium text-white">{h.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>
                  </div>
                  <button
                    aria-label="Favorite hook"
                    onClick={() => toggleHook(h)}
                    className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-white/5"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        fav ? "fill-gold text-gold" : "text-muted-foreground",
                      )}
                    />
                  </button>
                </CropCard>
              );
            })}
          </div>
        </TabsContent>

        {/* Strategies */}
        <TabsContent value="strategies">
          <div className="grid gap-3 md:grid-cols-2">
            {STRATEGIES.map((s) => {
              const fav = favStrategies.has(s.id);
              return (
                <CropCard
                  key={s.id}
                  glow={fav ? "gold" : "teal"}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <div>
                    <h3 className="font-medium text-white">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  </div>
                  <button
                    aria-label="Favorite strategy"
                    onClick={() => toggleStrategy(s)}
                    className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-white/5"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        fav ? "fill-gold text-gold" : "text-muted-foreground",
                      )}
                    />
                  </button>
                </CropCard>
              );
            })}
          </div>
        </TabsContent>
        {/* Portfolios */}
        <TabsContent value="portfolios">
          {portfoliosQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (portfoliosQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No generated portfolios yet"
              description="Generate a portfolio from the New Proposal page to see it here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(portfoliosQuery.data ?? []).map((p) => (
                <CropCard key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-white">{p.title}</h3>
                      {p.niche && (
                        <span className="mt-1 inline-block rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 font-mono text-[10px] text-teal">
                          {p.niche}
                        </span>
                      )}
                      <p className="annotation mt-1 !text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-md border border-line/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-teal/40 hover:text-teal"
                    >
                      View →
                    </a>
                  </div>
                </CropCard>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing ? snapshotTitle(viewing) : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
              {viewing ? snapshotBody(viewing) || "No additional detail saved." : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
