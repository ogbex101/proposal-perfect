/**
 * PROPOSAL INTELLIGENCE PIPELINE
 *
 * Four sequential engines that understand the client, the business, the
 * psychology, and the optimal persuasion strategy — BEFORE a single word
 * of the proposal is written.
 *
 * Engine 1 → Client Intelligence (reads raw job post)
 * Engine 2 → Business Intelligence (reads Engine 1 output only)
 * Engine 3 → Client Psychology    (reads Engine 1 + 2 output)
 * Engine 4 → Proposal Blueprint   (reads Engine 1 + 2 + 3 output)
 *
 * No engine re-reads the original job description after Engine 1.
 * Reasoning is cumulative, not repetitive.
 */

import { z } from "zod";
import { generateObjectWithProvider } from "./ai-gateway.server";

// ─── Engine 1 — Client Intelligence ──────────────────────────────────────────

export const ClientIntelligenceSchema = z.object({
  // WHO wrote this
  personality: z.string(),
  writingStyle: z.string(),
  communicationStyle: z.string(),
  experienceLevel: z.enum(["first-time", "occasional", "experienced", "expert"]),
  hiringMaturity: z.enum(["naive", "developing", "mature", "sophisticated"]),
  emotionalState: z.string(),
  hiddenFrustrations: z.array(z.string()),
  hiddenExpectations: z.array(z.string()),
  budgetSensitivity: z.enum(["price-driven", "value-driven", "outcome-driven", "unclear"]),
  riskTolerance: z.enum(["risk-averse", "cautious", "moderate", "risk-tolerant"]),
  decisionStyle: z.string(),

  // Raw extraction from job post (for downstream engines — they do NOT re-read the post)
  projectSummary: z.string(),
  industry: z.string(),
  projectScope: z.string(),
  impliedTimeline: z.string(),
  impliedBudget: z.string(),
  technicalRequirements: z.array(z.string()),
  namedTools: z.array(z.string()),
  namedCompanies: z.array(z.string()),
  explicitSuccessCriteria: z.string(),
  detectedLanguage: z.string(),
  detectedNiche: z.string(),

  // Evidence: exact phrases that led to inferences (never paraphrase — copy verbatim)
  evidenceQuotes: z.array(z.string()),

  // Confidence (0–100 for each inference)
  confidence: z.object({
    personality: z.number(),
    emotionalState: z.number(),
    hiringMaturity: z.number(),
    budgetSensitivity: z.number(),
    overall: z.number(),
  }),
});
export type ClientIntelligence = z.infer<typeof ClientIntelligenceSchema>;

const ENGINE_1_SYSTEM = `You are the Client Intelligence Engine of an AI Proposal Director.

YOUR ONLY JOB: Understand WHO wrote this job post. Not what they need — who they are.

EXTRACT THE PERSON BEHIND THE POST:
- Personality: What kind of person are they? What do they value?
- Writing style: Terse/verbose? Formal/casual? Frustrated/optimistic?
- Communication style: How do they prefer to receive information?
- Experience level: Have they hired freelancers before? How many times?
- Hiring maturity: Do they understand how to scope, brief, and evaluate work?
- Emotional state: What is driving them to post TODAY?
- Hidden frustrations: What has already gone wrong that they haven't said?
- Hidden expectations: What do they assume you'll do that they didn't write down?
- Budget sensitivity: Are they optimizing for price, value, or outcome?
- Risk tolerance: Are they afraid of making the wrong choice?
- Decision style: Will they hire fast or overthink? Solo or committee?

EXAMPLE INFERENCES:
"This website sucks." → values directness over corporate language, frustrated with current state
"I've been burned before." → trust > features, needs reassurance before skills
"I need this ASAP." → speed beats perfection, possibly a reactive buyer
"Looking for a long-term partner." → wants relationship, not transaction
Short post, no details → either expert who trusts their team, or naive first-timer (use other signals to distinguish)
Lots of process details → micro-manager or has been burned by unclear scope

ALSO EXTRACT ALL FACTUAL DATA from the post so downstream engines never need to re-read it:
- Project summary (neutral, no interpretation)
- Industry, project scope, timeline hints, budget hints
- All named tools, platforms, companies, proper nouns
- Explicit success criteria (if any)
- Detected language and freelance niche

EVIDENCE DISCIPLINE:
- Quote exact phrases verbatim in evidenceQuotes — the words that justified each inference
- Lower confidence when the post is short, vague, or ambiguous
- Never assume what isn't evidenced

QUALITY CHECK BEFORE RETURNING:
✓ Could this profile apply to another client? If yes → rewrite.
✓ Am I repeating the job description? If yes → rewrite.
✓ Are my inferences supported by evidence? If not → lower confidence.`;

