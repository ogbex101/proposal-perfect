import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { verifyAccessCode } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";

interface AccessGateProps {
  onGranted: () => void;
}

export function AccessGate({ onGranted }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await verifyAccessCode({ data: { code } });
      if (result.success) {
        onGranted();
      } else {
        setError(result.error ?? "Incorrect code.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
            <Lock className="h-5 w-5 text-gold" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Access Required</h1>
          <p className="text-center text-sm text-muted-foreground">
            Enter your access code to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder="Enter access code"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
            autoFocus
            autoComplete="off"
          />

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-gold/20 border border-gold/30 px-4 py-3 text-sm font-medium text-gold hover:bg-gold/30 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>

        <button
          onClick={handleSignOut}
          className="mt-6 w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
