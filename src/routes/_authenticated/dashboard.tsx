import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PenLine, History, Briefcase, Bookmark, ArrowRight, FileText, TrendingUp, Zap, Target } from "lucide-react";
import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { listProposals, getProposalAnalytics } from "@/lib/proposals.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { listSaved } from "@/lib/saved.functions";
import { HOOKS, STRATEGIES } from "@/lib/proposal-constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const proposals = useQuery({ queryKey: ["proposals"], queryFn: () => listProposals() });
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => listSaved() });
  const analytics = useQuery({ queryKey: ["proposal-analytics"], queryFn: () => getProposalAnalytics() });

  const recent = (proposals.data ?? []).slice(0, 5);

  const stats = [
    { label: "Proposals", value: proposals.data?.length ?? 0, icon: History, to: "/history" },
    { label: "Portfolio items", value: portfolio.data?.length ?? 0, icon: Briefcase, to: "/portfolio" },
    { label: "Saved items", value: saved.data?.length ?? 0, icon: Bookmark, to: "/saved" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Your proposal command center."
        action={
          <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
            <Link to="/new">
              <PenLine className="mr-1.5 h-4 w-4" /> New proposal
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to}>
            <CropCard className="p-5 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-teal" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-4 font-display text-3xl font-bold text-white">{s.value}</p>
              <p className="annotation mt-1 !text-muted-foreground">{s.label}</p>
            </CropCard>
          </Link>
        ))}
      </div>

      {/* Analytics section — only shown once there's tracked data */}
      {analytics.data && analytics.data.totalTracked > 0 && (
        <AnalyticsSection data={analytics.data} />
      )}

      <div className="mt-8">
        <Eyebrow>Recent proposals</Eyebrow>
        <div className="mt-4">
          {recent.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No proposals yet"
              description="Paste a job post and let the analyzer draft your first blueprint."
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
              {recent.map((p) => (
                <Link key={p.id} to="/history" search={{ open: p.id }}>
                  <CropCard className="flex items-center justify-between p-4 transition-colors hover:border-teal/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {p.title || p.job_description.slice(0, 60) || "Untitled"}
                      </p>
                      <p className="annotation mt-0.5 !text-muted-foreground">
                        {p.length} · {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                  </CropCard>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Section (Phase 3) ─────────────────────────────────────────────

type Analytics = {
  totalProposals: number;
  totalResponded: number;
  totalTracked: number;
  overallRate: number;
  hookStats: Array<{ id: string; total: number; responded: number; responseRate: number }>;
  strategyStats: Array<{ id: string; total: number; responded: number; responseRate: number }>;
  bestHook: string | null;
  bestStrategy: string | null;
};

function AnalyticsSection({ data }: { data: Analytics }) {
  const topHooks = data.hookStats.slice(0, 4);
  const topStrategies = data.strategyStats.slice(0, 4);

  function hookName(id: string) {
    return HOOKS.find((h) => h.id === id)?.name ?? id;
  }
  function stratName(id: string) {
    return STRATEGIES.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div className="mt-8">
      <Eyebrow>Performance analytics</Eyebrow>
      <p className="annotation mt-1 mb-4 !text-muted-foreground">
        Based on {data.totalTracked} tracked proposal{data.totalTracked !== 1 ? "s" : ""}.
        Mark responses in your history to improve these insights.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <CropCard className="p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-teal" />
            <span className="annotation !text-muted-foreground">Overall response rate</span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-white">{data.overallRate}%</p>
          <p className="annotation !text-muted-foreground">
            {data.totalResponded} of {data.totalTracked} tracked
          </p>
        </CropCard>
        <CropCard className="p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            <span className="annotation !text-muted-foreground">Best hook</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {data.bestHook ? hookName(data.bestHook) : "Not enough data yet"}
          </p>
          {data.bestHook && (
            <p className="annotation !text-gold">
              {data.hookStats.find((h) => h.id === data.bestHook)?.responseRate ?? 0}% response rate
            </p>
          )}
        </CropCard>
        <CropCard className="p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold" />
            <span className="annotation !text-muted-foreground">Best strategy</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">
            {data.bestStrategy ? stratName(data.bestStrategy) : "Not enough data yet"}
          </p>
          {data.bestStrategy && (
            <p className="annotation !text-gold">
              {data.strategyStats.find((s) => s.id === data.bestStrategy)?.responseRate ?? 0}% response rate
            </p>
          )}
        </CropCard>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {topHooks.length > 0 && (
          <CropCard className="p-5">
            <Eyebrow>Hooks performance</Eyebrow>
            <div className="mt-3 space-y-3">
              {topHooks.map((h) => (
                <BarRow
                  key={h.id}
                  label={hookName(h.id)}
                  rate={h.responseRate}
                  total={h.total}
                  responded={h.responded}
                />
              ))}
            </div>
          </CropCard>
        )}
        {topStrategies.length > 0 && (
          <CropCard className="p-5">
            <Eyebrow>Strategies performance</Eyebrow>
            <div className="mt-3 space-y-3">
              {topStrategies.map((s) => (
                <BarRow
                  key={s.id}
                  label={stratName(s.id)}
                  rate={s.responseRate}
                  total={s.total}
                  responded={s.responded}
                />
              ))}
            </div>
          </CropCard>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  rate,
  total,
  responded,
}: {
  label: string;
  rate: number;
  total: number;
  responded: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-white">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {responded}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sidebar">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            rate >= 50 ? "bg-emerald-500" : rate >= 25 ? "bg-gold" : "bg-muted-foreground/50",
          )}
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}
