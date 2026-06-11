import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History as HistoryIcon,
  FileText,
  Copy,
  FileDown,
  Trash2,
  Loader2,
  PenLine,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
import {
  listProposals,
  getProposal,
  deleteProposal,
} from "@/lib/proposals.functions";
import { copyText, downloadTxt, downloadPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/history")({
  validateSearch: (search: Record<string, unknown>): { open?: string } => ({
    open: typeof search.open === "string" ? search.open : undefined,
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  title: string | null;
  job_description: string;
  length: string;
  content: string;
  created_at: string;
};

function HistoryPage() {
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const { open } = Route.useSearch();

  const { data, isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => listProposals(),
  });
  const rows = (data ?? []) as Row[];

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(open ?? null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  // Sync the ?open= param from dashboard/recent links into local state once loaded.
  useEffect(() => {
    if (open) setOpenId(open);
  }, [open]);

  const detail = useQuery({
    queryKey: ["proposal", openId],
    queryFn: () => getProposal({ data: { id: openId as string } }),
    enabled: !!openId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProposal({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setToDelete(null);
      toast.success("Proposal deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  const closeViewer = () => {
    setOpenId(null);
    if (open) navigate({ search: {}, replace: true });
  };

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const hay = `${r.title ?? ""} ${r.job_description}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const label = (r: Row) =>
    r.title?.trim() || r.job_description.slice(0, 64).trim() || "Untitled proposal";

  const active = detail.data as
    | (Row & { content: string })
    | undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Archive"
        title="Proposal History"
        description="Every proposal you've generated. Reopen one to read, export, or reuse it."
        action={
          <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
            <Link to="/new">
              <PenLine className="mr-1.5 h-4 w-4" /> New proposal
            </Link>
          </Button>
        }
      />

      {rows.length > 0 && (
        <div className="mb-5 max-w-sm">
          <Input
            placeholder="Search by title or job text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="Once you generate proposals they'll be archived here for editing and re-export."
          action={
            <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
              <Link to="/new">
                <PenLine className="mr-1.5 h-4 w-4" /> Draft one now
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <CropCard
              key={r.id}
              className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-teal/40"
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpenId(r.id)}
              >
                <p className="truncate text-sm font-medium text-white">{label(r)}</p>
                <p className="annotation mt-0.5 !text-muted-foreground">
                  {r.length} · {new Date(r.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-white"
                  title="Copy"
                  onClick={async () => {
                    await copyText(r.content);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-white"
                  title="Download PDF"
                  onClick={() => downloadPdf(label(r), r.content)}
                >
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Delete"
                  onClick={() => setToDelete(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CropCard>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No proposals match “{query}”.
            </p>
          )}
        </div>
      )}

      {/* Viewer */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && closeViewer()}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-line/60 px-6 py-4">
            <DialogTitle className="pr-6">
              {active ? label(active) : "Proposal"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
            {detail.isLoading || !active ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <Eyebrow index={active.length}>archived draft</Eyebrow>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {active.content || "This proposal has no saved body."}
                </pre>
              </>
            )}
          </div>

          {active && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-6 py-4">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await copyText(active.content);
                  toast.success("Copied to clipboard");
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadTxt(label(active), active.content)}
              >
                <FileText className="mr-1.5 h-4 w-4" /> .txt
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadPdf(label(active), active.content)}
              >
                <FileDown className="mr-1.5 h-4 w-4" /> PDF
              </Button>
              <Button
                size="sm"
                className="ml-auto bg-gold text-primary-foreground hover:bg-gold-bright"
                onClick={closeViewer}
              >
                <X className="mr-1.5 h-4 w-4" /> Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete ? label(toDelete) : ""}” will be permanently removed from your history.
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