// ─── Engine 2 — Business Intelligence ────────────────────────────────────────

export const BusinessIntelligenceSchema = z.object({
  industry: z.string(),
  businessModel: z.string(),
  revenueModel: z.string(),
  targetAudience: z.string(),
  valueProposition: z.string(),
  marketPosition: z.string(),
  competitiveLandscape: z.string(),
  businessObjective: z.string(),
  successMetrics: z.array(z.string()),
  customerJourney: z.string(),
  customerEmotions: z.array(z.string()),
  buyingMotivations: z.array(z.string()),
  buyingObjections: z.array(z.string()),

  // The four pillars
  coreBusinessProblem: z.string(),
  businessOpportunity: z.string(),
  businessRisk: z.string(),
  coreBusinessInsight: z.string(),

  // Confidence
  confidence: z.object({
    businessModel: z.number(),
    coreBusinessProblem: z.number(),
    coreBusinessInsight: z.number(),
    overall: z.number(),
  }),
});
export type BusinessIntelligence = z.infer<typeof BusinessIntelligenceSchema>;

const ENGINE_2_SYSTEM = `You are the Business Intelligence Engine of an AI Proposal Director.

You ONLY receive structured output from the Client Intelligence Engine. You do NOT re-read the original job post.

YOUR ONLY JOB: Understand the BUSINESS behind the project.

Think like McKinsey, Bain, and a senior brand strategist combined.

WHAT YOU MUST IDENTIFY:

Business Model: How does this business make money? (even if not stated — infer from industry + scope)
Revenue Model: Subscription, transactional, project-based, ad-supported, services?
Target Audience: Who is the end customer? What do they want?
Value Proposition: What makes this business worth choosing over competitors?
Market Position: Premium, mid-market, budget? Established, growing, struggling?
Competitive Landscape: Who are their real competitors? What does winning look like?
Business Objective: What business outcome does this project serve?
Success Metrics: How will the client know this project succeeded?
Customer Journey: What path does a customer take from discovery to purchase?
Customer Emotions: What does the customer feel at each stage?
Buying Motivations: Why would someone choose THIS business?
Buying Objections: What stops people from choosing them?

THE FOUR PILLARS (most important):
Core Business Problem: The real business problem, not the project request.
  - Redesign request = positioning problem
  - Landing page = conversion problem
  - CMS = scalability/ownership problem
  - Nonprofit = trust/donation problem
  - Video = credibility/attention problem

Business Opportunity: What value could this project unlock if done exceptionally well?
Business Risk: What is the cost of doing this wrong or not at all?
Core Business Insight: One sentence that captures the single most important thing about this business that should shape the entire proposal.

QUALITY CHECK:
✓ Could this analysis apply to another business? If yes → rewrite.
✓ Is the Core Business Insight something the client themselves might not have articulated? Good.
✓ Am I inventing facts not supported by the client intelligence report? Lower confidence.`;

// ─── Engine 3 — Client Psychology ────────────────────────────────────────────

export const ClientPsychologySchema = z.object({
  primaryFear: z.string(),
  primaryDesire: z.string(),
  urgencyDriver: z.string(),
  riskPerception: z.string(),
  trustRequirement: z.string(),
  internalPressure: z.string(),
  emotionalTrigger: z.string(),
  realReasonForHiring: z.string(),

  // The proposal implications
  whatWillMakeThemReply: z.string(),
  whatWillMakeThemIgnore: z.string(),
  whatWillMakeThemHire: z.string(),
  whatWillMakeThemReject: z.string(),

  // Confidence
  confidence: z.object({
    primaryFear: z.number(),
    realReasonForHiring: z.number(),
    trustRequirement: z.number(),
    overall: z.number(),
  }),
});
export type ClientPsychology = z.infer<typeof ClientPsychologySchema>;

