import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "out") {
      navigate({ to: "/auth", search: { mode: "login" } });
    }
  }, [auth.status, navigate]);

  if (auth.status !== "in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="annotation">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell email={auth.email} name={auth.name} isAdmin={auth.isAdmin}>
      <Outlet />
    </DashboardShell>
  );
}
