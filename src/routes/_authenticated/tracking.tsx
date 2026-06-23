import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, FileText, Mail, Check, Circle, CheckCircle2,
  Eye, MessageCircle, TrendingUp, RefreshCw,
} from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getTrackingData, updateScoutStatus, updateProposalFullStatus } from "@/lib/scout.functions";
import type { TrackingRow } from "@/lib/scout.functions";

export const Route = createFileRoute("/_authenticated/tracking")({
  component: TrackingPage,
});

type Filter = "all" | "proposal" | "scout";

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusPip({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
      active
        ? "border-teal/40 bg-teal/10 text-teal"
        : "border-white/10 bg-white/[0.03] text-white/30"
    )}>
      {active ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {label}
    </div>
  );
}

function TrackingCard({ row, onToggle }: { row: TrackingRow; onToggle: (field: string, val: boolean) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <CropCard className="overflow-hidden">
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          row.kind === "proposal" ? "bg-gold/10 text-gold" : "bg-teal/10 text-teal"
        )}>
          {row.kind === "proposal" ? <FileText className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
              row.kind === "proposal"
                ? "border-gold/30 bg-gold/10 text-gold"
                : "border-teal/30 bg-teal/10 text-teal"
            )}>
              {row.kind === "proposal" ? "Proposal" : "Scout"}
            </span>
            {row.job_type && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/50">
                {row.job_type}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{fmtDate(row.created_at)}</span>
          </div>
          <p className="text-sm text-white/80 line-clamp-2 leading-snug">{row.excerpt}</p>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusPip active={row.submitted} label="Submitted" />
            <StatusPip active={row.read_by_client} label="Read" />
            <StatusPip active={row.got_reply} label="Replied" />
            <StatusPip active={row.converted} label="Converted" />
          </div>
        </div>
      </div>

      {/* Expanded controls */}
      {open && (
        <div className="border-t border-border/40 p-4 space-y-3">
          {/* Mark status toggles */}
          <div>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">Update status</p>
            <div className="flex flex-wrap gap-2">
              {[
                { field: "submitted", label: "Submitted", active: row.submitted },
                { field: "read_by_client", label: "Read by client", active: row.read_by_client },
                { field: "got_reply", label: "Got reply", active: row.got_reply },
                { field: "converted", label: "Converted", active: row.converted },
              ].map(({ field, label, active }) => (
                <button
                  key={field}
                  onClick={() => onToggle(field, !active)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-teal/40 bg-teal/10 text-teal hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400"
                      : "border-white/20 bg-white/5 text-white/50 hover:border-teal/40 hover:text-teal"
                  )}
                >
                  {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {active ? `Unmark ${label}` : `Mark ${label}`}
                </button>
              ))}
            </div>
          </div>

          {/* Proposal-specific */}
          {row.kind === "proposal" && (row.hook || row.strategy || row.cta) && (
            <div className="text-[11px] text-white/50 space-y-0.5">
              {row.hook && <p><span className="text-white/30">Hook:</span> {row.hook}</p>}
              {row.strategy && <p><span className="text-white/30">Strategy:</span> {row.strategy}</p>}
              {row.cta && <p><span className="text-white/30">CTA:</span> {row.cta}</p>}
            </div>
          )}

          {/* Scout-specific */}
          {row.kind === "scout" && row.subject_line && (
            <div className="text-[11px] text-white/50">
              <p className="mb-1"><span className="text-white/30">Subject:</span> {row.subject_line}</p>
              {row.email_body && (
                <p className="line-clamp-3 text-white/40 italic">"{row.email_body.slice(0, 200)}…"</p>
              )}
            </div>
          )}
        </div>
      )}
    </CropCard>
  );
}

function TrackingPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const trackingQuery = useQuery({
    queryKey: ["tracking"],
    queryFn: () => getTrackingData(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, kind, field, value }: { id: string; kind: "proposal" | "scout"; field: string; value: boolean }) => {
      const patch = { id, [field]: value };
      return kind === "proposal"
        ? updateProposalFullStatus({ data: patch })
        : updateScoutStatus({ data: patch });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracking"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = trackingQuery.data ?? [];
  const filtered = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  // Stats
  const total = rows.length;
  const submitted = rows.filter((r) => r.submitted).length;
  const read = rows.filter((r) => r.read_by_client).length;
  const replied = rows.filter((r) => r.got_reply).length;
  const converted = rows.filter((r) => r.converted).length;

  const stat = (n: number, label: string, color: string) => (
    <div className={cn("rounded-xl border px-4 py-3 text-center", color)}>
      <p className="text-2xl font-bold">{n}</p>
      <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Tracking"
        title="Proposals & Scouting"
        description="Track every proposal and scout outreach — mark statuses, see what converts."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["tracking"] })}
            className="text-muted-foreground"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {stat(total, "Total", "border-white/10 bg-white/[0.03] text-white")}
        {stat(submitted, "Submitted", "border-gold/20 bg-gold/5 text-gold")}
        {stat(read, "Read", "border-blue-400/20 bg-blue-400/5 text-blue-400")}
        {stat(replied, "Replied", "border-teal/20 bg-teal/5 text-teal")}
        {stat(converted, "Converted", "border-green-400/20 bg-green-400/5 text-green-400")}
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-border/60 bg-sidebar/60 p-1 w-fit">
        {(["all", "proposal", "scout"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
              filter === f ? "bg-gold text-background shadow-sm" : "text-muted-foreground hover:text-white"
            )}
          >
            {f === "all" ? `All (${rows.length})` : f === "proposal" ? `Proposals (${rows.filter(r => r.kind === "proposal").length})` : `Scout (${rows.filter(r => r.kind === "scout").length})`}
          </button>
        ))}
      </div>

      {trackingQuery.isPending && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading tracking data…
        </div>
      )}

      {!trackingQuery.isPending && filtered.length === 0 && (
        <CropCard className="p-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "items" : filter + "s"} tracked yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Generate proposals or scout outreach — they'll appear here automatically.</p>
        </CropCard>
      )}

      <div className="space-y-3">
        {filtered.map((row) => (
          <TrackingCard
            key={`${row.kind}-${row.id}`}
            row={row}
            onToggle={(field, value) => updateMutation.mutate({ id: row.id, kind: row.kind, field, value })}
          />
        ))}
      </div>
    </div>
  );
}
