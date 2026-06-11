import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  status: "loading" | "in" | "out";
  userId: string | null;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
};

const initial: AuthState = {
  status: "loading",
  userId: null,
  email: null,
  name: null,
  isAdmin: false,
};

/**
 * Client-side session tracker. Auth tokens live in localStorage, so guarding
 * happens on the client (the layout shows a loader until this resolves).
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initial);

  useEffect(() => {
    let active = true;

    async function resolveRole(userId: string) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return (data ?? []).some((r) => r.role === "admin");
    }

    async function apply(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!active) return;
      if (!session?.user) {
        setState({ status: "out", userId: null, email: null, name: null, isAdmin: false });
        return;
      }
      const isAdmin = await resolveRole(session.user.id).catch(() => false);
      if (!active) return;
      setState({
        status: "in",
        userId: session.user.id,
        email: session.user.email ?? null,
        name: (session.user.user_metadata?.name as string) ?? null,
        isAdmin,
      });
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
