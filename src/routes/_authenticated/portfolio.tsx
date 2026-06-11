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
} from "@/lib/portfolio.functions";

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
  created_at: string;
};

type Draft = {
  id?: string;
  title: string;
  url: string;
  description: string;
  is_primary: boolean;
  is_favorite: boolean;
};

const EMPTY: Draft = {
  title: "",
  url: "",
  description: "",
  is_primary: false,
  is_favorite: false,
};

function PortfolioPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => listPortfolio(),
  });
  const items = (data ?? []) as Item[];

  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Item | null>(null);

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
      ...patch,
    });

  return (
    <div>
      <PageHeader
        eyebrow="Asset library"
        title="Portfolio Manager"
        description="Curate the work you cite in proposals. Primary entries are suggested first; favorites surface for quick access."
        action={
          <Button
            className="bg-gold text-primary-foreground hover:bg-gold-bright"
            onClick={() => setDraft({ ...EMPTY })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add entry
          </Button>
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
    </div>
  );
}
