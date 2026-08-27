// REGISTERS — the voice a message is written AS.
//
// Register (who is speaking) is distinct from tone dials (how direct / how formal).
// Engine 1 (Client Intelligence) chooses the register from the same job-post signals
// it uses for personality / communication style / hiring maturity, so the choice is
// grounded at the earliest, most evidence-rich stage. It then threads through Engines
// 2–4 and into the final proposal and conversion replies.
export const REGISTERS = [
  {
    id: "professional_expert",
    name: "Professional Expert",
    description:
      "Precise, credential-driven, confident authority. For clients who are technical, sophisticated, or optimizing for certainty and competence over warmth.",
  },
  {
    id: "consultant",
    name: "Strategic Consultant",
    description:
      "Diagnostic, asks sharp questions, reframes the problem before proposing anything. For clients who distrust vendors and want a thinking partner, not an order-taker.",
  },
  {
    id: "friendly_advisor",
    name: "Friendly Advisor",
    description:
      "Warm, plain-spoken, genuinely invested in the outcome. For first-time hirers, founders, nonprofits, or anyone whose post reads anxious, overwhelmed, or personal.",
  },
  {
    id: "peer",
    name: "Peer / Founder-to-Founder",
    description:
      "Direct, informal, speaks as an equal who has shipped similar things. For experienced, casual-toned clients who'll be put off by anything that reads corporate.",
  },
] as const;

export type RegisterId = (typeof REGISTERS)[number]["id"];

// Resolve a register by id, falling back to the friendly advisor as a safe default.
export function resolveRegister(id: string | undefined) {
  return REGISTERS.find((r) => r.id === id) ?? REGISTERS[2];
}
