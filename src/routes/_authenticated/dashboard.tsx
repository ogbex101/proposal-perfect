import type * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PenLine,
  History,
  Briefcase,
  Bookmark,
  ArrowRight,
  FileText,
  TrendingUp,
  Zap,
  Target,
  LayoutGrid,
  Settings,
  Globe,
  Activity,
  PieChart as PieChartIcon,
  Ruler,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { listProposals, getProposalAnalytics } from "@/lib/proposals.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { listSaved } from "@/lib/saved.functions";
import { listGeneratedPortfolios } from "@/lib/portfolio-generate.functions";
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
  const generated = useQuery({
    queryKey: ["generated-portfolios"],
    queryFn: () => listGeneratedPortfolios(),
  });

  const proposalRows = proposals.data ?? [];
  const generatedRows = generated.data ?? [];
  const recent = proposalRows.slice(0, 5);

  const monthly = buildMonthlySeries(proposalRows);
  const lengthCounts = countBy(proposalRows, (p) => p.length);
  const avgLengthLabel = mostCommon(proposalRows.map((p) => p.length)) ?? "—";
  const mostUsedHook = mostCommon(proposalRows.map((p) => p.hook).filter(Boolean) as string[]);
  const mostUsedStrategy = mostCommon(
    proposalRows.map((p) => p.strategy).filter(Boolean) as string[],
  );
  const nicheDist = buildNicheDistribution(generatedRows);

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

      {/* Quick actions */}
      <div className="mt-8">
        <Eyebrow>Quick actions</Eyebrow>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to} search={a.search}>
              <CropCard className="flex h-full flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-teal/40">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    a.accent === "gold" ? "bg-gold/15 text-gold" : "bg-teal/15 text-teal",
                  )}
                >
                  <a.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{a.label}</p>
                  <p className="annotation mt-0.5 !text-muted-foreground">{a.description}</p>
                </div>
              </CropCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Content breakdown */}
      <div className="mt-8">
        <Eyebrow>Content breakdown</Eyebrow>
        <div className="mt-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile icon={FileText} label="Total proposals" value={proposalRows.length} />
          <StatTile icon={Globe} label="Generated portfolios" value={generatedRows.length} />
          <StatTile icon={Ruler} label="Typical length" value={cap(avgLengthLabel)} />
          <StatTile
            icon={Zap}
            label="Most-used hook"
            value={mostUsedHook ? hookLabel(mostUsedHook) : "—"}
          />
          <StatTile
            icon={Target}
            label="Most-used strategy"
            value={mostUsedStrategy ? strategyLabel(mostUsedStrategy) : "—"}
          />
          <StatTile icon={Bookmark} label="Saved items" value={saved.data?.length ?? 0} />
          <StatTile icon={Briefcase} label="Portfolio items" value={portfolio.data?.length ?? 0} />
          <StatTile
            icon={History}
            label="Brief / Robust / Explanatory"
            value={`${lengthCounts.brief ?? 0} / ${lengthCounts.robust ?? 0} / ${lengthCounts.explanatory ?? 0}`}
          />
        </div>
      </div>

      {/* Charts row: activity over time + response distribution */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <CropCard className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal" />
            <Eyebrow>Proposals per month</Eyebrow>
          </div>
          <p className="annotation mt-1 mb-3 !text-muted-foreground">Last 6 months of activity.</p>
          {monthly.some((m) => m.count > 0) ? (
            <ChartContainer config={ACTIVITY_CONFIG} className="aspect-[16/7] w-full">
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="barTeal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-teal, #2dd4bf)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--color-teal, #2dd4bf)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" fill="url(#barTeal)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No proposal activity yet.
            </p>
          )}
        </CropCard>

        <CropCard className="p-5">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-gold" />
            <Eyebrow>Response distribution</Eyebrow>
          </div>
          <p className="annotation mt-1 mb-3 !text-muted-foreground">Across all proposals.</p>
          {analytics.data && analytics.data.totalProposals > 0 ? (
            <ResponseDonut data={analytics.data} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
          )}
        </CropCard>
      </div>

      {/* Niche distribution */}
      {nicheDist.length > 0 && (
        <div className="mt-8">
          <Eyebrow>Portfolio niches</Eyebrow>
          <CropCard className="mt-4 p-5">
            <div className="space-y-3">
              {nicheDist.map((n) => (
                <NicheRow
                  key={n.niche}
                  label={n.niche}
                  count={n.count}
                  max={nicheDist[0].count}
                />
              ))}
            </div>
          </CropCard>
        </div>
      )}

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

// ─── Quick actions config ────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: "New proposal",
    description: "Draft a tailored proposal",
    to: "/new" as const,
    icon: PenLine,
    accent: "gold" as const,
    search: undefined,
  },
  {
    label: "Generate portfolio",
    description: "Build a one-page site",
    to: "/new" as const,
    icon: LayoutGrid,
    accent: "teal" as const,
    search: undefined,
  },
  {
    label: "View history",
    description: "Browse past proposals",
    to: "/history" as const,
    icon: History,
    accent: "teal" as const,
    search: undefined,
  },
  {
    label: "Settings",
    description: "Profile & preferences",
    to: "/settings" as const,
    icon: Settings,
    accent: "teal" as const,
    search: undefined,
  },
];

