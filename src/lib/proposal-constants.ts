export const HOOKS = [
  {
    id: "pattern_interrupt",
    name: "Pattern Interrupt",
    description: "Open with something so unexpected the client stops scrolling — a counter-intuitive observation, a bold reframe, or a claim they didn't expect from a freelancer. Break the autopilot scan.",
  },
  {
    id: "curiosity_gap",
    name: "Curiosity Gap",
    description: "Tease one specific insight the client will want badly enough to keep reading. Reveal just enough to make ignoring it impossible — not a vague tease, a genuinely specific thing.",
  },
  {
    id: "direct_question",
    name: "Direct Question",
    description: "Open with the sharpest question that names the client's actual unstated problem — not what they asked for, but what they're truly trying to solve. Must hit so precisely they think 'yes, that's exactly it.'",
  },
  {
    id: "warning",
    name: "Red Flag Warning",
    description: "Name the specific costly mistake their current approach or job framing is heading toward — something they haven't considered and can't unsee once they read it.",
  },
  {
    id: "shared_frustration",
    name: "Shared Frustration",
    description: "Name the exact frustrating experience they've already had with other freelancers on this type of work — prove you've seen this pattern before and know exactly how it ends.",
  },
  {
    id: "unexpected_compliment",
    name: "Unexpected Compliment",
    description: "Notice one genuinely specific and impressive thing about their business or post that most applicants would overlook. It must be real, not flattery — the specificity IS the credibility.",
  },
  {
    id: "i_noticed",
    name: "Sharp Observation",
    description: "Point out one concrete, non-obvious detail from their job post that proves you actually read it deeply and thought about it — the kind of thing only someone truly engaged would catch.",
  },
  {
    id: "contradiction",
    name: "Productive Contradiction",
    description: "Gently challenge the assumption behind how they framed the job — in a way that makes them think 'this person understands my situation at a deeper level than even I do.'",
  },
  {
    id: "future_pacing",
    name: "Future Pacing",
    description: "Drop the reader into the post-project moment before saying anything about yourself. Make the outcome so vivid and specific that hiring you feels like the obvious next step.",
  },
  {
    id: "humble_observation",
    name: "Quiet Expert",
    description: "Make one understated but precise technical or strategic observation that only someone who has done this exact work many times would notice. No bragging — just the quiet confidence of earned expertise.",
  },
  {
    id: "learn_fast",
    name: "Ramp-Up Proof",
    description: "Show concretely how fast you can map their specific stack or domain — not 'I learn fast' but a specific signal that the ramp-up cost for this particular job is near zero.",
  },
  {
    id: "consequence",
    name: "Cost of Inaction",
    description: "Name the specific downstream cost — in revenue, time, user trust, or opportunity — of leaving this exact problem unsolved for another 30, 60, or 90 days.",
  },
  {
    id: "problem_solution",
    name: "Problem → Solution",
    description: "State their exact problem and your specific solution in two crisp back-to-back sentences. Zero setup, zero fluff — maximum signal density in the first two lines.",
  },
  {
    id: "founder",
    name: "Founder Mode",
    description: "Speak directly to what it feels like to ship something that matters — acknowledge the real stakes of their project from a builder's perspective, not a vendor's.",
  },
] as const;

export type HookId = (typeof HOOKS)[number]["id"];

// Engine 4 (proposal-intelligence.ts) chooses mappedStrategyId from this exact list.
// These IDs are the single source of truth — ENGINE_4_SYSTEM must mirror them character-for-character.
export const STRATEGIES = [
  {
    id: "curious_partner",
    name: "Curious Partner",
    description: "Frame the entire proposal as ongoing discovery — ask more questions than you make claims. Position yourself as a thinking partner invested in the outcome, not a vendor pitching hours.",
  },
  {
    id: "authority_proof",
    name: "Authority & Proof",
    description: "Lead with the specific domain credential, result, or track record that makes you the obvious low-risk choice. For clients optimizing for certainty and competence over warmth.",
  },
  {
    id: "outcome_mirror",
    name: "Outcome Mirror",
    description: "Reflect the finished result back to the client vividly before discussing any of the work — mirror the post-project world they're actually buying. For clients driven by the outcome, not the process.",
  },
  {
    id: "risk_reversal",
    name: "Risk Reversal",
    description: "Acknowledge and neutralize the client's primary fear before proposing anything. For clients who've been burned before.",
  },
  {
    id: "brief_bullet",
    name: "Brief & Bulleted",
    description: "Strip everything to the essential signal — short, scannable, structurally different from the wall-of-text pitches they'll skim past. For busy clients who reward clarity and confidence.",
  },
  {
    id: "storyteller",
    name: "Storyteller",
    description: "Use a short, parallel client story to make the outcome feel real and already-proven. For clients who trust demonstrated experience over claims.",
  },
  {
    id: "consultant",
    name: "Strategic Consultant",
    description: "Diagnose before prescribing — reframe the real problem and show your thinking before proposing a solution. For clients who distrust vendors and want a thinking partner, not an order-taker.",
  },
  {
    id: "challenger",
    name: "Respectful Challenger",
    description: "Respectfully challenge the assumption behind how they framed the job, then propose a sharper path. For sophisticated clients who respect intellectual courage.",
  },
  {
    id: "minimal_bidder",
    name: "Minimal & Direct",
    description: "One tight problem→solution statement with zero fluff and maximum signal density. For clients who've read fifty proposals today and just want the truth fast.",
  },
  {
    id: "social_proof",
    name: "Social Proof",
    description: "Anchor the whole proposal in comparable results you've delivered for similar clients. For clients who need to see it's worked before they'll commit.",
  },
] as const;

