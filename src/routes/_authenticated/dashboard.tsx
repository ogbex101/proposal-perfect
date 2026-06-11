import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PenLine, History, Briefcase, Bookmark, ArrowRight, FileText } from "lucide-react";
import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { listProposals } from "@/lib/proposals.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { listSaved } from "@/lib/saved.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const proposals = useQuery({ queryKey: ["proposals"], queryFn: () => listProposals() });
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => listSaved() });

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