// ─── Small data helpers ──────────────────────────────────────────────────────

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = countBy(values, (v) => v);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function hookLabel(id: string): string {
  return HOOKS.find((h) => h.id === id)?.name ?? id;
}
function strategyLabel(id: string): string {
  return STRATEGIES.find((s) => s.id === id)?.name ?? id;
}

function buildMonthlySeries(
  rows: Array<{ created_at: string }>,
): Array<{ label: string; count: number }> {
  const now = new Date();
  const buckets: Array<{ label: string; key: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleString("default", { month: "short" }),
      key: `${d.getFullYear()}-${d.getMonth()}`,
      count: 0,
    });
  }
  const index = new Map(buckets.map((b) => [b.key, b]));
  for (const row of rows) {
    const d = new Date(row.created_at);
    const bucket = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}

function buildNicheDistribution(
  rows: Array<{ niche: string | null }>,
): Array<{ niche: string; count: number }> {
  const counts = countBy(
    rows.map((r) => r.niche?.trim() || "Uncategorized"),
    (v) => v,
  );
  return Object.entries(counts)
    .map(([niche, count]) => ({ niche, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Reusable presentational bits ────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <CropCard className="p-4">
      <Icon className="h-4 w-4 text-teal" />
      <p className="mt-3 truncate font-display text-xl font-bold text-white" title={String(value)}>
        {value}
      </p>
      <p className="annotation mt-0.5 !text-muted-foreground">{label}</p>
    </CropCard>
  );
}

function NicheRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-white">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sidebar">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal to-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const ACTIVITY_CONFIG = {
  count: { label: "Proposals", color: "var(--color-teal, #2dd4bf)" },
} satisfies ChartConfig;

const DONUT_CONFIG = {
  responded: { label: "Responded", color: "#34d399" },
  pending: { label: "No response", color: "#eab308" },
  untracked: { label: "Untracked", color: "#64748b" },
} satisfies ChartConfig;

function ResponseDonut({ data }: { data: Analytics }) {
  const responded = data.totalResponded;
  const pending = Math.max(0, data.totalTracked - data.totalResponded);
  const untracked = Math.max(0, data.totalProposals - data.totalTracked);
  const slices = [
    { key: "responded", value: responded, fill: DONUT_CONFIG.responded.color },
    { key: "pending", value: pending, fill: DONUT_CONFIG.pending.color },
    { key: "untracked", value: untracked, fill: DONUT_CONFIG.untracked.color },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <ChartContainer config={DONUT_CONFIG} className="mx-auto aspect-square max-h-[180px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="key"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 space-y-1.5">
        <DonutLegend color={DONUT_CONFIG.responded.color} label="Responded" value={responded} />
        <DonutLegend color={DONUT_CONFIG.pending.color} label="No response yet" value={pending} />
        <DonutLegend color={DONUT_CONFIG.untracked.color} label="Untracked" value={untracked} />
      </div>
    </div>
  );
}

function DonutLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-mono text-white">{value}</span>
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