export type StrategyId = (typeof STRATEGIES)[number]["id"];

export const LENGTHS = [
  { id: "brief", name: "Brief", description: "Under 1500 chars. One paragraph, one question, one CTA. No portfolio.", target: 1200 },
  { id: "robust", name: "Robust", description: "2000-3000 chars. Hook, portfolio, deliverables, advice, question, CTA.", target: 2500 },
  { id: "explanatory", name: "Explanatory", description: "3000-5000 chars. Detailed for technical or high-budget jobs.", target: 4000 },
] as const;

export type LengthId = (typeof LENGTHS)[number]["id"];

// Every CTA must end as either a QUESTION the client wants to answer, or a SPECIFIC SUGGESTION with a concrete next step.
// No passive closes, no "let me know", no "feel free to reach out".
export const CTAS = [
  {
    id: "soft_availability",
    name: "Slot Availability",
    description: "Mention a specific window you have open this week — then ask if that timing works: 'I have a slot open Thursday — does that work for a quick kick-off?' Urgency through scarcity, not pressure.",
  },
  {
    id: "specific_call",
    name: "15-Minute Alignment",
    description: "Ask for a specific short call: 'I have 15 minutes Tuesday or Wednesday — want to use it to walk through the first phase together?' Low friction, high signal — always ends as a question.",
  },
  {
    id: "opinion_ask",
    name: "Biggest Concern Question",
    description: "Ask what they're most worried about with this project: 'What's the one thing keeping you up about this build?' Makes replying feel useful, not just polite.",
  },
  {
    id: "discovery_question",
    name: "Success Definition",
    description: "Ask what success looks like 90 days after launch — in business terms, not feature terms: 'What does a win actually look like for you, three months from now?' Always a question.",
  },
  {
    id: "assumption_check",
    name: "Assumption Check",
    description: "Ask them to confirm or correct your biggest assumption: 'Am I right that the real priority here is [X] rather than [Y]?' Shows rigor and invites genuine engagement.",
  },
  {
    id: "timeline_ask",
    name: "Timeline Reality Check",
    description: "Ask about the deadline and what's driving it: 'When do you need this live, and what's behind that date? That shapes how I'd phase everything.' Always specific, always a question.",
  },
  {
    id: "proof_offer",
    name: "Case Study Offer",
    description: "Offer to send one specific relevant case study: 'I have a case study from a [similar type of client] who went through this exact problem — want me to send it over?'",
  },
  {
    id: "scope_offer",
    name: "Scope Doc Offer",
    description: "Offer a clear scope breakdown by tomorrow: 'I can draft a scope doc by tomorrow morning so you see exactly what's included before deciding.' Specific, low-friction, concrete.",
  },
  {
    id: "loom_offer",
    name: "Loom Walkthrough",
    description: "Offer a 3-minute Loom of your approach: 'I can record a quick Loom walking through how I'd attack the first week — want me to send that over?' Concrete offer, ends with a question.",
  },
  {
    id: "low_risk_next",
    name: "No-Pressure Reply",
    description: "End with a question that's genuinely easy to answer: 'Does the approach I described make sense for what you're trying to do?' Invites a real reply, not a commitment.",
  },
  {
    id: "constraint_reveal",
    name: "Constraint Question",
    description: "Ask which constraint matters most: 'Which is the bigger priority — hitting the timeline, staying under budget, or getting the full feature set in v1?' Forces a useful, specific reply.",
  },
  {
    id: "urgency_frame",
    name: "Cost of Delay",
    description: "Name one specific ongoing cost of waiting — then ask: 'How long has this been on the backlog?' Makes them confront the cost themselves, without pressure.",
  },
  {
    id: "challenge_reframe",
    name: "Clarifying Question",
    description: "Ask the one question that changes how you'd approach the project: 'Before I outline anything further — is the goal to improve the existing flow, or rebuild it from scratch?' Always a direct question.",
  },
  {
    id: "shared_risk",
    name: "Scope Alignment Ask",
    description: "Ask for 10 minutes to align on scope before anything else: 'Even a quick scope call would save us both weeks of back-and-forth. Are you free for 10 minutes this week?'",
  },
  {
    id: "social_proof_angle",
    name: "Parallel Outcome",
    description: "Mention a similar client's result, then ask if it applies: 'A client in a similar position got [result] in [timeframe]. Is that the kind of outcome you're aiming for?'",
  },
  {
    id: "sprint_offer",
    name: "Focused Sprint",
    description: "Offer a dedicated sprint block: 'I can block off a focused week starting [day] — want to lock in that slot before I confirm other work?' Specific, creates real urgency.",
  },
  {
    id: "direct_ask",
    name: "Ready to Move?",
    description: "Ask directly if they're ready or what they need first: 'Are you ready to kick this off, or is there something specific you'd want to see before deciding?' Respects their time, demands a real answer.",
  },
  {
    id: "curious_ask",
    name: "Why Now Question",
    description: "Ask what triggered the decision to tackle this now: 'What made this the right time to finally move on this?' Builds genuine rapport and surfaces context you can use in your reply.",
  },
  {
    id: "conditional_offer",
    name: "Conditional Offer",
    description: "Make the next step conditional on a fact you want confirmed: 'If your Stripe integration is already live, I can have the checkout flow rebuilt in a week — is it live yet?' The condition itself is a qualifying question.",
  },
  {
    id: "value_first",
    name: "Value-First Close",
    description: "Hand over one genuinely useful, specific insight or quick idea in the close — then ask a light question: 'One quick idea: [specific tip]. Would it help if I mapped out how that'd work for your setup?' The free value earns the reply.",
  },
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