const ENGINE_3_SYSTEM = `You are the Client Psychology Engine of an AI Proposal Director.

You receive structured output from Engine 1 (Client Intelligence) and Engine 2 (Business Intelligence). You do NOT re-read the job post.

YOUR ONLY JOB: Understand WHY the client is actually hiring someone.

The stated reason is never the real reason. Dig beneath the surface.

WHAT YOU MUST IDENTIFY:

Primary Fear: What is the client most afraid of getting wrong?
Primary Desire: What does a perfect outcome feel like to them emotionally?
Urgency Driver: What made them post THIS WEEK rather than last month?
Risk Perception: What do they think could go wrong? What's their nightmare scenario?
Trust Requirement: What do they need to believe before they hire anyone?
Internal Pressure: What external or internal force is creating this pressure? (boss, competitor, launch date, investor, embarrassment)
Emotional Trigger: What one thing in a proposal would make them feel "this is the one"?
Real Reason For Hiring: The honest, un-stated reason beneath the stated request.

EXAMPLES OF REAL REASONS:
Client requests: SEO work
Real reason: "I'm terrified that I'm invisible online while my competitors grow."

Client requests: Website redesign
Real reason: "I'm embarrassed to send prospects to my current site. It doesn't reflect who I've become."

Client requests: Marketing video
Real reason: "I only have 30 seconds to impress someone and I'm wasting them."

Client requests: E-commerce development
Real reason: "I've been leaving money on the table for 2 years and I know it."

PROPOSAL IMPLICATIONS (critical):
What will make them reply? (The thing that breaks through their guard)
What will make them ignore? (The generic signal that confirms freelancer-ness)
What will make them hire? (The moment they feel safe enough to choose)
What will make them reject? (The specific type of response they've seen too many times)

QUALITY CHECK:
✓ Am I simply restating the pain points? If yes → go deeper.
✓ Does this psychology feel specific to this human? If not → rewrite.
✓ Would this insight surprise the client slightly? Good — that means it's real.`;

// ─── Engine 4 — Proposal Blueprint ───────────────────────────────────────────

const PROPOSAL_STRATEGIES = [
  "business", "technical", "vision", "risk-reversal", "future-vision",
  "question", "story", "authority", "consultative", "challenge",
] as const;

export const ProposalBlueprintSchema = z.object({
  primaryStrategy: z.enum(PROPOSAL_STRATEGIES),
  strategyRationale: z.string(),

  // The four sections
  openingStrategy: z.string(),
  openingLine: z.string(),       // ready-to-use, specific to this job
  proofStrategy: z.string(),
  bodyStrategy: z.string(),
  closingStrategy: z.string(),
  ctaStrategy: z.string(),
  ctaLine: z.string(),           // ready-to-use, must end with "?"

  // Mandate
  proposalMandates: z.array(z.string()),   // non-negotiable things this proposal MUST do
  forbiddenApproaches: z.array(z.string()), // specific things that would doom this proposal

  // Hook + CTA mapping (for UI compatibility with static lists)
  mappedHookId: z.string(),       // closest matching static hook ID
  mappedStrategyId: z.string(),   // closest matching static strategy ID
  mappedCtaId: z.string(),        // closest matching static CTA ID

  // Confidence
  confidence: z.object({
    strategy: z.number(),
    openingLine: z.number(),
    ctaLine: z.number(),
    overall: z.number(),
  }),
});
export type ProposalBlueprint = z.infer<typeof ProposalBlueprintSchema>;

