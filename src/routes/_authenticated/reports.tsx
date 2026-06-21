import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download, FileText, Mail, CheckCircle2, Circle, Filter } from "lucide-react";
import { PageHeader, CropCard } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getTrackingData } from "@/lib/scout.functions";
import type { TrackingRow } from "@/lib/scout.functions";

// @ts-expect-error — route registered at runtime
export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type TypeFilter = "all" | "proposal" | "scout";
type DateFilter = "today" | "3days" | "week" | "month" | "custom";

function dayStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function filterByDate(rows: TrackingRow[], dateFilter: DateFilter, customFrom: string, customTo: string): TrackingRow[] {
  const now = new Date();
  if (dateFilter === "custom") {
    const from = customFrom ? new Date(customFrom) : null;
    const to = customTo ? new Date(customTo + "T23:59:59") : null;
    return rows.filter((r) => {
      const d = new Date(r.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  const cutoff = new Date(now);
  if (dateFilter === "today") cutoff.setTime(dayStart(now).getTime());
  else if (dateFilter === "3days") cutoff.setDate(now.getDate() - 3);
  else if (dateFilter === "week") cutoff.setDate(now.getDate() - 7);
  else if (dateFilter === "month") cutoff.setDate(now.getDate() - 30);
  return rows.filter((r) => new Date(r.created_at) >= cutoff);
}

function Check({ on }: { on: boolean }) {
  return on
    ? <CheckCircle2 className="h-4 w-4 text-teal mx-auto" />
    : <Circle className="h-4 w-4 text-white/20 mx-auto" />;
}

function exportCsv(rows: TrackingRow[], typeFilter: TypeFilter) {
  const includeProposal = typeFilter !== "scout";
  const includeScout = typeFilter !== "proposal";

  const headers = [
    "Date", "Type", "Description",
    ...(includeProposal ? ["Analyzed", "Generated", "Hook", "Strategy", "CTA"] : []),
    ...(includeScout ? ["Subject Line", "Email Preview"] : []),
    "Submitted", "Read by Client", "Got Reply", "Converted",
  ];

  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

  const dataRows = rows.map((r) => [
    new Date(r.created_at).toISOString().slice(0, 10),
    r.kind,
    r.excerpt,
    ...(includeProposal ? [
      r.analyzed ? "Yes" : "No",
      r.generated ? "Yes" : "No",
      r.hook ?? "",
      r.strategy ?? "",
      r.cta ?? "",
    ] : []),
    ...(includeScout ? [
      r.subject_line ?? "",
      (r.email_body ?? "").slice(0, 100),
    ] : []),
    r.submitted ? "Yes" : "No",
    r.read_by_client ? "Yes" : "No",
    r.got_reply ? "Yes" : "No",
    r.converted ? "Yes" : "No",
  ].map((v) => escape(String(v ?? ""))));

  const csv = [headers.map(escape).join(","), ...dataRows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `xperience-props-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", color)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function ReportsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const trackingQuery = useQuery({
    queryKey: ["tracking"],
    queryFn: () => getTrackingData(),
  });

  const allRows = trackingQuery.data ?? [];

  const filtered = useMemo(() => {
    let rows = allRows;
    if (typeFilter !== "all") rows = rows.filter((r) => r.kind === typeFilter);
    rows = filterByDate(rows, dateFilter, customFrom, customTo);
    return rows;
  }, [allRows, typeFilter, dateFilter, customFrom, customTo]);

  // Stats
  const total = filtered.length;
  const submitted = filtered.filter((r) => r.submitted).length;
  const read = filtered.filter((r) => r.read_by_client).length;
  const replied = filtered.filter((r) => r.got_reply).length;
  const converted = filtered.filter((r) => r.converted).length;
  const submitRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const readRate = submitted > 0 ? Math.round((read / submitted) * 100) : 0;
  const replyRate = read > 0 ? Math.round((replied / read) * 100) : 0;
  const convRate = replied > 0 ? Math.round((converted / replied) * 100) : 0;

  // Per-hook stats with Bayesian rate: (conversions + 1) / (uses + 2)
  const hookStats = useMemo(() => {
    const map: Record<string, { total: number; converted: number }> = {};
    filtered.filter((r) => r.kind === "proposal" && r.hook).forEach((r) => {
      const h = r.hook!;
      if (!map[h]) map[h] = { total: 0, converted: 0 };
      map[h].total++;
      if (r.converted) map[h].converted++;
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        id,
        ...v,
        bayesianRate: Math.round(((v.converted + 1) / (v.total + 2)) * 100),
      }))
      .sort((a, b) => b.bayesianRate - a.bayesianRate)
      .slice(0, 5);
  }, [filtered]);

  // Win patterns: hook × strategy × CTA combos with ≥4 uses (Phase 2.3)
  const winPatterns = useMemo(() => {
    const map: Record<string, { hook: string; strategy: string; cta: string; total: number; converted: number }> = {};
    allRows.filter((r) => r.kind === "proposal" && r.hook && r.strategy && r.cta).forEach((r) => {
      const key = `${r.hook}|${r.strategy}|${r.cta}`;
      if (!map[key]) map[key] = { hook: r.hook!, strategy: r.strategy!, cta: r.cta!, total: 0, converted: 0 };
      map[key].total++;
      if (r.converted) map[key].converted++;
    });
    return Object.values(map)
      .filter((v) => v.total >= 4)
      .map((v) => ({ ...v, bayesianRate: Math.round(((v.converted + 1) / (v.total + 2)) * 100) }))
      .sort((a, b) => b.bayesianRate - a.bayesianRate)
      .slice(0, 8);
  }, [allRows]);

  const showProposalCols = typeFilter !== "scout";
  const showScoutCols = typeFilter !== "proposal";

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Performance Report"
        description="Track what's getting reads, replies, and conversions — filter by date and type."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(filtered, typeFilter)}
            disabled={filtered.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <div className="flex gap-1 rounded-xl border border-border/60 bg-sidebar/60 p-1">
          {(["all", "proposal", "scout"] as TypeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all",
                typeFilter === f ? "bg-gold text-background shadow-sm" : "text-muted-foreground hover:text-white"
              )}
            >
              {f === "all" ? "All" : f === "proposal" ? "Proposals" : "Scout"}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <div className="flex gap-1 rounded-xl border border-border/60 bg-sidebar/60 p-1">
          {([
            { id: "today", label: "Today" },
            { id: "3days", label: "3 Days" },
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
            { id: "custom", label: "Custom" },
          ] as { id: DateFilter; label: string }[]).map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                dateFilter === f.id ? "bg-teal text-background shadow-sm" : "text-muted-foreground hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-36 text-xs bg-background/60"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-36 text-xs bg-background/60"
            />
          </div>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} records</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <StatCard label="Total" value={total} color="border-white/10 bg-white/[0.03] text-white" />
        <StatCard label="Submitted" value={submitted} sub={`${submitRate}%`} color="border-gold/20 bg-gold/5 text-gold" />
        <StatCard label="Read" value={read} sub={`${readRate}% of sent`} color="border-blue-400/20 bg-blue-400/5 text-blue-400" />
        <StatCard label="Replied" value={replied} sub={`${replyRate}% of read`} color="border-teal/20 bg-teal/5 text-teal" />
        <StatCard label="Converted" value={converted} sub={`${convRate}% of replied`} color="border-green-400/20 bg-green-400/5 text-green-400" />
        {hookStats.slice(0, 3).map((h) => (
          <StatCard key={h.id} label={`Hook: ${h.id.replace(/_/g, " ")}`} value={`${h.bayesianRate}%`} sub={`${h.total} used (Bayesian)`} color="border-purple-400/20 bg-purple-400/5 text-purple-400" />
        ))}
      </div>

      {/* Win Patterns Panel (Phase 2.3) */}
      {winPatterns.length > 0 && (
        <CropCard className="mb-6 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-gold" />
            <p className="text-sm font-semibold text-white">Win Patterns</p>
            <span className="text-[10px] text-muted-foreground ml-1">(Hook × Strategy × CTA combos with ≥4 uses)</span>
          </div>
          <div className="space-y-2">
            {winPatterns.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/30 bg-white/[0.02] px-3 py-2">
                <span className="w-8 shrink-0 text-center font-bold text-gold text-sm">{p.bayesianRate}%</span>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  <span className="rounded-full bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 text-[10px] text-purple-300">Hook: {p.hook.replace(/_/g, " ")}</span>
                  <span className="rounded-full bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 text-[10px] text-blue-300">Strategy: {p.strategy.replace(/_/g, " ")}</span>
                  <span className="rounded-full bg-teal/10 border border-teal/20 px-2 py-0.5 text-[10px] text-teal">CTA: {p.cta.replace(/_/g, " ")}</span>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{p.total} uses · {p.converted} won</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">Conversion rate uses Bayesian smoothing (avoids overconfidence on small samples)</p>
        </CropCard>
      )}

      {/* Table */}
      {trackingQuery.isPending ? (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <CropCard className="p-10 text-center">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No data for this filter. Try a wider date range.</p>
        </CropCard>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-24">Date</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-16">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider">Description</th>
                {showProposalCols && (
                  <>
                    <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-16">Analyzed</th>
                    <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-20">Generated</th>
                    <th className="text-left px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-28">Hook</th>
                    <th className="text-left px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-28">Strategy</th>
                    <th className="text-left px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-24">CTA</th>
                  </>
                )}
                {showScoutCols && (
                  <>
                    <th className="text-left px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-36">Subject Line</th>
                    <th className="text-left px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-40">Email Preview</th>
                  </>
                )}
                <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-20">Submitted</th>
                <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-16">Read</th>
                <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-16">Reply</th>
                <th className="text-center px-3 py-3 text-[10px] font-medium text-white/40 uppercase tracking-wider w-20">Converted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-[11px] text-white/50 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      row.kind === "proposal" ? "border-gold/30 bg-gold/10 text-gold" : "border-teal/30 bg-teal/10 text-teal"
                    )}>
                      {row.kind === "proposal" ? <FileText className="inline h-2.5 w-2.5 mr-0.5" /> : <Mail className="inline h-2.5 w-2.5 mr-0.5" />}
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-[11px] text-white/70 line-clamp-2 leading-snug">{row.excerpt}</p>
                  </td>
                  {showProposalCols && (
                    <>
                      <td className="px-3 py-3"><Check on={row.kind === "proposal" && row.analyzed} /></td>
                      <td className="px-3 py-3"><Check on={row.kind === "proposal" && row.generated} /></td>
                      <td className="px-3 py-3 text-[10px] text-white/50">{row.kind === "proposal" ? (row.hook ?? "—") : "—"}</td>
                      <td className="px-3 py-3 text-[10px] text-white/50">{row.kind === "proposal" ? (row.strategy ?? "—") : "—"}</td>
                      <td className="px-3 py-3 text-[10px] text-white/50">{row.kind === "proposal" ? (row.cta ?? "—") : "—"}</td>
                    </>
                  )}
                  {showScoutCols && (
                    <>
                      <td className="px-3 py-3 text-[10px] text-white/50 max-w-[140px]">
                        <span className="line-clamp-2">{row.kind === "scout" ? (row.subject_line ?? "—") : "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-[10px] text-white/40 max-w-[160px]">
                        <span className="line-clamp-2 italic">{row.kind === "scout" ? (row.email_body?.slice(0, 80) ?? "—") : "—"}</span>
                      </td>
                    </>
                  )}
                  <td className="px-3 py-3"><Check on={row.submitted} /></td>
                  <td className="px-3 py-3"><Check on={row.read_by_client} /></td>
                  <td className="px-3 py-3"><Check on={row.got_reply} /></td>
                  <td className="px-3 py-3"><Check on={row.converted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
