export const HOOKS = [
  { id: "pattern_interrupt", name: "Pattern Interrupt", description: "Open with something the client doesn't expect to break the pitch-scanning autopilot." },
  { id: "curiosity_gap", name: "Curiosity Gap", description: "Tease a specific insight the client will want to know more about." },
  { id: "direct_question", name: "Direct Question", description: "Ask a sharp question that mirrors the real problem they're trying to solve." },
  { id: "warning", name: "Warning", description: "Name a costly mistake their current path is likely to produce." },
  { id: "shared_frustration", name: "Shared Frustration", description: "Acknowledge the annoying thing they've already lived through with other freelancers." },
  { id: "unexpected_compliment", name: "Unexpected Compliment", description: "Notice something specific and real about their business or post." },
  { id: "i_noticed", name: "I Noticed Something", description: "Point out one concrete detail you spotted that proves you actually read it." },
  { id: "contradiction", name: "Contradiction", description: "Gently challenge the framing of the job in a way that earns attention." },
  { id: "future_pacing", name: "Future Pacing", description: "Paint the post-project picture in one vivid line." },
  { id: "humble_observation", name: "Humble Observation", description: "A low-ego note about what's probably going on under the hood." },
  { id: "learn_fast", name: "Learn Fast", description: "Show you've already mapped how to ramp up on their stack quickly." },
  { id: "consequence", name: "Consequence", description: "Name the downstream cost of leaving the problem unsolved." },
  { id: "problem_solution", name: "Problem Solution", description: "State the problem and the exact solution back-to-back in two crisp sentences." },
  { id: "founder", name: "Founder", description: "Speak founder-to-founder about what really matters in shipping this." },
] as const;

export type HookId = (typeof HOOKS)[number]["id"];

export const STRATEGIES = [
  { id: "curious_partner", name: "Curious Partner", description: "Position as a thoughtful collaborator who asks the right questions." },
  { id: "advice_first", name: "Advice First", description: "Lead with one piece of expert advice before pitching anything." },
  { id: "direct_question", name: "Direct Question", description: "Drive the entire proposal around one piercing question." },
  { id: "pattern_interrupt", name: "Pattern Interrupt", description: "Break the proposal pattern entirely — short, sharp, unconventional." },
  { id: "narrow_down_first", name: "Narrow Down First", description: "Tighten scope publicly to show senior-level thinking." },
  { id: "future_pacing", name: "Future Pacing", description: "Walk them through the outcome before talking about the work." },
  { id: "humble_observation", name: "Humble Observation", description: "Low-key technical observation that signals seniority without bragging." },
  { id: "stack_realist", name: "Stack Realist", description: "Get specific about technical realities the client probably hasn't considered." },
] as const;

export type StrategyId = (typeof STRATEGIES)[number]["id"];

export const LENGTHS = [
  { id: "brief", name: "Brief", description: "Under 1500 chars. One paragraph, one question, one CTA. No portfolio.", target: 1200 },
  { id: "robust", name: "Robust", description: "2000-3000 chars. Hook, portfolio, deliverables, advice, question, CTA.", target: 2500 },
  { id: "explanatory", name: "Explanatory", description: "3000-5000 chars. Detailed for technical or high-budget jobs.", target: 4000 },
] as const;

export type LengthId = (typeof LENGTHS)[number]["id"];

export const FORBIDDEN_PHRASES = [
  "Here is what I will do",
  "I have done this before",
  "Let me know if you have any questions",
  "I am passionate about",
  "I am looking forward to hearing from you",
  "I am available for a call",
  "Jump on a call",
  "Dear Hiring Manager",
  "Hi,",
  "Most developers",
];