const ENGINE_4_SYSTEM = `You are the Proposal Strategist Engine of an AI Proposal Director.

You receive structured output from all three prior engines. You do NOT re-read the job post.

YOUR ONLY JOB: Design the optimal persuasion architecture for this specific client.

Never use static formulas. Every strategy must be generated from scratch based on the intelligence reports.

CHOOSE ONE PRIMARY STRATEGY:

business — Lead with the business outcome, not the deliverable. For founders who think in results.
technical — Lead with a technical insight that proves deep domain expertise. For clients who are technical themselves.
vision — Paint the post-project future vividly before discussing execution. For clients driven by aspiration.
risk-reversal — Acknowledge and neutralize the client's primary fear before anything else. For clients who've been burned.
future-vision — Show them what's possible at a level they haven't yet imagined. For ambitious clients held back by limited thinking.
question — Open with the most penetrating question that names their real problem. For clients who value thinking over pitching.
story — Use a parallel client story to make the outcome feel real and proven. For clients who need social proof.
authority — Lead with the specific domain credential that makes you the obvious choice. For clients who optimize for certainty.
consultative — Position the proposal as the beginning of a diagnostic conversation. For clients who distrust vendors and trust advisors.
challenge — Respectfully challenge their framing or assumption before proposing anything. For sophisticated clients who respect intellectual courage.

CHOOSE BASED ON:
- Client's risk tolerance and hiring maturity
- Primary fear and trust requirements
- Business context and stakes
- What has the highest probability of reply from this specific human

THEN DESIGN ALL FOUR SECTIONS:

Opening Strategy: What psychological state does the first paragraph need to create?
Opening Line: Write the ACTUAL opening sentence(s) — specific, ready to paste. Never start with "I".

Proof Strategy: What type of proof does THIS client most need to see?
Body Strategy: How does the middle section build from opening to close?
Closing Strategy: What does the final paragraph need to accomplish?
CTA Strategy: What does the call-to-action need to do psychologically?
CTA Line: Write the ACTUAL closing question — specific, must end with "?". Never a statement.

PROPOSAL MANDATES: 3–5 non-negotiable things this proposal MUST accomplish.
FORBIDDEN APPROACHES: 3–5 specific things that would destroy this proposal's chances.

HOOK/STRATEGY/CTA MAPPING:
Also select the closest matching IDs from these static lists for UI compatibility:

Hook IDs: pattern_interrupt, curiosity_gap, direct_question, warning, shared_frustration, unexpected_compliment, i_noticed, contradiction, future_pacing, humble_observation, learn_fast, consequence, problem_solution, founder
Strategy IDs: curious_partner, authority_proof, outcome_mirror, risk_reversal, brief_bullet, storyteller, consultant, challenger, minimal_bidder, social_proof
CTA IDs: soft_availability, direct_ask, conditional_offer, question_cta, urgency_cta, next_step_offer, value_first, social_proof_cta

QUALITY CHECK:
✓ Could this blueprint apply to a different client? If yes → rewrite.
✓ Does the opening line feel unmistakably written for this exact job? If not → rewrite.
✓ Does the CTA end with "?"? If not → it is wrong.
✓ Does the strategy emerge from the psychology report? If not → it is wrong.`;

// ─── Combined Intelligence Object ─────────────────────────────────────────────

export type ProposalIntelligenceObject = {
  clientIntelligence: ClientIntelligence;
  businessIntelligence: BusinessIntelligence;
  psychology: ClientPsychology;
  proposalBlueprint: ProposalBlueprint;
  overallConfidence: number;
  requiresHumanReview: boolean;
  generatedAt: string;
};

// ─── Formatting helpers (for passing structured output between engines) ────────

function formatClientIntelligenceForEngine2(ci: ClientIntelligence): string {
  return `CLIENT INTELLIGENCE REPORT

PERSON PROFILE:
- Personality: ${ci.personality}
- Writing Style: ${ci.writingStyle}
- Communication Style: ${ci.communicationStyle}
- Experience Level: ${ci.experienceLevel}
- Hiring Maturity: ${ci.hiringMaturity}
- Emotional State: ${ci.emotionalState}
- Budget Sensitivity: ${ci.budgetSensitivity}
- Risk Tolerance: ${ci.riskTolerance}
- Decision Style: ${ci.decisionStyle}

HIDDEN FRUSTRATIONS: ${ci.hiddenFrustrations.join(" | ")}
HIDDEN EXPECTATIONS: ${ci.hiddenExpectations.join(" | ")}

PROJECT DATA (extracted from job post):
- Summary: ${ci.projectSummary}
- Industry: ${ci.industry}
- Scope: ${ci.projectScope}
- Timeline: ${ci.impliedTimeline}
- Budget: ${ci.impliedBudget}
- Technical Requirements: ${ci.technicalRequirements.join(", ")}
- Named Tools: ${ci.namedTools.join(", ")}
- Named Companies: ${ci.namedCompanies.join(", ")}
- Success Criteria: ${ci.explicitSuccessCriteria}
- Niche: ${ci.detectedNiche}

EVIDENCE QUOTES (verbatim from job post):
${ci.evidenceQuotes.map((q) => `"${q}"`).join("\n")}

CONFIDENCE: ${ci.confidence.overall}/100`;
}

