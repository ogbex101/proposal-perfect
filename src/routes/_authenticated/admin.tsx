import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Loader2,
  Users,
  FileText,
  Bookmark,
  ChevronLeft,
  Crown,
} from "lucide-react";

import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminListUsers, adminGetUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  proposal_count: number;
  is_admin: boolean;
};

function AdminPage() {
  const [selected, setSelected] = useState<UserRow | null>(null);

  const list = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminListUsers(),
    retry: false,
  });

  if (list.isError) {
    return (
      <div>
        <PageHeader eyebrow="Restricted" title="Admin Panel" />
        <EmptyState
          icon={ShieldCheck}
          title="Admin access required"
          description="This area is only available to administrator accounts."
        />
      </div>
    );
  }

  if (selected) {
    return <UserDetail user={selected} onBack={() => setSelected(null)} />;
  }

  const users = (list.data ?? []) as UserRow[];

  return (
    <div>
      <PageHeader
        eyebrow="Restricted"
        title="Admin Panel"
        description="All registered users and their activity. View-only."
      />

      {list.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Registered users will appear here." />
      ) : (
        <CropCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-line/60 hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Proposals</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer border-line/60"
                  onClick={() => setSelected(u)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/15 text-xs font-semibold text-teal">
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-white">
                            {u.name || "—"}
                          </span>
                          {u.is_admin && (
                            <Crown className="h-3 w-3 shrink-0 text-gold" />
                          )}
                        </div>
                        <span className="block truncate text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-white">
                    {u.proposal_count}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CropCard>
      )}
    </div>
  );
}

function UserDetail({ user, onBack }: { user: UserRow; onBack: () => void }) {
  const detail = useQuery({
    queryKey: ["admin-user", user.id],
    queryFn: () => adminGetUser({ data: { userId: user.id } }),
    retry: false,
  });

  const proposals = (detail.data?.proposals ?? []) as Array<{
    id: string;
    title: string | null;
    job_description: string;
    length: string;
    created_at: string;
  }>;
  const saved = (detail.data?.saved ?? []) as Array<{
    id: string;
    kind: string;
    created_at: string;
  }>;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> All users
      </button>

      <PageHeader
        eyebrow="User record"
        title={user.name || user.email || "User"}
        description={user.email ?? undefined}
      />

      {detail.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading record…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Eyebrow>
              <FileText className="mr-1 inline h-3 w-3" /> proposals ({proposals.length})
            </Eyebrow>
            <div className="mt-3 space-y-2">
              {proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No proposals.</p>
              ) : (
                proposals.map((p) => (
                  <CropCard key={p.id} className="p-3">
                    <p className="truncate text-sm font-medium text-white">
                      {p.title || p.job_description.slice(0, 50) || "Untitled"}
                    </p>
                    <p className="annotation mt-0.5 !text-muted-foreground">
                      {p.length} · {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </CropCard>
                ))
              )}
            </div>
          </div>

          <div>
            <Eyebrow>
              <Bookmark className="mr-1 inline h-3 w-3" /> saved items ({saved.length})
            </Eyebrow>
            <div className="mt-3 space-y-2">
              {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved items.</p>
              ) : (
                saved.map((s) => (
                  <CropCard key={s.id} className="flex items-center justify-between p-3">
                    <span className="text-sm capitalize text-white">{s.kind}</span>
                    <span className="annotation !text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </CropCard>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
