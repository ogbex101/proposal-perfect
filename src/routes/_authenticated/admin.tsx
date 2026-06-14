import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Activity, Shield, Terminal, Play, X, Loader2 } from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/use-auth";
import { listAdminUsers, getPageViewStats, runAdminSql } from "@/lib/admin.functions";
import type { AdminUser } from "@/lib/admin.functions";

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

function AdminPanel() {
  const auth = useAuth();
  const [sql, setSql] = useState("");
  const [sqlResult, setSqlResult] = useState<Record<string, unknown>[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const sqlMutation = useMutation({
    mutationFn: () => runAdminSql({ data: { sql } }),
    onSuccess: (rows) => { setSqlResult(JSON.parse(rows as string) as Record<string, unknown>[]); setSqlError(null); },
    onError: (e: Error) => { setSqlError(e.message); setSqlResult(null); },
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

  if (!auth.isAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const users: AdminUser[] = usersQuery.data ?? [];
  const views = viewsQuery.data ?? [];

  // Compute stats
  const uniqueFingerprints = new Set(views.map((v: any) => v.fingerprint).filter(Boolean)).size;
  const uniqueUsers = new Set(views.map((v: any) => v.user_id).filter(Boolean)).size;
  const anonVisitors = uniqueFingerprints - uniqueUsers;

  // Group page views by day (last 14 days)
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

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Admin Panel"
        description="User accounts and visitor analytics across the platform."
      />

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Users className="h-4 w-4" />} label="Registered users" value={users.length} />
        <StatTile icon={<Activity className="h-4 w-4" />} label="Total page views" value={views.length} />
        <StatTile icon={<Activity className="h-4 w-4 text-teal" />} label="Unique visitors" value={uniqueFingerprints} />
        <StatTile icon={<Activity className="h-4 w-4 text-gold" />} label="Anonymous visitors" value={Math.max(0, anonVisitors)} />
      </div>

      {/* Traffic last 14 days */}
      <CropCard className="mb-6 p-5">
        <Eyebrow>Traffic — last 14 days</Eyebrow>
        <div className="mt-4 flex h-28 items-end gap-1">
          {Object.entries(dailyMap).map(([day, count]) => {
            const max = Math.max(...Object.values(dailyMap), 1);
            const pct = (count / max) * 100;
            return (
              <div key={day} className="group relative flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-teal/40 transition-all group-hover:bg-teal"
                  style={{ height: `${pct}%`, minHeight: count > 0 ? "4px" : "0" }}
                />
                <span className="absolute -top-5 hidden text-[9px] text-white group-hover:block">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>{Object.keys(dailyMap)[0]}</span>
          <span>Today</span>
        </div>
      </CropCard>

      {/* Users table */}
      <CropCard className="p-5">
        <Eyebrow>Registered accounts ({users.length})</Eyebrow>
        {usersQuery.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : usersQuery.isError ? (
          <p className="mt-4 text-sm text-red-400">{String((usersQuery.error as Error).message)}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Joined</th>
                  <th className="pb-2 pr-4">Last seen</th>
                  <th className="pb-2 pr-4 text-right">Proposals</th>
                  <th className="pb-2 text-right">Portfolios</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                          {(u.email?.[0] ?? "?").toUpperCase()}
                        </div>
                        <span className="truncate max-w-[180px] text-white">{u.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmt(u.created_at)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={u.last_sign_in_at ? "text-teal" : "text-muted-foreground"}>
                        {timeSince(u.last_sign_in_at)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="annotation !text-gold">{u.proposal_count}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="annotation !text-teal">{u.portfolio_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CropCard>

      {/* ── SQL Runner ── */}
      <CropCard className="mt-6 p-5 border-destructive/20">
        <Eyebrow>
          <Terminal className="inline h-3 w-3 mr-1 text-destructive" />
          sql runner
        </Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">
          Run raw SQL against the database using the service role. Results appear below.
        </p>
        <Textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={6}
          placeholder={"SELECT * FROM profiles LIMIT 10;\n\n-- Or paste a migration:"}
          className="mt-3 resize-y bg-background/60 font-mono text-xs"
        />
        <div className="mt-2 flex gap-2">
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
          >
            <X className="mr-1.5 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
        {sqlError && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="font-mono text-xs text-red-400 whitespace-pre-wrap">{sqlError}</p>
          </div>
        )}
        {sqlResult !== null && (
          <div className="mt-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-mono">{sqlResult.length} row(s) returned</p>
            {sqlResult.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-line/40">
                <table className="w-full text-xs">
                  <thead className="bg-sidebar/60">
                    <tr>
                      {Object.keys(sqlResult[0]).map((col) => (
                        <th key={col} className="border-b border-line/40 px-3 py-2 text-left font-mono text-muted-foreground whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlResult.slice(0, 200).map((row, i) => (
                      <tr key={i} className="border-b border-line/20 hover:bg-white/[0.02]">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-1.5 font-mono text-foreground/80 max-w-[300px] truncate">
                            {val === null
                              ? <span className="text-muted-foreground/50">NULL</span>
                              : String(typeof val === "object" ? JSON.stringify(val) : val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sqlResult.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Query executed successfully — no rows returned.</p>
            )}
          </div>
        )}
      </CropCard>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Visitor analytics are collected by the trusted server and can only be viewed by administrators.
      </p>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <CropCard className="p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
    </CropCard>
  );
}