function formatForEngine3(ci: ClientIntelligence, bi: BusinessIntelligence): string {
  return `${formatClientIntelligenceForEngine2(ci)}

---

BUSINESS INTELLIGENCE REPORT

- Industry: ${bi.industry}
- Business Model: ${bi.businessModel}
- Revenue Model: ${bi.revenueModel}
- Target Audience: ${bi.targetAudience}
- Market Position: ${bi.marketPosition}
- Business Objective: ${bi.businessObjective}
- Success Metrics: ${bi.successMetrics.join(", ")}
- Customer Emotions: ${bi.customerEmotions.join(", ")}
- Buying Motivations: ${bi.buyingMotivations.join(" | ")}
- Buying Objections: ${bi.buyingObjections.join(" | ")}

CORE BUSINESS PROBLEM: ${bi.coreBusinessProblem}
BUSINESS OPPORTUNITY: ${bi.businessOpportunity}
BUSINESS RISK: ${bi.businessRisk}
CORE BUSINESS INSIGHT: ${bi.coreBusinessInsight}

CONFIDENCE: ${bi.confidence.overall}/100`;
}

function formatForEngine4(
  ci: ClientIntelligence,
  bi: BusinessIntelligence,
  ps: ClientPsychology,
): string {
  return `${formatForEngine3(ci, bi)}

---

PSYCHOLOGY REPORT

- Primary Fear: ${ps.primaryFear}
- Primary Desire: ${ps.primaryDesire}
- Urgency Driver: ${ps.urgencyDriver}
- Risk Perception: ${ps.riskPerception}
- Trust Requirement: ${ps.trustRequirement}
- Internal Pressure: ${ps.internalPressure}
- Emotional Trigger: ${ps.emotionalTrigger}
- Real Reason For Hiring: ${ps.realReasonForHiring}

PROPOSAL IMPLICATIONS:
- What will make them REPLY: ${ps.whatWillMakeThemReply}
- What will make them IGNORE: ${ps.whatWillMakeThemIgnore}
- What will make them HIRE: ${ps.whatWillMakeThemHire}
- What will make them REJECT: ${ps.whatWillMakeThemReject}

CONFIDENCE: ${ps.confidence.overall}/100`;
}

// ─── Main pipeline runner ─────────────────────────────────────────────────────

export async function runProposalIntelligencePipeline(
  jobDescription: string,
): Promise<ProposalIntelligenceObject> {
  // Engine 1 — Client Intelligence (only engine that reads the job post)
  const clientIntelligence = await generateObjectWithProvider("analyzer", {
    schema: ClientIntelligenceSchema,
    system: ENGINE_1_SYSTEM,
    prompt: `Analyze this job post and produce the Client Intelligence Report:\n\n${jobDescription}`,
  });

  // Engine 2 — Business Intelligence (reads Engine 1 output only)
  const businessIntelligence = await generateObjectWithProvider("analyzer", {
    schema: BusinessIntelligenceSchema,
    system: ENGINE_2_SYSTEM,
    prompt: `Produce the Business Intelligence Report from this Client Intelligence Report:\n\n${formatClientIntelligenceForEngine2(clientIntelligence)}`,
  });

  // Engine 3 — Client Psychology (reads Engines 1 + 2)
  const psychology = await generateObjectWithProvider("writer", {
    schema: ClientPsychologySchema,
    system: ENGINE_3_SYSTEM,
    prompt: `Produce the Psychology Report from these intelligence reports:\n\n${formatForEngine3(clientIntelligence, businessIntelligence)}`,
  });

  // Engine 4 — Proposal Blueprint (reads Engines 1 + 2 + 3)
  const proposalBlueprint = await generateObjectWithProvider("writer", {
    schema: ProposalBlueprintSchema,
    system: ENGINE_4_SYSTEM,
    prompt: `Design the Proposal Blueprint from these intelligence reports:\n\n${formatForEngine4(clientIntelligence, businessIntelligence, psychology)}`,
  });

  const overallConfidence = Math.round(
    (clientIntelligence.confidence.overall +
      businessIntelligence.confidence.overall +
      psychology.confidence.overall +
      proposalBlueprint.confidence.overall) /
      4,
  );

  return {
    clientIntelligence,
    businessIntelligence,
    psychology,
    proposalBlueprint,
    overallConfidence,
    requiresHumanReview: overallConfidence < 75,
    generatedAt: new Date().toISOString(),
  };
}
