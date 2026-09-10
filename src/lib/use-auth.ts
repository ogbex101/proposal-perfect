import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = {
  status: "loading" | "in" | "out";
  userId: string | null;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  hasAccess: boolean;
};

const initial: AuthState = {
  status: "loading",
  userId: null,
  email: null,
  name: null,
  isAdmin: false,
  hasAccess: false,
};

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

    async function resolveAccess(userId: string) {
      const { data } = await (supabase as any)
        .from("user_access")
        .select("verified_at")
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    }


    async function apply(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (!active) return;
      if (!session?.user) {
        setState({ status: "out", userId: null, email: null, name: null, isAdmin: false, hasAccess: false });
        return;
      }
      const [isAdmin, hasAccess] = await Promise.all([
        resolveRole(session.user.id).catch(() => false),
        resolveAccess(session.user.id).catch(() => false),
      ]);
      if (!active) return;
      setState({
        status: "in",
        userId: session.user.id,
        email: session.user.email ?? null,
        name: (session.user.user_metadata?.name as string) ?? null,
        isAdmin,
        hasAccess,
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
