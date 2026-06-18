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

export const CTAS = [
  { id: "soft_availability",   name: "Soft Availability",    description: "Let them know you have a slot open this sprint — creates urgency without pressure." },
  { id: "specific_call",       name: "15-Minute Call",        description: "Ask for a quick alignment call — low-friction, specific ask." },
  { id: "opinion_ask",         name: "Biggest Concern Ask",   description: "Ask what they're most worried about — turns the CTA into a diagnostic." },
  { id: "discovery_question",  name: "Success Question",      description: "Ask what success looks like 90 days after launch — reframes the pitch." },
  { id: "assumption_check",    name: "Assumption Check",      description: "Verify you're solving the right problem before committing — shows seniority." },
  { id: "timeline_ask",        name: "Timeline Reality Check","description": "Ask when they need it live and offer an honest answer — builds instant trust." },
  { id: "proof_offer",         name: "Case Study Offer",      description: "Offer to send a similar case study — gives them a reason to reply." },
  { id: "scope_offer",         name: "Scope Doc Offer",       description: "Offer a detailed scope document by tomorrow — makes the next step feel safe." },
  { id: "loom_offer",          name: "Loom Walkthrough",      description: "Offer a Loom of your phase-1 approach — visual proof without a sales call." },
  { id: "low_risk_next",       name: "No Pressure Reply",     description: "End with a low-friction 'just reply' nudge — removes the commitment barrier." },
  { id: "constraint_reveal",   name: "Constraint Question",   description: "Ask which constraint matters most — timeline, budget, or quality — to show strategic thinking." },
  { id: "urgency_frame",       name: "Cost of Delay",         description: "Name the ongoing cost of leaving the problem unsolved, then ask when they want to start." },
  { id: "soft_close",          name: "Soft Close",            description: "If this resonates, just reply — no long back-and-forth needed to see if it's a fit." },
  { id: "reverse_sell",        name: "Reverse Sell",          description: "Acknowledge they might not need you — makes it safe to respond either way." },
  { id: "challenge_reframe",   name: "Problem First",         description: "Ask one clarifying question before discussing solutions — signals consultative thinking." },
  { id: "shared_risk",         name: "Shared Risk Frame",     description: "Emphasize 10 minutes of scope alignment saves weeks — positions you as the careful one." },
  { id: "social_proof_angle",  name: "Similar Outcome",       description: "Mention a client in a similar situation and offer to share what worked." },
  { id: "sprint_offer",        name: "Focused Sprint",        description: "Offer to carve out a dedicated sprint for this project — makes delivery feel real." },
  { id: "direct_ask",          name: "Direct Ask",            description: "Ask if they're ready to move forward or need more info — respects their time." },
  { id: "curious_ask",         name: "Why Now Question",      description: "Ask what triggered the decision to tackle this now — builds rapport and context." },
] as const;

export type CtaId = (typeof CTAS)[number]["id"];

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
