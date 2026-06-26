import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { AccessGate } from "@/components/AccessGate";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [accessGranted, setAccessGranted] = useState(false);

  useEffect(() => {
    if (auth.status === "out") {
      navigate({ to: "/auth", search: { mode: "login" } });
    }
  }, [auth.status, navigate]);

  // Sync local access state when auth resolves
  useEffect(() => {
    if (auth.hasAccess) setAccessGranted(true);
  }, [auth.hasAccess]);

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

  // Admins bypass the access code gate
  if (!accessGranted && !auth.isAdmin) {
    return <AccessGate onGranted={() => setAccessGranted(true)} />;
  }

  return (
    <DashboardShell email={auth.email} name={auth.name} isAdmin={auth.isAdmin}>
      <Outlet />
    </DashboardShell>
  );
}
