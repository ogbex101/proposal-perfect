import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Briefcase, Activity, Shield, Clock, Mail } from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { useAuth } from "@/lib/use-auth";
import { listAdminUsers, getPageViewStats } from "@/lib/admin.functions";
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

      <p className="mt-4 text-[11px] text-muted-foreground">
        Anonymous visitors are tracked by browser fingerprint (screen size + timezone + user-agent hash) stored in the <code>page_views</code> table.
        Run this SQL in Lovable Cloud → SQL Editor to enable visitor tracking:
      </p>
      <pre className="mt-2 rounded-md bg-black/40 p-3 text-[10px] text-muted-foreground overflow-x-auto">{`CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fingerprint text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
CREATE POLICY "admin_read" ON public.page_views FOR SELECT USING (true);
CREATE POLICY "anyone_insert" ON public.page_views FOR INSERT WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`}</pre>
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
