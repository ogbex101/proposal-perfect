import { useQuery } from "@tanstack/react-query";
import {
  getProfile,
  listCustomHooks,
  listCustomStrategies,
  type CustomHook,
  type CustomStrategy,
  type Credential,
} from "@/lib/profile.functions";
import { HOOKS, STRATEGIES } from "@/lib/proposal-constants";

export type MergedHookOption = {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
};

export type MergedStrategyOption = {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
  });
}

export function useCustomHooks() {
  return useQuery({
    queryKey: ["custom-hooks"],
    queryFn: () => listCustomHooks(),
  });
}

export function useCustomStrategies() {
  return useQuery({
    queryKey: ["custom-strategies"],
    queryFn: () => listCustomStrategies(),
  });
}

/**
 * Returns merged hook options: built-in HOOKS first, then user's custom hooks.
 * Custom entries are prefixed with "★ " in the name and have isCustom=true.
 */
export function useMergedHooks(): MergedHookOption[] {
  const { data: customHooks = [] } = useCustomHooks();
  return [
    ...HOOKS.map((h) => ({ id: h.id, name: h.name, description: h.description, isCustom: false })),
    ...customHooks.map((h: CustomHook) => ({
      id: `custom_hook_${h.id}`,
      name: `★ ${h.name}`,
      description: h.content,
      isCustom: true,
    })),
  ];
}

/**
 * Returns merged strategy options: built-in STRATEGIES first, then user's custom strategies.
 */
export function useMergedStrategies(): MergedStrategyOption[] {
  const { data: customStrategies = [] } = useCustomStrategies();
  return [
    ...STRATEGIES.map((s) => ({ id: s.id, name: s.name, description: s.description, isCustom: false })),
    ...customStrategies.map((s: CustomStrategy) => ({
      id: `custom_strat_${s.id}`,
      name: `★ ${s.name}`,
      description: s.content,
      isCustom: true,
    })),
  ];
}
