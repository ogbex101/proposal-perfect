import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/profile.functions";
import { listSubProfiles, type SubProfile } from "@/lib/sub-profile.functions";

const STORAGE_KEY = "pp_active_sub_profile_id";

export type MergedProfile = {
  id: string;
  email: string | null;
  niche: string | null;
  name: string | null;
  phone: string | null;
  whatsapp: string | null;
  bio: string | null;
  my_story: string | null;
  skills: string[];
  credentials: { title: string; institution: string; year: string }[];
  brands_worked: string[];
  avatar_url: string | null;
  // not affected by sub-profiles
  default_length: string | null;
  default_plan: boolean | null;
};

function mergeWithHead(
  head: Record<string, unknown>,
  sub: SubProfile,
): MergedProfile {
  const skills = sub.skills?.length ? sub.skills : (head.skills as string[] ?? []);
  const credentials = sub.credentials?.length
    ? sub.credentials
    : (head.credentials as { title: string; institution: string; year: string }[] ?? []);
  const brands = sub.brands_worked?.length ? sub.brands_worked : (head.brands_worked as string[] ?? []);
  return {
    id: head.id as string,
    email: sub.email ?? (head.email as string | null),
    niche: sub.niche ?? null,
    name: sub.name ?? (head.name as string | null),
    phone: sub.phone ?? (head.phone as string | null),
    whatsapp: sub.whatsapp ?? (head.whatsapp as string | null),
    bio: sub.bio ?? (head.bio as string | null),
    my_story: sub.my_story ?? (head.my_story as string | null),
    skills,
    credentials,
    brands_worked: brands,
    avatar_url: sub.avatar_url ?? null,
    default_length: head.default_length as string | null,
    default_plan: head.default_plan as boolean | null,
  };
}

export function useActiveProfile() {
  const [activeSubId, setActiveSubIdRaw] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const setActiveSubId = useCallback((id: string | null) => {
    setActiveSubIdRaw(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const headQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });

  const subQuery = useQuery({
    queryKey: ["sub-profiles"],
    queryFn: () => listSubProfiles(),
  });

  const head = headQuery.data?.profile;
  const subs = subQuery.data ?? [];

  // If stored sub-profile no longer exists (deleted), fall back to head
  useEffect(() => {
    if (!activeSubId || !subs.length) return;
    if (!subs.find((s) => s.id === activeSubId)) {
      setActiveSubId(null);
    }
  }, [subs, activeSubId, setActiveSubId]);

  const activeSub = activeSubId ? subs.find((s) => s.id === activeSubId) ?? null : null;

  const merged: MergedProfile | null = head
    ? activeSub
      ? mergeWithHead(head as Record<string, unknown>, activeSub)
      : {
          id: head.id,
          email: head.email ?? null,
          niche: null,
          name: head.name ?? null,
          phone: head.phone ?? null,
          whatsapp: head.whatsapp ?? null,
          bio: head.bio ?? null,
          my_story: head.my_story ?? null,
          skills: (head.skills as string[]) ?? [],
          credentials: (head.credentials as { title: string; institution: string; year: string }[]) ?? [],
          brands_worked: (head.brands_worked as string[]) ?? [],
          avatar_url: head.avatar_url ?? null,
          default_length: head.default_length ?? null,
          default_plan: head.default_plan ?? null,
        }
    : null;

  return {
    merged,
    activeSubId,
    activeSub,
    subs,
    setActiveSubId,
    isLoading: headQuery.isLoading || subQuery.isLoading,
    avatarSignedUrl: headQuery.data?.avatarSignedUrl ?? null,
  };
}
