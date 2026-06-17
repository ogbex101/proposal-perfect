import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  deleteSnippet,
  listSnippets,
  upsertSnippet,
  type ProposalSnippet,
} from "@/lib/proposal-snippets.functions";
import { cn } from "@/lib/utils";

interface Props {
  onInsert: (text: string) => void;
}

const CATEGORIES = ["intro", "value", "pricing", "cta", "closing", "general"] as const;

export function SnippetsPanel({ onInsert }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProposalSnippet | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("general");

  const snippetsQuery = useQuery({ queryKey: ["proposal-snippets"], queryFn: () => listSnippets() });
  const snippets = snippetsQuery.data ?? [];

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertSnippet({ data: { id: editing?.id, title, body, category } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-snippets"] });
      setOpen(false);
      setEditing(null);
      setTitle("");
      setBody("");
      setCategory("general");
      toast.success(editing ? "Snippet updated" : "Snippet saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSnippet({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposal-snippets"] });
      toast.success("Snippet deleted");
    },
  });

  function startEdit(s: ProposalSnippet) {
    setEditing(s);
    setTitle(s.title);
    setBody(s.body);
    setCategory(s.category);
    setOpen(true);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Snippets</p>
          <p className="text-[11px] text-muted-foreground">Click to insert. Save anything you use often.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setTitle(""); setBody(""); setCategory("general"); } }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-[11px]">
              <Plus className="mr-1 h-3 w-3" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit snippet" : "New snippet"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Warm intro for SaaS clients" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] capitalize",
                        category === c ? "border-teal/50 bg-teal/10 text-teal" : "border-border text-muted-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="The text to insert. You can use multiple paragraphs."
                />
              </div>
              <Button
                disabled={!title.trim() || !body.trim() || upsertMutation.isPending}
                onClick={() => upsertMutation.mutate()}
                className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
              >
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save snippet"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {snippetsQuery.isLoading ? (
        <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : snippets.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No snippets yet. Save reusable intros, pricing blocks, or CTAs to insert with one click.
        </p>
      ) : (
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
          {snippets.map((s) => (
            <div
              key={s.id}
              className="group rounded-md border border-border/40 bg-background/40 px-2.5 py-2 hover:border-teal/40"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => { onInsert(s.body); toast.success(`Inserted "${s.title}"`); }}
                  className="flex-1 truncate text-left text-xs font-medium text-white hover:text-teal"
                  title={s.body}
                >
                  <Sparkles className="mr-1 inline h-2.5 w-2.5 text-teal" />
                  {s.title}
                </button>
                <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[9px] capitalize text-muted-foreground">{s.category}</span>
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
