// Central provider role config — change here to rewire all AI routing globally.
// See ai-gateway.server.ts for the runtime implementation.
export const PROVIDER_ROLES = {
  writer: "anthropic",    // Claude — proposal, strategy, email generation
  verifier: "google",     // Gemini Flash — entity extraction, specificity scoring, similarity
  challenger: "mistral",  // future: cross-provider candidate competition
} as const;

export type ProviderRole = keyof typeof PROVIDER_ROLES;
