import { useState, type ReactNode } from "react";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PenLine,
  History,
  Briefcase,
  Bookmark,
  MessagesSquare,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new", label: "New Proposal", icon: PenLine },
  { to: "/history", label: "Proposal History", icon: History },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/saved", label: "Saved Items", icon: Bookmark },
  { to: "/conversion", label: "Conversion Messages", icon: MessagesSquare },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true },
];

export function DashboardShell({
  children,
  email,
  name,
  isAdmin,
}: {
  children: ReactNode;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { activeSub } = useActiveProfile();
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const display = name?.trim() || email?.split("@")[0] || "You";
  const initial = display.charAt(0).toUpperCase();

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarBody items={items} onNavigate={() => {}} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody items={items} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeSub && (
              <span className="hidden rounded-full border border-teal/40 bg-teal/10 px-2.5 py-0.5 text-[10px] font-medium text-teal sm:block">
                {activeSub.label}
              </span>
            )}
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-gold/40 bg-gold/10 text-sm font-semibold text-gold">
                {initial}
              </span>
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-white">{display}</p>
                {isAdmin && <p className="annotation !text-gold">Admin</p>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Log out"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  return (
    <>
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link to="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            activeProps={{
              className:
                "bg-gold/10 text-white border-gold/30 [&_svg]:text-gold",
            }}
            inactiveProps={{
              className:
                "text-sidebar-foreground border-transparent hover:bg-sidebar-accent hover:text-white",
            }}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Xperience Props · Phase 1
        </p>
      </div>
    </>
  );
}
