// GOLDEN KEYS — framing sentences that set intent/tone rather than prove competence.
//
// A hook proves you understand the client's problem. A Golden Key does something
// different: it frames the READING of the proposal itself — either declaring the
// intent ("by the end of this you'll see…") or defining the frame by contrast
// ("here's what I won't do…"). They are optional: used only when they genuinely
// strengthen a proposal, never by default.
//
// Each key is tagged with a pattern type and the REGISTER it fits (matching
// src/lib/prompts/shared/registers.ts). Engine 4 selects at most one — and only
// when it earns its place — then decides placement (opening frame or closing line).

export type GoldenKeyPattern = "intent_frame" | "contrast_frame";
export type GoldenKeyRegister =
  | "professional_expert"
  | "consultant"
  | "friendly_advisor"
  | "peer";

export type GoldenKey = {
  id: string;
  pattern: GoldenKeyPattern;
  register: GoldenKeyRegister;
  text: string;
};

export const GOLDEN_KEYS: GoldenKey[] = [
  // ── intent_frame: "by the end of this proposal you'll…" ──────────────────────
  {
    id: "intent_value_clarity",
    pattern: "intent_frame",
    register: "consultant",
    text: "By the end of this proposal I hope you'll be able to see, clearly, exactly why this is worth doing and what it changes for you — not just what gets built.",
  },
  {
    id: "intent_confidence_expert",
    pattern: "intent_frame",
    register: "professional_expert",
    text: "By the time you finish reading, you should be able to tell whether I actually understand this problem at the level it needs — that's the only thing this proposal is trying to prove.",
  },
  {
    id: "intent_decision_ease",
    pattern: "intent_frame",
    register: "consultant",
    text: "My goal here is simple: by the end of this, the decision should feel obvious in one direction or the other, because you'll finally be able to see the whole picture.",
  },
  {
    id: "intent_warm_reassure",
    pattern: "intent_frame",
    register: "friendly_advisor",
    text: "By the end of this I want you to feel less alone with this problem — like someone finally gets what you're actually dealing with and has a real plan for it.",
  },
  {
    id: "intent_peer_direct",
    pattern: "intent_frame",
    register: "peer",
    text: "By the end of this you'll know exactly how I'd build this and why — no fluff, just the actual plan.",
  },
  {
    id: "intent_outcome_picture",
    pattern: "intent_frame",
    register: "consultant",
    text: "By the last line, you should be able to picture what your first month after launch actually looks like — that's the lens I want you reading everything below through.",
  },
  {
    id: "intent_trust_earn",
    pattern: "intent_frame",
    register: "friendly_advisor",
    text: "I'm not going to ask you to trust me upfront — by the end of this I'd rather you've simply seen enough thinking to decide that for yourself.",
  },
  {
    id: "intent_expert_standard",
    pattern: "intent_frame",
    register: "professional_expert",
    text: "By the end of this you'll see the standard I hold this kind of work to — and whether that standard is what your project actually needs.",
  },
  {
    id: "intent_peer_shipped",
    pattern: "intent_frame",
    register: "peer",
    text: "By the end of this you'll be able to tell I've shipped this exact kind of thing before — because I'm going to talk about the parts that actually bite, not the easy 80%.",
  },
  {
    id: "intent_value_before_ask",
    pattern: "intent_frame",
    register: "consultant",
    text: "By the end of this proposal I hope you'll be able to see reasons and value that make the price feel like the smallest part of the conversation.",
  },

  // ── contrast_frame: "here's what I won't do… here's what I will" ──────────────
  {
    id: "contrast_no_overpromise",
    pattern: "contrast_frame",
    register: "consultant",
    text: "I'm not going to promise you the moon or bury you in features you'll never use. What I will do is name the one change that moves the needle, and build that first.",
  },
  {
    id: "contrast_no_jargon",
    pattern: "contrast_frame",
    register: "friendly_advisor",
    text: "I won't drown you in technical jargon or make you feel behind. What I will do is walk you through this in plain language, one decision at a time.",
  },
  {
    id: "contrast_no_generic",
    pattern: "contrast_frame",
    register: "professional_expert",
    text: "I'm not going to pitch you a generic package. What I will do is treat your specific constraints as the brief — because that's where this project actually lives or dies.",
  },
  {
    id: "contrast_no_yesman",
    pattern: "contrast_frame",
    register: "consultant",
    text: "I won't just agree with everything and take the order. Where I think the plan should change, I'll tell you why — that's the whole point of hiring someone who's done this before.",
  },
  {
    id: "contrast_no_disappear",
    pattern: "contrast_frame",
    register: "friendly_advisor",
    text: "I won't take the deposit and go quiet on you. What I will do is keep you in the loop at every step, so you always know exactly where things stand.",
  },
  {
    id: "contrast_no_bloat",
    pattern: "contrast_frame",
    register: "peer",
    text: "I'm not going to over-engineer this or pad the timeline. What I will do is ship the smallest thing that actually solves the problem, then iterate.",
  },
  {
    id: "contrast_no_vanity",
    pattern: "contrast_frame",
    register: "professional_expert",
    text: "I won't optimize for what looks impressive in a demo. What I will do is optimize for the number that actually matters to your business, even when it's less flashy.",
  },
  {
    id: "contrast_no_scope_creep",
    pattern: "contrast_frame",
    register: "consultant",
    text: "I'm not going to let this balloon into a project neither of us recognizes in three months. What I will do is hold the scope honestly and phase the rest.",
  },
  {
    id: "contrast_no_hype",
    pattern: "contrast_frame",
    register: "peer",
    text: "I'll skip the hype and the buzzwords. What I will do is tell you what's genuinely hard about this and how I'd handle it.",
  },
  {
    id: "contrast_no_pressure",
    pattern: "contrast_frame",
    register: "friendly_advisor",
    text: "I'm not here to pressure you into a yes. What I will do is give you enough clarity that whatever you decide, it's the right call for you.",
  },
];

export function goldenKeyById(id: string | undefined): GoldenKey | undefined {
  return id ? GOLDEN_KEYS.find((k) => k.id === id) : undefined;
}

// Compact list for prompting — the model picks an id (or none) from this.
export function formatGoldenKeysForPrompt(): string {
  return GOLDEN_KEYS.map(
    (k) => `- ${k.id} [${k.pattern}, ${k.register}]: "${k.text}"`,
  ).join("\n");
}
