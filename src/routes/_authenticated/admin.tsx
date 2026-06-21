import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Activity, Shield, Terminal, Play, X, Loader2, Database, ChevronDown, ChevronUp,
  Copy, Check, TrendingUp, Eye, UserCheck, Globe, ArrowUp, ArrowDown, Minus,
  Search, KeyRound, Trash2, AlertTriangle, Key, ExternalLink, CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/use-auth";
import { listAdminUsers, getPageViewStats, runAdminSql, sendPasswordReset, deleteAdminUser, getApiKeyStatus } from "@/lib/admin.functions";
import type { AdminUser, ApiKeyStatus } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
});

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function timeSince(date: string | null): string {
  if (!date) return "never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TABS = ["Overview", "Users", "API Keys", "Database"] as const;
type Tab = typeof TABS[number];

function AdminPanel() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [sql, setSql] = useState("");
  const [sqlResult, setSqlResult] = useState<Record<string, unknown>[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const sqlMutation = useMutation({
    mutationFn: () => runAdminSql({ data: { sql } }),
    onSuccess: (rows) => { setSqlResult(JSON.parse(rows as string) as Record<string, unknown>[]); setSqlError(null); },
    onError: (e: Error) => { setSqlError(e.message); setSqlResult(null); },
  });

  const qc = useQueryClient();

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => sendPasswordReset({ data: { userId } }),
    onSuccess: (res) => toast.success(`Password reset email sent to ${res?.email}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => deleteAdminUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      qc?.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listAdminUsers(),
    enabled: auth.isAdmin,
  });

  const viewsQuery = useQuery({
    queryKey: ["admin-page-views"],
    queryFn: () => getPageViewStats(),
    enabled: auth.isAdmin,
  });

  const apiKeysQuery = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: () => getApiKeyStatus(),
    enabled: auth.isAdmin && activeTab === "API Keys",
  });

  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="h-16 w-16 rounded-2xl border border-destructive/30 bg-destructive/10 flex items-center justify-center">
          <Shield className="h-8 w-8 text-destructive/70" />
        </div>
        <p className="text-lg font-semibold text-white">Access Denied</p>
        <p className="text-sm text-muted-foreground">Admin access is required to view this page.</p>
      </div>
    );
  }

  const users: AdminUser[] = usersQuery.data ?? [];
  const views = viewsQuery.data ?? [];

  const uniqueFingerprints = new Set(views.map((v: any) => v.fingerprint).filter(Boolean)).size;
  const uniqueUsers = new Set(views.map((v: any) => v.user_id).filter(Boolean)).size;
  const anonVisitors = Math.max(0, uniqueFingerprints - uniqueUsers);

  // Build daily traffic map — last 14 days
  const now = Date.now();
  const dailyMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    dailyMap[d] = 0;
  }
  views.forEach((v: any) => {
    const d = v.created_at?.slice(0, 10);
    if (d && d in dailyMap) dailyMap[d]++;
  });

  const days = Object.entries(dailyMap);
  const maxViews = Math.max(...days.map(([, c]) => c), 1);
  const todayCount = days[days.length - 1]?.[1] ?? 0;
  const yesterdayCount = days[days.length - 2]?.[1] ?? 0;
  const trend = todayCount > yesterdayCount ? "up" : todayCount < yesterdayCount ? "down" : "flat";

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="Platform overview — users, traffic, and database management."
      />

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border/60 bg-sidebar/60 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab
                ? "bg-gold text-background shadow-sm"
                : "text-muted-foreground hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "Overview" && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Registered Users"
              value={users.length}
              color="teal"
            />
            <StatCard
              icon={<Eye className="h-5 w-5" />}
              label="Total Page Views"
              value={views.length}
              color="gold"
            />
            <StatCard
              icon={<Globe className="h-5 w-5" />}
              label="Unique Visitors"
              value={uniqueFingerprints}
              color="purple"
              sub={`${anonVisitors} anonymous`}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Views Today"
              value={todayCount}
              color={trend === "up" ? "green" : trend === "down" ? "red" : "default"}
              trend={trend}
              sub={`${yesterdayCount} yesterday`}
            />
          </div>

          {/* Traffic chart */}
          <CropCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Eyebrow>Traffic</Eyebrow>
                <p className="mt-0.5 text-xs text-muted-foreground">Page views — last 14 days</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs text-teal">
                <Activity className="h-3 w-3" />
                {views.length} total
              </div>
            </div>
            <div className="flex h-36 items-end gap-1.5">
              {days.map(([day, count], i) => {
                const pct = (count / maxViews) * 100;
                const isToday = i === days.length - 1;
                return (
                  <div key={day} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="absolute -top-6 hidden rounded bg-background/80 border border-border/60 px-1.5 py-0.5 text-[9px] text-white group-hover:block whitespace-nowrap">
                      {count} · {day.slice(5)}
                    </div>
                    <div
                      className={cn(
                        "w-full rounded-t transition-all",
                        isToday ? "bg-gold" : "bg-teal/40 group-hover:bg-teal",
                      )}
                      style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%`, minHeight: count > 0 ? "3px" : "1px" }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
              <span>{days[0]?.[0]?.slice(5)}</span>
              <span className="text-gold font-medium">Today</span>
            </div>
          </CropCard>

          {/* Recent users preview */}
          <CropCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Eyebrow>Recent Signups</Eyebrow>
              <button
                onClick={() => setActiveTab("Users")}
                className="text-xs text-teal hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="space-y-2">
              {users.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg bg-background/40 px-3 py-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gold/15 flex items-center justify-center text-xs font-bold text-gold">
                    {(u.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{u.email ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Joined {fmt(u.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <p className="text-xs font-semibold text-gold">{u.proposal_count}</p>
                      <p className="text-[9px] text-muted-foreground">proposals</p>
                    </div>
                    <div className={cn("h-2 w-2 rounded-full", u.last_sign_in_at ? "bg-teal animate-pulse" : "bg-muted-foreground/30")} />
                  </div>
                </div>
              ))}
            </div>
          </CropCard>
        </div>
      )}

      {/* ── Users Tab ── */}
      {activeTab === "Users" && (
        <div className="space-y-4">
          <CropCard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
              <div className="flex-1">
                <Eyebrow>All Accounts</Eyebrow>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email…"
                    className="pl-8 h-8 text-xs w-52 bg-background/60"
                  />
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-sidebar/60 px-3 py-1">
                  <UserCheck className="h-3 w-3 text-teal" />
                  <span className="text-xs text-muted-foreground">{users.length} total</span>
                </div>
              </div>
            </div>
            {usersQuery.isPending ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading users…</span>
              </div>
            ) : usersQuery.isError ? (
              <p className="text-sm text-red-400 py-4">{String((usersQuery.error as Error).message)}</p>
            ) : (
              <div className="space-y-2">
                {users
                  .filter((u) => !userSearch || (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase()))
                  .map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      isMe={u.id === auth.userId}
                      onResetPassword={() => resetPasswordMutation.mutate(u.id)}
                      onDelete={() => setConfirmDelete(u)}
                      resetting={resetPasswordMutation.isPending && resetPasswordMutation.variables === u.id}
                    />
                  ))}
              </div>
            )}
          </CropCard>

          {/* Confirm delete dialog */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-sidebar p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <p className="font-semibold text-white">Delete user?</p>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  This will permanently delete <strong className="text-white">{confirmDelete.email}</strong> and all their data. This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                    disabled={deleteUserMutation.isPending}
                    onClick={() => deleteUserMutation.mutate(confirmDelete.id)}
                  >
                    {deleteUserMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                    Delete permanently
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── API Keys Tab ── */}
      {activeTab === "API Keys" && (
        <div className="space-y-6">
          {/* Summary row */}
          {apiKeysQuery.data && (() => {
            const keys = apiKeysQuery.data as ApiKeyStatus[];
            const configured = keys.filter((k) => k.configured).length;
            return (
              <div className="flex flex-wrap gap-3">
                <div className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                  configured === 0
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : configured >= 2
                    ? "border-teal/30 bg-teal/10 text-teal"
                    : "border-gold/30 bg-gold/10 text-gold",
                )}>
                  <Key className="h-4 w-4" />
                  {configured}/{keys.length} providers configured
                </div>
                {configured === 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    No AI provider — generation will fail
                  </div>
                )}
              </div>
            );
          })()}

          {/* Provider list */}
          <CropCard className="divide-y divide-border/30 overflow-hidden p-0">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
              <Eyebrow>AI Providers</Eyebrow>
              <span className="text-xs text-muted-foreground ml-1">— tried in priority order</span>
            </div>
            {apiKeysQuery.isPending ? (
              <div className="flex items-center gap-2 justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking keys…</span>
              </div>
            ) : apiKeysQuery.isError ? (
              <p className="p-5 text-sm text-red-400">{String((apiKeysQuery.error as Error).message)}</p>
            ) : (
              (apiKeysQuery.data as ApiKeyStatus[]).map((provider) => (
                <div key={provider.envVar} className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  provider.configured ? "bg-teal/[0.03]" : "hover:bg-white/[0.015]",
                )}>
                  {/* Priority badge */}
                  <div className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    provider.configured ? "bg-teal/20 text-teal" : "bg-white/10 text-muted-foreground",
                  )}>
                    {provider.priority}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{provider.name}</p>
                      {provider.free && (
                        <span className="rounded-full border border-teal/30 bg-teal/10 px-1.5 py-0.5 text-[9px] font-medium text-teal uppercase tracking-wider">
                          Free tier
                        </span>
                      )}
                      {provider.priority === 1 && (
                        <span className="flex items-center gap-0.5 rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[9px] font-medium text-gold uppercase tracking-wider">
                          <Zap className="h-2.5 w-2.5" /> Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{provider.description}</p>
                    <code className="mt-1.5 inline-block rounded bg-background/60 border border-border/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {provider.envVar}
                    </code>
                  </div>

                  {/* Status + action */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {provider.configured ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" /> Not set
                      </div>
                    )}
                    {!provider.configured && (
                      <a
                        href={provider.signupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-teal hover:underline"
                      >
                        Get key <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </CropCard>

          {/* Setup instructions */}
          <CropCard className="p-5 border-gold/20 bg-gold/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gold/20 flex items-center justify-center">
                <Key className="h-3.5 w-3.5 text-gold" />
              </div>
              <Eyebrow className="text-gold">How to add a key</Eyebrow>
            </div>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
              <li>Sign up at the provider's website (use the "Get key" links above)</li>
              <li>Copy your API key from their dashboard</li>
              <li>Add it as an environment variable in your hosting platform (e.g. Vercel → Settings → Environment Variables)</li>
              <li>Redeploy your app — the new key will be picked up automatically</li>
            </ol>
            <div className="mt-4 rounded-xl border border-border/40 bg-background/60 px-4 py-3">
              <p className="text-xs text-white font-medium mb-1.5">Quick recommendation</p>
              <p className="text-xs text-muted-foreground">
                Start with <strong className="text-teal">Google Gemini</strong> (free, 1M tokens/day) and{" "}
                <strong className="text-teal">Groq</strong> (free, very fast). Add{" "}
                <strong className="text-gold">Anthropic Claude</strong> as your primary key for the most reliable experience.
                Having 2–3 providers means generation never fails even if one is down.
              </p>
            </div>
          </CropCard>

          {/* Grant admin migration */}
          <CropCard className="p-5 border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-destructive/80" />
              </div>
              <Eyebrow>Grant Admin Role</Eyebrow>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              If a user should be admin but sees "Forbidden", run this SQL in the Database tab (or directly in Supabase SQL Editor), replacing the email:
            </p>
            <pre className="rounded-xl border border-border/40 bg-sidebar/80 p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
{`INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users
WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';`}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 border-border/60 text-xs"
              onClick={() => {
                const sql = `INSERT INTO public.user_roles (user_id, role)\nSELECT id, 'admin' FROM auth.users\nWHERE email = 'YOUR_EMAIL@example.com'\nON CONFLICT (user_id) DO UPDATE SET role = 'admin';`;
                navigator.clipboard.writeText(sql);
                toast.success("SQL copied — paste it in the Database tab");
              }}
            >
              <Copy className="mr-1.5 h-3 w-3" /> Copy SQL
            </Button>
          </CropCard>
        </div>
      )}

      {/* ── Database Tab ── */}
      {activeTab === "Database" && (
        <div className="space-y-6">
          <MigrationsPanel onLoadSql={(s) => { setSql(s); setSqlResult(null); setSqlError(null); }} />

          {/* SQL Runner */}
          <CropCard className="p-6 border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                <Terminal className="h-3.5 w-3.5 text-destructive/80" />
              </div>
              <Eyebrow>SQL Runner</Eyebrow>
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive/80 font-mono">
                service_role
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Raw SQL executed against the database with full service role privileges. Results appear below.
            </p>
            <Textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={8}
              placeholder={"SELECT * FROM profiles LIMIT 10;\n\n-- Or paste a migration from above:"}
              className="resize-y bg-background/60 font-mono text-xs border-border/60"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                disabled={sqlMutation.isPending || !sql.trim()}
                onClick={() => { setSqlResult(null); setSqlError(null); sqlMutation.mutate(); }}
              >
                {sqlMutation.isPending
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Running…</>
                  : <><Play className="mr-1.5 h-3.5 w-3.5" /> Run SQL</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSql(""); setSqlResult(null); setSqlError(null); }}
                className="border-border/60"
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            </div>

            {sqlError && (
              <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="font-mono text-xs text-red-400 whitespace-pre-wrap">{sqlError}</p>
              </div>
            )}
            {sqlResult !== null && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{sqlResult.length} row(s) returned</span>
                  {sqlResult.length > 0 && (
                    <span className="text-[10px] text-teal font-mono">showing first {Math.min(sqlResult.length, 200)}</span>
                  )}
                </div>
                {sqlResult.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-line/40">
                    <table className="w-full text-xs">
                      <thead className="bg-sidebar/80">
                        <tr>
                          {Object.keys(sqlResult[0]).map((col) => (
                            <th key={col} className="border-b border-line/40 px-3 py-2 text-left font-mono text-[10px] text-muted-foreground whitespace-nowrap uppercase tracking-wider">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/20">
                        {sqlResult.slice(0, 200).map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-3 py-2 font-mono text-foreground/80 max-w-[280px] truncate">
                                {val === null
                                  ? <span className="text-muted-foreground/40 italic">NULL</span>
                                  : String(typeof val === "object" ? JSON.stringify(val) : val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-teal/20 bg-teal/5 px-4 py-3">
                    <p className="text-xs text-teal">✓ Query executed successfully — no rows returned.</p>
                  </div>
                )}
              </div>
            )}
          </CropCard>
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted-foreground">
        Analytics are collected server-side and viewable only by administrators.
      </p>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user, isMe, onResetPassword, onDelete, resetting,
}: {
  user: AdminUser;
  isMe: boolean;
  onResetPassword: () => void;
  onDelete: () => void;
  resetting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const initial = (user.email?.[0] ?? "?").toUpperCase();
  const colors = [
    "from-gold/20 to-teal/20 text-gold",
    "from-teal/20 to-purple-500/20 text-teal",
    "from-purple-500/20 to-gold/20 text-purple-400",
  ];
  const colorClass = colors[initial.charCodeAt(0) % 3];

  return (
    <div className={cn("rounded-lg border border-border/40 transition-colors", expanded ? "bg-sidebar/80" : "bg-background/30 hover:bg-background/60")}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={cn("h-9 w-9 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold", colorClass)}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <span className="truncate">{user.email ?? "—"}</span>
            {isMe && <span className="shrink-0 rounded-full bg-gold/20 border border-gold/30 px-1.5 py-0.5 text-[9px] font-medium text-gold">YOU</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">Joined {fmt(user.created_at)} · {timeSince(user.last_sign_in_at)} active</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gold">{user.proposal_count}</p>
            <p className="text-[9px] text-muted-foreground">proposals</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-teal">{user.portfolio_count}</p>
            <p className="text-[9px] text-muted-foreground">portfolios</p>
          </div>
          <span className={cn(
            "h-2 w-2 rounded-full",
            user.last_sign_in_at ? "bg-teal" : "bg-muted-foreground/30",
          )} />
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted-foreground">
            <span>ID: <code className="text-foreground/70 text-[10px]">{user.id}</code></span>
            <span>·</span>
            <span>Last active: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs border-border/60"
              disabled={resetting}
              onClick={onResetPassword}
            >
              {resetting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <KeyRound className="mr-1.5 h-3 w-3" />}
              Send password reset
            </Button>
            {!isMe && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                Delete user
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

type StatColor = "teal" | "gold" | "purple" | "green" | "red" | "default";

function StatCard({
  icon, label, value, color = "default", sub, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: StatColor;
  sub?: string;
  trend?: "up" | "down" | "flat";
}) {
  const colorMap: Record<StatColor, { bg: string; text: string; icon: string }> = {
    teal:    { bg: "bg-teal/10 border-teal/20",    text: "text-teal",           icon: "text-teal" },
    gold:    { bg: "bg-gold/10 border-gold/20",    text: "text-gold",           icon: "text-gold" },
    purple:  { bg: "bg-purple-500/10 border-purple-500/20", text: "text-purple-400", icon: "text-purple-400" },
    green:   { bg: "bg-green-500/10 border-green-500/20",   text: "text-green-400",  icon: "text-green-400" },
    red:     { bg: "bg-red-500/10 border-red-500/20",       text: "text-red-400",    icon: "text-red-400" },
    default: { bg: "bg-white/5 border-white/10",   text: "text-white",          icon: "text-muted-foreground" },
  };
  const c = colorMap[color];

  return (
    <CropCard className={cn("p-5", c.bg)}>
      <div className="flex items-start justify-between">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", c.bg, c.icon)}>
          {icon}
        </div>
        {trend && (
          <span className={cn("flex items-center gap-0.5 text-[10px] font-medium",
            trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground",
          )}>
            {trend === "up" ? <ArrowUp className="h-3 w-3" /> : trend === "down" ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </span>
        )}
      </div>
      <p className={cn("mt-3 text-2xl font-bold", c.text)}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground/60">{sub}</p>}
    </CropCard>
  );
}

// ─── Migrations Panel ─────────────────────────────────────────────────────────

const MIGRATIONS: { label: string; description: string; sql: string; priority?: "critical" | "normal" }[] = [
  {
    label: "Strategy links table",
    description: "REQUIRED for strategy document sharing. Run first if strategy links fail with 'Could not generate link'.",
    priority: "critical",
    sql: `-- Strategy docs with shareable slugs
CREATE TABLE IF NOT EXISTS public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  doc jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strategies_slug_idx ON public.strategies (slug);
CREATE INDEX IF NOT EXISTS strategies_user_idx ON public.strategies (user_id);
GRANT SELECT, INSERT, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='strategies' AND policyname='Users manage own strategies') THEN
    CREATE POLICY "Users manage own strategies" ON public.strategies FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='strategies' AND policyname='Public read strategies') THEN
    CREATE POLICY "Public read strategies" ON public.strategies FOR SELECT USING (true);
  END IF;
END $$;`,
  },
  {
    label: "Contest briefs table",
    description: "Required for the Contest Entry feature. Creates the contests table with shareable slug links.",
    sql: `-- Contest briefs with shareable slugs
CREATE TABLE IF NOT EXISTS public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Contest',
  brief jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contests_slug_idx ON public.contests (slug);
CREATE INDEX IF NOT EXISTS contests_user_idx ON public.contests (user_id);
GRANT SELECT, INSERT, DELETE ON public.contests TO authenticated;
GRANT ALL ON public.contests TO service_role;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contests' AND policyname='Users manage own contests') THEN
    CREATE POLICY "Users manage own contests" ON public.contests FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contests' AND policyname='Public read contests') THEN
    CREATE POLICY "Public read contests" ON public.contests FOR SELECT USING (true);
  END IF;
END $$;`,
  },
  {
    label: "Conversion threads & messages",
    description: "Required for the Conversion Messages feature. Creates conversion_threads and conversion_thread_messages tables.",
    sql: `-- Conversion chat threads
CREATE TABLE IF NOT EXISTS public.conversion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled conversation',
  job_description text NOT NULL DEFAULT '',
  sent_proposal text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversion_threads_user_idx ON public.conversion_threads (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_threads TO authenticated;
GRANT ALL ON public.conversion_threads TO service_role;
ALTER TABLE public.conversion_threads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversion_threads' AND policyname='Users manage own conversion_threads') THEN
    CREATE POLICY "Users manage own conversion_threads" ON public.conversion_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Thread messages
CREATE TABLE IF NOT EXISTS public.conversion_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.conversion_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client', 'you')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversion_thread_messages_thread_idx ON public.conversion_thread_messages (thread_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_thread_messages TO authenticated;
GRANT ALL ON public.conversion_thread_messages TO service_role;
ALTER TABLE public.conversion_thread_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversion_thread_messages' AND policyname='Users manage own conversion_thread_messages') THEN
    CREATE POLICY "Users manage own conversion_thread_messages" ON public.conversion_thread_messages FOR ALL
      USING (EXISTS (SELECT 1 FROM public.conversion_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.conversion_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
  END IF;
END $$;`,
  },
  {
    label: "Conversation stages, deep learning & Drive link",
    description: "Adds stage, context_dump, extracted, and drive_link columns. Run after migration 3.",
    sql: `-- Conversation stages + deep learning columns
ALTER TABLE public.conversion_threads
  ADD COLUMN IF NOT EXISTS stage integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS context_dump text DEFAULT '',
  ADD COLUMN IF NOT EXISTS extracted jsonb DEFAULT '{}';

-- Drive link on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS drive_link text;
ALTER TABLE public.sub_profiles ADD COLUMN IF NOT EXISTS drive_link text;

-- Custom strategies table
CREATE TABLE IF NOT EXISTS public.custom_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_strategies TO authenticated;
GRANT ALL ON public.custom_strategies TO service_role;
ALTER TABLE public.custom_strategies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_strategies' AND policyname='own custom_strategies') THEN
    CREATE POLICY "own custom_strategies" ON public.custom_strategies FOR ALL TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;`,
  },
  {
    label: "SQL runner function + follow-up reminders",
    description: "Creates the run_admin_sql() function (needed for this SQL runner to work) and adds reminder_at to threads. RUN THIS FIRST if SQL runner returns permission errors.",
    sql: `-- Admin SQL runner (service_role only)
CREATE OR REPLACE FUNCTION public.run_admin_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '%', SQLERRM;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_admin_sql(text) TO service_role;

-- Follow-up reminder column
ALTER TABLE public.conversion_threads ADD COLUMN IF NOT EXISTS reminder_at timestamptz;`,
  },
  {
    label: "Portfolio samples table",
    description: "REQUIRED for AI-generated digital skills portfolio samples (SEO, content writing, copywriting, etc.). Run this to enable automatic sample generation and shareable /sample/{slug} links.",
    priority: "critical",
    sql: `-- AI-generated portfolio samples with shareable slugs
CREATE TABLE IF NOT EXISTS public.portfolio_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  category text NOT NULL,
  job_excerpt text NOT NULL DEFAULT '',
  samples jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portfolio_samples_slug_idx ON public.portfolio_samples (slug);
CREATE INDEX IF NOT EXISTS portfolio_samples_user_idx ON public.portfolio_samples (user_id);
GRANT SELECT, INSERT, DELETE ON public.portfolio_samples TO authenticated;
GRANT ALL ON public.portfolio_samples TO service_role;
ALTER TABLE public.portfolio_samples ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='portfolio_samples' AND policyname='Users manage own portfolio_samples') THEN
    CREATE POLICY "Users manage own portfolio_samples" ON public.portfolio_samples FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='portfolio_samples' AND policyname='Public read portfolio_samples') THEN
    CREATE POLICY "Public read portfolio_samples" ON public.portfolio_samples FOR SELECT USING (true);
  END IF;
END $$;`,
  },
  {
    label: "6. Scout outreach + outreach templates tables",
    description: "Tables for tracking scout outreach and storing analyzed outreach templates. Required for tracking page and reports.",
    priority: "critical",
    sql: `-- Scout outreach tracking table
CREATE TABLE IF NOT EXISTS public.scout_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  job_description text NOT NULL DEFAULT '',
  job_excerpt text NOT NULL DEFAULT '',
  job_type text,
  subject_line text,
  email_body text,
  hook_rationale text,
  strategy_note text,
  dev_prompt_title text,
  submitted boolean NOT NULL DEFAULT false,
  read_by_client boolean NOT NULL DEFAULT false,
  got_reply boolean NOT NULL DEFAULT false,
  converted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scout_outreach_user_idx ON public.scout_outreach (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scout_outreach TO authenticated;
GRANT ALL ON public.scout_outreach TO service_role;
ALTER TABLE public.scout_outreach ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scout_outreach' AND policyname='Users manage own scout_outreach') THEN
    CREATE POLICY "Users manage own scout_outreach" ON public.scout_outreach FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Outreach templates table
CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email_content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  hook_style text NOT NULL DEFAULT '',
  insight_approach text NOT NULL DEFAULT '',
  cta_style text NOT NULL DEFAULT '',
  structure_analysis text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_templates TO authenticated;
GRANT ALL ON public.outreach_templates TO service_role;
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outreach_templates' AND policyname='Users manage own outreach_templates') THEN
    CREATE POLICY "Users manage own outreach_templates" ON public.outreach_templates FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add tracking columns to proposals table (safe to run multiple times)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_by_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS got_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted boolean NOT NULL DEFAULT false;`,
  },
  {
    label: "7. Add niche tags to portfolio_items",
    description: "Adds niche and niche_tags columns to portfolio_items for niche-based auto-selection.",
    sql: `ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS niche text DEFAULT '' NOT NULL;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS niche_tags text[] DEFAULT '{}' NOT NULL;`,
  },
  {
    label: "8. AI Enhancement — entities, specificity, voice fingerprint",
    description: "Adds extracted_entities, specificity_score, entity_usage_count, regeneration_count, prompt_version to proposals. Creates voice_edits table and voice_profile on profiles.",
    sql: `-- Phase 1: Entity extraction + specificity tracking on proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS extracted_entities jsonb;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS specificity_score integer;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS entity_usage_count integer;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS regeneration_count integer DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS prompt_version text;

-- Index for niche + conversion win pattern queries (Phase 2.3)
CREATE INDEX IF NOT EXISTS idx_proposals_niche_converted ON public.proposals (detected_niche, converted);

-- Phase 3: Voice fingerprint
CREATE TABLE IF NOT EXISTS public.voice_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  proposal_id uuid REFERENCES public.proposals,
  before_content text NOT NULL,
  after_content text NOT NULL,
  diff_percentage numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.voice_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "voice_edits_own" ON public.voice_edits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Voice profile stored on the user's profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_profile jsonb;`,
  },
];

function MigrationsPanel({ onLoadSql }: { onLoadSql: (sql: string) => void }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(sql: string, key: string) {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gold/20 flex items-center justify-center">
            <Database className="h-3.5 w-3.5 text-gold" />
          </div>
          <div className="text-left">
            <Eyebrow className="text-gold">Pending Migrations</Eyebrow>
            <p className="text-[10px] text-muted-foreground mt-0.5">Run in order in Supabase SQL Editor</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-5 space-y-3">
          {MIGRATIONS.map((m, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-4",
                m.priority === "critical"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-line/40 bg-background/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    m.priority === "critical" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-muted-foreground",
                  )}>
                    {i + 1}
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", m.priority === "critical" ? "text-red-300" : "text-white")}>
                      {m.label}
                      {m.priority === "critical" && <span className="ml-2 text-[10px] font-mono text-red-400 uppercase tracking-wider">⚠ critical</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-line/40 text-[11px]"
                    onClick={() => copy(m.sql, String(i))}
                  >
                    {copied === String(i) ? <><Check className="h-3 w-3 mr-1 text-teal" /> Copied</> : <><Copy className="h-3 w-3 mr-1" /> Copy</>}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 text-[11px]"
                    onClick={() => onLoadSql(m.sql)}
                  >
                    <Play className="h-3 w-3 mr-1" /> Load & Run
                  </Button>
                </div>
              </div>
              <pre className="mt-3 rounded-lg bg-sidebar/80 p-2.5 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap">
                {m.sql.slice(0, 280)}{m.sql.length > 280 ? "\n…" : ""}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
