import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CropCard, Eyebrow, Logo } from "@/components/blueprint";

type Mode = "login" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode: Mode } => ({
    mode: search.mode === "signup" ? "signup" : "login",
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (isSignup && password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() || null } },
        });
        if (error) throw error;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function forgotPassword() {
    toast.info("Password reset isn't wired up yet — contact support to reset for now.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-border/60 lg:block">
        <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/">
            <Logo />
          </Link>
          <div className="bp-rise">
            <Eyebrow index="00">The proposal blueprint</Eyebrow>
            <h2 className="mt-5 max-w-sm font-display text-4xl font-extrabold leading-tight text-white">
              Read the brief.
              <br />
              <span className="text-gradient-gold">Win the bid.</span>
            </h2>
            <ul className="mt-8 space-y-3">
              {[
                "Job analysis that interprets, not repeats",
                "14 hooks and 8 strategies, matched to the client",
                "Human drafts — no clichés, no 'Dear Hiring Manager'",
              ].map((p) => (
                <li key={p} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-teal/40">
                    <Check className="h-3 w-3 text-teal" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Phase 1 · no email verification required
          </p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <CropCard glow="gold" className="p-7">
            <Eyebrow>{isSignup ? "Create account" : "Welcome back"}</Eyebrow>
            <h1 className="mt-3 font-display text-2xl font-bold text-white">
              {isSignup ? "Start drafting in seconds" : "Log in to your workspace"}
            </h1>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {isSignup && (
                <Field label="Name (optional)">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                />
              </Field>
              {isSignup && (
                <Field label="Confirm password">
                  <Input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </Field>
              )}

              {!isSignup && (
                <button
                  type="button"
                  onClick={forgotPassword}
                  className="text-xs text-muted-foreground transition-colors hover:text-teal"
                >
                  Forgot password?
                </button>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isSignup ? "Create account" : "Log in"}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "New here? "}
              <Link
                to="/auth"
                search={{ mode: isSignup ? "login" : "signup" }}
                className="font-medium text-gold hover:text-gold-bright"
              >
                {isSignup ? "Log in" : "Create one"}
              </Link>
            </p>
          </CropCard>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
