import { generateObjectWithProvider } from "./ai-gateway.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─── Engine 0 — Opportunity Qualification ────────────────────────────────────

const QualificationSchema = z.object({
  prospectScore: z.number(),
  redesignImpact: z.enum(["Low", "Medium", "High"]),
  outreachPriority: z.enum(["A", "B", "C"]),
  worthProspecting: z.boolean(),
  currentWebsiteQuality: z.enum(["Poor", "Average", "Good", "Excellent"]),
  primaryOpportunity: z.enum([
    "Visual Redesign",
    "Messaging",
    "Branding",
    "SEO",
    "Performance",
    "UX",
    "Conversion",
  ]),
  reasoning: z.string(),
  assumptions: z.array(z.string()),
  confidenceScore: z.number(),
});
export type QualificationType = z.infer<typeof QualificationSchema>;

// ─── Engine 1 — Business Intelligence ────────────────────────────────────────

const BusinessIntelSchema = z.object({
  industry: z.string(),
  businessModel: z.string(),
  revenueModel: z.string(),
  audience: z.string(),
  customerPsychology: z.string(),
  emotionalDrivers: z.array(z.string()),
  buyingMotivations: z.array(z.string()),
  buyingObjections: z.array(z.string()),
  trustRequirements: z.array(z.string()),
  positioning: z.string(),
  pricingLevel: z.enum(["Budget", "Mid-market", "Premium", "Luxury", "Enterprise"]),
  brandPersonality: z.string(),
  competitiveAdvantages: z.array(z.string()),
  conversionGoals: z.string(),
  businessGoals: z.string(),
  coreBusinessInsight: z.string(),
  biggestConversionBottleneck: z.string(),
  biggestTrustBottleneck: z.string(),
  biggestPerceptionBottleneck: z.string(),
  reasoning: z.string(),
  assumptions: z.array(z.string()),
  confidenceScore: z.number(),
});
export type BusinessIntelType = z.infer<typeof BusinessIntelSchema>;

// ─── Engine 2 — UX Psychology ────────────────────────────────────────────────

const UXPsychologySchema = z.object({
  readingFlow: z.string(),
  eyeMovementAnalysis: z.string(),
  cognitiveLoad: z.string(),
  attentionFlow: z.string(),
  trustProgression: z.string(),
  emotionalJourney: z.string(),
  ctaHierarchy: z.string(),
  informationHierarchy: z.string(),
  userFriction: z.array(z.string()),
  userUncertainty: z.array(z.string()),
  psychologicalInsight: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type UXPsychologyType = z.infer<typeof UXPsychologySchema>;

// ─── Engine 3 — Creative Director ────────────────────────────────────────────

const CreativeDirectorSchema = z.object({
  redesignPhilosophy: z.enum([
    "Preserved",
    "Refreshed",
    "Modernized",
    "Elevated",
    "Repositioned",
    "Completely Redesigned",
  ]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  designObjective: z.string(),
  brandDirection: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type CreativeDirectorType = z.infer<typeof CreativeDirectorSchema>;

// ─── Engine 4 — Motion Director ──────────────────────────────────────────────

const MotionDirectorSchema = z.object({
  currentMotionAssessment: z.string(),
  psychologicalImpact: z.string(),
  motionStrengthensPositioning: z.boolean(),
  animationPhilosophy: z.string(),
  recommendations: z.array(z.string()),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type MotionDirectorType = z.infer<typeof MotionDirectorSchema>;

// ─── Engine 5 — Design System Architect ──────────────────────────────────────

const DesignSystemSchema = z.object({
  layout: z.string(),
  grid: z.string(),
  typography: z.string(),
  colorSystem: z.string(),
  spacing: z.string(),
  components: z.string(),
  photography: z.string(),
  accessibility: z.string(),
  responsiveBehaviour: z.string(),
  tokenSummary: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type DesignSystemType = z.infer<typeof DesignSystemSchema>;

// ─── Engine 6 — Competitive Intelligence ─────────────────────────────────────

const CompetitiveIntelSchema = z.object({
  identifiedCompetitors: z.array(z.string()),
  competitiveGaps: z.array(z.string()),
  opportunities: z.array(z.string()),
  differentiators: z.array(z.string()),
  luxuryPerceptionGap: z.string(),
  messagingOpportunity: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type CompetitiveIntelType = z.infer<typeof CompetitiveIntelSchema>;

// ─── Engine 7 — Decision Engine ──────────────────────────────────────────────

const SectionDecisionSchema = z.object({
  section: z.string(),
  recommendation: z.enum(["Preserve", "Improve", "Modernize", "Replace", "Redesign"]),
  reason: z.string(),
});
export type SectionDecisionType = z.infer<typeof SectionDecisionSchema>;

const DecisionEngineSchema = z.object({
  singleBiggestImpactChange: z.string(),
  sectionDecisions: z.array(SectionDecisionSchema).default([]),
  whatShouldChange: z.array(z.string()),
  whatShouldNeverChange: z.array(z.string()),
  biggestROI: z.string(),
  lowestEffortHighestImpact: z.string(),
  changesClientWouldApprove: z.array(z.string()),
  redesignStrategy: z.string(),
  priorityMatrix: z.string(),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type DecisionEngineType = z.infer<typeof DecisionEngineSchema>;

// ─── Engine 8 — Lovable Creative Brief ───────────────────────────────────────

const LovableBriefSchema = z.object({
  creativeBrief: z.string(),
  confidenceScore: z.number(),
});
export type LovableBriefType = z.infer<typeof LovableBriefSchema>;

// ─── Engine 9 — Outreach Engine ──────────────────────────────────────────────

const OutreachEmailSchema = z.object({
  style: z.enum(["Friendly", "Consultative", "Founder-to-Founder"]),
  subjectLine: z.string(),
  body: z.string(),
  cta: z.string(),
});
export type OutreachEmailType = z.infer<typeof OutreachEmailSchema>;

const OutreachEngineSchema = z.object({
  subjectLines: z.array(z.string()).length(3),
  hooks: z.array(z.string()).length(3),
  emailBody: z.string(),
  cta: z.string(),
  emails: z.array(OutreachEmailSchema).default([]),
  spamAvoidanceTips: z.array(z.string()),
  reasoning: z.string(),
  confidenceScore: z.number(),
});
export type OutreachEngineType = z.infer<typeof OutreachEngineSchema>;

// ─── Engine 10 — Agency Review ───────────────────────────────────────────────

const AgencyReviewSchema = z.object({
  creativeDirFeedback: z.string(),
  brandStrategistFeedback: z.string(),
  uxDirectorFeedback: z.string(),
  motionDirectorFeedback: z.string(),
  conversionSpecialistFeedback: z.string(),
  overallApproval: z.boolean(),
  revisionsRequired: z.array(z.string()),
  finalNotes: z.string(),
});
export type AgencyReviewType = z.infer<typeof AgencyReviewSchema>;

// ─── Combined result type ─────────────────────────────────────────────────────

export type ScoutPipelineResult = {
  qualification: QualificationType;
  businessIntelligence?: BusinessIntelType;
  uxPsychology?: UXPsychologyType;
  creativeDirection?: CreativeDirectorType;
  motionAnalysis?: MotionDirectorType;
  designSystem?: DesignSystemType;
  competitiveIntelligence?: CompetitiveIntelType;
  decisionEngine?: DecisionEngineType;
  lovablePrompt?: LovableBriefType;
  outreach?: OutreachEngineType;
  agencyReview?: AgencyReviewType;
};

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function formatQualification(q: QualificationType): string {
  return `
OPPORTUNITY QUALIFICATION
  Prospect Score: ${q.prospectScore}
  Redesign Impact: ${q.redesignImpact}
  Outreach Priority: ${q.outreachPriority}
  Worth Prospecting: ${q.worthProspecting}
  Current Website Quality: ${q.currentWebsiteQuality}
  Primary Opportunity: ${q.primaryOpportunity}
  Reasoning: ${q.reasoning}
  Assumptions: ${q.assumptions.join("; ")}
  Confidence: ${q.confidenceScore}
`.trim();
}

function formatBusinessIntel(b: BusinessIntelType): string {
  return `
BUSINESS INTELLIGENCE
  Industry: ${b.industry}
  Business Model: ${b.businessModel}
  Revenue Model: ${b.revenueModel}
  Target Audience: ${b.audience}
  Customer Psychology: ${b.customerPsychology}
  Emotional Drivers: ${b.emotionalDrivers.join(", ")}
  Buying Motivations: ${b.buyingMotivations.join(", ")}
  Buying Objections: ${b.buyingObjections.join(", ")}
  Trust Requirements: ${b.trustRequirements.join(", ")}
  Positioning: ${b.positioning}
  Pricing Level: ${b.pricingLevel}
  Brand Personality: ${b.brandPersonality}
  Competitive Advantages: ${b.competitiveAdvantages.join(", ")}
  Conversion Goals: ${b.conversionGoals}
  Business Goals: ${b.businessGoals}
  Core Business Insight: ${b.coreBusinessInsight}
  Biggest Conversion Bottleneck: ${b.biggestConversionBottleneck}
  Biggest Trust Bottleneck: ${b.biggestTrustBottleneck}
  Biggest Perception Bottleneck: ${b.biggestPerceptionBottleneck}
  Reasoning: ${b.reasoning}
  Assumptions: ${b.assumptions.join("; ")}
  Confidence: ${b.confidenceScore}
`.trim();
}

function formatUXPsychology(u: UXPsychologyType): string {
  return `
UX PSYCHOLOGY ANALYSIS
  Reading Flow: ${u.readingFlow}
  Eye Movement Analysis: ${u.eyeMovementAnalysis}
  Cognitive Load: ${u.cognitiveLoad}
  Attention Flow: ${u.attentionFlow}
  Trust Progression: ${u.trustProgression}
  Emotional Journey: ${u.emotionalJourney}
  CTA Hierarchy: ${u.ctaHierarchy}
  Information Hierarchy: ${u.informationHierarchy}
  User Friction Points: ${u.userFriction.join(", ")}
  User Uncertainty Areas: ${u.userUncertainty.join(", ")}
  Core Psychological Insight: ${u.psychologicalInsight}
  Confidence: ${u.confidenceScore}
`.trim();
}

function formatCreativeDirector(c: CreativeDirectorType): string {
  return `
CREATIVE DIRECTION
  Redesign Philosophy: ${c.redesignPhilosophy}
  Strengths to Preserve: ${c.strengths.join(", ")}
  Weaknesses to Address: ${c.weaknesses.join(", ")}
  Recommendations: ${c.recommendations.join(", ")}
  Design Objective: ${c.designObjective}
  Brand Direction: ${c.brandDirection}
  Reasoning: ${c.reasoning}
  Confidence: ${c.confidenceScore}
`.trim();
}

function formatMotionDirector(m: MotionDirectorType): string {
  return `
MOTION ANALYSIS
  Current Motion Assessment: ${m.currentMotionAssessment}
  Psychological Impact: ${m.psychologicalImpact}
  Motion Strengthens Positioning: ${m.motionStrengthensPositioning}
  Animation Philosophy: ${m.animationPhilosophy}
  Recommendations: ${m.recommendations.join(", ")}
  Confidence: ${m.confidenceScore}
`.trim();
}

function formatDesignSystem(d: DesignSystemType): string {
  return `
DESIGN SYSTEM
  Layout: ${d.layout}
  Grid: ${d.grid}
  Typography: ${d.typography}
  Color System: ${d.colorSystem}
  Spacing: ${d.spacing}
  Components: ${d.components}
  Photography: ${d.photography}
  Accessibility: ${d.accessibility}
  Responsive Behaviour: ${d.responsiveBehaviour}
  Token Summary: ${d.tokenSummary}
  Confidence: ${d.confidenceScore}
`.trim();
}

function formatCompetitiveIntel(c: CompetitiveIntelType): string {
  return `
COMPETITIVE INTELLIGENCE
  Identified Competitors: ${c.identifiedCompetitors.join(", ")}
  Competitive Gaps: ${c.competitiveGaps.join(", ")}
  Opportunities: ${c.opportunities.join(", ")}
  Differentiators: ${c.differentiators.join(", ")}
  Luxury Perception Gap: ${c.luxuryPerceptionGap}
  Messaging Opportunity: ${c.messagingOpportunity}
  Confidence: ${c.confidenceScore}
`.trim();
}

function formatDecisionEngine(d: DecisionEngineType): string {
  return `
DECISION ENGINE
  Single Biggest Impact Change: ${d.singleBiggestImpactChange}
  What Should Change: ${d.whatShouldChange.join(", ")}
  What Should Never Change: ${d.whatShouldNeverChange.join(", ")}
  Biggest ROI: ${d.biggestROI}
  Lowest Effort Highest Impact: ${d.lowestEffortHighestImpact}
  Changes Client Would Approve: ${d.changesClientWouldApprove.join(", ")}
  Redesign Strategy: ${d.redesignStrategy}
  Priority Matrix: ${d.priorityMatrix}
  Reasoning: ${d.reasoning}
  Confidence: ${d.confidenceScore}
`.trim();
}

function formatLovableBrief(l: LovableBriefType): string {
  return `
CREATIVE BRIEF
${l.creativeBrief}
  Confidence: ${l.confidenceScore}
`.trim();
}

// ─── Server function ──────────────────────────────────────────────────────────

export const runScoutPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    jobDescription: string;
    freelancerContext?: string;
    mockupLink?: string;
    websiteData?: string;
    websiteUrl?: string;
  }) => z.object({
    jobDescription: z.string().min(10).max(15000),
    freelancerContext: z.string().max(3000).optional(),
    mockupLink: z.string().max(500).optional(),
    websiteData: z.string().max(15000).optional(),
    websiteUrl: z.string().max(500).optional(),
  }).parse(d))
  .handler(
    async ({ data }: { data: { jobDescription: string; freelancerContext?: string; mockupLink?: string; websiteData?: string; websiteUrl?: string } }): Promise<ScoutPipelineResult> => {
      const { jobDescription, freelancerContext, mockupLink, websiteData, websiteUrl } = data;

      const websiteBlock = websiteData
        ? `\n\nWEBSITE DATA:\n${websiteData}`
        : "";
      const urlBlock = websiteUrl ? `\nWebsite URL: ${websiteUrl}` : "";
      const freelancerBlock = freelancerContext
        ? `\n\nFREELANCER CONTEXT:\n${freelancerContext}`
        : "";
      const mockupBlock = mockupLink ? `\nMockup Link: ${mockupLink}` : "";

      // ── Engine 0: Opportunity Qualification ──────────────────────────────

      const qualification = await generateObjectWithProvider("analyzer", {
        system:
          "You are a senior business development strategist. Assess whether this website/prospect is worth prospecting. Think like a creative agency that only takes on clients where a redesign will create meaningful value. Be ruthlessly honest — if the site is already excellent, say so. Never recommend prospecting just to fill a pipeline.",
        prompt: `Evaluate this prospect and determine if they are worth pursuing for a website redesign.

JOB DESCRIPTION:
${jobDescription}${freelancerBlock}${mockupBlock}${urlBlock}${websiteBlock}

Assess the current website quality, the potential impact of a redesign, and whether the business opportunity justifies outreach. Score the prospect from 0–100. Assign outreach priority A (high), B (medium), or C (low). Be honest — a score below 40 means this is likely not worth prospecting.`,
        schema: QualificationSchema,
      });

      // ── Engine 1: Business Intelligence ──────────────────────────────────

      let businessIntelligence: BusinessIntelType | undefined;
      try {
        businessIntelligence = await generateObjectWithProvider("analyzer", {
          system:
            "Think like McKinsey, Bain, and a senior brand strategist. Understand the business before understanding the website. Never make assumptions — ground every conclusion in evidence from the website data. Assign lower confidence scores when evidence is thin.",
          prompt: `Perform deep business intelligence analysis on this company.

JOB DESCRIPTION:
${jobDescription}${urlBlock}${websiteBlock}

QUALIFICATION CONTEXT:
${formatQualification(qualification)}

Analyze the business model, revenue model, target audience psychology, competitive positioning, pricing level, and brand personality. Identify the core business insight — the single most important thing to understand about this business. Then identify the three biggest bottlenecks: conversion, trust, and perception. Every conclusion must be grounded in evidence from the website data, not assumption.`,
          schema: BusinessIntelSchema,
        });
      } catch {
        // Engine 1 failed; downstream engines will handle undefined gracefully
      }

      if (!businessIntelligence) {
        return { qualification };
      }

      const biSummary = formatBusinessIntel(businessIntelligence);

      // ── Engines 2, 4, 5, 6 in parallel ───────────────────────────────────

      const [uxResult, motionResult, designResult, competitiveResult] =
        await Promise.allSettled([
          // Engine 2: UX Psychology
          generateObjectWithProvider("analyzer", {
            system:
              "Think like Nielsen Norman Group. Analyze only psychology — never discuss visual design. Every finding must connect to user behavior, not aesthetics. Reading flow, cognitive load, and trust signals are your primary lenses.",
            prompt: `Analyze the UX psychology of this website.

JOB DESCRIPTION:
${jobDescription}${urlBlock}${websiteBlock}

BUSINESS INTELLIGENCE:
${biSummary}

Map the user's psychological journey from first impression to conversion decision. Identify where cognitive load spikes, where trust is built or broken, how the eye moves through the page, and where users experience friction or uncertainty. Your analysis must be grounded in psychological principles, not subjective aesthetics.`,
            schema: UXPsychologySchema,
          }),

          // Engine 4: Motion Director
          generateObjectWithProvider("analyzer", {
            system:
              "Think like a film director. Reverse engineer the motion philosophy. Never describe motion technically — describe its psychological impact on the viewer. Does the motion make the brand feel more credible, premium, fast, trustworthy? Or does it distract?",
            prompt: `Analyze the motion design and animation philosophy of this website.

JOB DESCRIPTION:
${jobDescription}${urlBlock}${websiteBlock}

BUSINESS INTELLIGENCE:
${biSummary}

Reverse engineer the existing motion language. Does the motion philosophy align with the brand's positioning and pricing level? Does it make the brand feel more premium, trustworthy, and credible — or does it undermine those qualities? What is the psychological impact of the existing motion on a first-time visitor? What animation philosophy should guide the redesign?`,
            schema: MotionDirectorSchema,
          }),

          // Engine 5: Design System Architect
          generateObjectWithProvider("analyzer", {
            system:
              "Reverse engineer the complete design system as if you were analyzing a Figma file. Extract every systematic decision. Be specific about typefaces, color values, spacing scales, and component patterns. Your output will drive the implementation brief.",
            prompt: `Reverse engineer the complete design system of this website.

JOB DESCRIPTION:
${jobDescription}${urlBlock}${websiteBlock}

BUSINESS INTELLIGENCE:
${biSummary}

Analyze the layout system, grid structure, typography choices (typefaces, sizes, weights, line heights), color system (primary, secondary, accent, neutral palettes with approximate hex values), spacing scale, component patterns (buttons, cards, navigation, forms), photography/imagery style, accessibility considerations, and responsive behaviour. Be as specific and actionable as possible — this output drives implementation.`,
            schema: DesignSystemSchema,
          }),

          // Engine 6: Competitive Intelligence
          generateObjectWithProvider("analyzer", {
            system:
              "Identify realistic competitors based on the industry and positioning from the business intelligence. Compare messaging, visual hierarchy, trust signals, and conversion approach. Find gaps the client could own. Never redesign in isolation from the competitive landscape.",
            prompt: `Perform competitive intelligence analysis for this business.

JOB DESCRIPTION:
${jobDescription}

BUSINESS INTELLIGENCE:
${biSummary}

Based on the industry, positioning, and pricing level identified in the business intelligence, identify the most relevant competitors (direct and indirect). Compare their messaging approach, visual hierarchy, trust signal strategy, and conversion tactics. Identify competitive gaps this business could own. Find the messaging opportunity that no competitor has claimed. Assess any luxury or premium perception gap.`,
            schema: CompetitiveIntelSchema,
          }),
        ]);

      const uxPsychology =
        uxResult.status === "fulfilled" ? uxResult.value : undefined;
      const motionAnalysis =
        motionResult.status === "fulfilled" ? motionResult.value : undefined;
      const designSystem =
        designResult.status === "fulfilled" ? designResult.value : undefined;
      const competitiveIntelligence =
        competitiveResult.status === "fulfilled"
          ? competitiveResult.value
          : undefined;

      // ── Engine 3: Creative Director (needs 1 + 2 + 5) ────────────────────

      let creativeDirection: CreativeDirectorType | undefined;
      try {
        const uxBlock = uxPsychology
          ? `\n\nUX PSYCHOLOGY:\n${formatUXPsychology(uxPsychology)}`
          : "";
        const dsBlock = designSystem
          ? `\n\nDESIGN SYSTEM:\n${formatDesignSystem(designSystem)}`
          : "";

        creativeDirection = await generateObjectWithProvider("writer", {
          system:
            "Think like Cuberto, Pentagram, Instrument, Fantasy, or Ramotion. Never redesign by default. Preserve strengths. Every recommendation must serve a specific business objective identified in the Business Intelligence report. If the site is already strong, say Preserved and explain why.",
          prompt: `Provide creative direction for this website redesign.

BUSINESS INTELLIGENCE:
${biSummary}${uxBlock}${dsBlock}

Based on the business intelligence, UX psychology analysis, and reverse-engineered design system, determine the appropriate redesign philosophy. Should the brand be Preserved, Refreshed, Modernized, Elevated, Repositioned, or Completely Redesigned? Every recommendation must serve a specific business objective. Identify the specific strengths that must be preserved, the weaknesses that must be addressed, and the concrete recommendations that will move the business toward its goals. Define the design objective and brand direction in a single focused sentence each.`,
          schema: CreativeDirectorSchema,
        });
      } catch {
        // Engine 3 failed; continue with undefined
      }

      // ── Engine 7: Decision Engine (needs 2+3+4+5+6) ──────────────────────

      let decisionEngine: DecisionEngineType | undefined;
      try {
        const uxBlock = uxPsychology
          ? `\n\nUX PSYCHOLOGY:\n${formatUXPsychology(uxPsychology)}`
          : "";
        const creativeBlock = creativeDirection
          ? `\n\nCREATIVE DIRECTION:\n${formatCreativeDirector(creativeDirection)}`
          : "";
        const motionBlock = motionAnalysis
          ? `\n\nMOTION ANALYSIS:\n${formatMotionDirector(motionAnalysis)}`
          : "";
        const dsBlock = designSystem
          ? `\n\nDESIGN SYSTEM:\n${formatDesignSystem(designSystem)}`
          : "";
        const compBlock = competitiveIntelligence
          ? `\n\nCOMPETITIVE INTELLIGENCE:\n${formatCompetitiveIntel(competitiveIntelligence)}`
          : "";

        decisionEngine = await generateObjectWithProvider("writer", {
          system:
            "This is the most important engine. Before recommending anything, force yourself to answer one question: 'If I could only change ONE thing on this website that would create the biggest business impact, what would it be?' That answer goes in singleBiggestImpactChange. Then evaluate every major section individually. Never recommend change for its own sake — respect good work. Every change must have a business justification tied to the core business insight.",
          prompt: `Make the final strategic decisions for this website redesign.

BUSINESS INTELLIGENCE:
${biSummary}${uxBlock}${creativeBlock}${motionBlock}${dsBlock}${compBlock}

STEP 1 — Answer this question first:
"If I could only change ONE thing on this website that would create the biggest business impact, what would it be?"
Store that answer in singleBiggestImpactChange.

STEP 2 — Evaluate every major section individually (Hero, Navigation, About/Story, Services/Products, Testimonials/Social Proof, CTA Sections, Footer, and any others visible):
For each section decide:
- Preserve: This works well. Do not touch it.
- Improve: Good foundation, needs enhancement.
- Modernize: Outdated execution, keep the essence.
- Replace: Not working. Needs a completely different approach.
- Redesign: Fundamentally broken. Start fresh.
Never default to Redesign if Preserve or Improve would serve the business better. Respect good work.

STEP 3 — Build the complete decision framework: what should change, what should never change, biggest ROI, lowest effort for highest impact. The redesign strategy must be a single clear paragraph any designer could execute from. Every decision must tie back to: "${businessIntelligence.coreBusinessInsight}"`,
          schema: DecisionEngineSchema,
        });
      } catch {
        // Engine 7 failed; continue with undefined
      }

      // ── Engine 8: Lovable Creative Brief (needs 1+3+7) ───────────────────

      let lovablePrompt: LovableBriefType | undefined;
      try {
        const creativeBlock = creativeDirection
          ? `\n\nCREATIVE DIRECTION:\n${formatCreativeDirector(creativeDirection)}`
          : "";
        const decisionBlock = decisionEngine
          ? `\n\nDECISION ENGINE:\n${formatDecisionEngine(decisionEngine)}`
          : "";

        lovablePrompt = await generateObjectWithProvider("writer", {
          system:
            "Generate a creative brief that reads like it came from a world-class creative agency, not a prompt generator. Structure: Creative Direction → Business Objective → Customer Psychology → Redesign Philosophy → Visual Language → Motion Philosophy → Implementation Notes. Every section must include business reasoning, psychological reasoning, visual reasoning, and conversion reasoning. Do not explain what to build. Explain why. The redesign must outperform the existing website on every business metric.",
          prompt: `Write the definitive creative brief for this website redesign.

BUSINESS INTELLIGENCE:
${biSummary}${creativeBlock}${decisionBlock}

Write a creative brief that could be handed directly to a world-class design team. It must explain the why behind every creative decision — why this visual language, why this motion philosophy, why this content hierarchy, why this conversion approach. Structure it as: Creative Direction → Business Objective → Customer Psychology → Redesign Philosophy → Visual Language → Motion Philosophy → Implementation Notes. Make it specific to this business, not generic. It should read like it came from a creative agency that deeply understands this client's world.`,
          schema: LovableBriefSchema,
        });
      } catch {
        // Engine 8 failed; continue with undefined
      }

      // ── Engine 9: Outreach Engine (needs 1+7+8) ───────────────────────────

      let outreach: OutreachEngineType | undefined;
      try {
        const decisionBlock = decisionEngine
          ? `\n\nDECISION ENGINE:\n${formatDecisionEngine(decisionEngine)}`
          : "";
        const briefBlock = lovablePrompt
          ? `\n\nCREATIVE BRIEF SUMMARY:\n${formatLovableBrief(lovablePrompt)}`
          : "";

        outreach = await generateObjectWithProvider("writer", {
          system:
            "You are a senior creative director writing personally to a founder. You have done serious homework. You are NOT selling anything — you are starting a real conversation. Rules you must follow without exception: Never say 'The biggest issue is...' or 'The analysis shows...' or 'This website has...' or 'Your website could...'. Never compliment generically. Never sound like a freelancer or AI. Write like you spent time looking through their site and one thing genuinely stood out. Every sentence must feel specific to THIS company. The CTA must always be a question, never a statement. Think: 'I spent some time looking through your website.' 'One thing kept standing out.' 'It made me wonder...' 'I put together something.' Write naturally. Write humanly.",
          prompt: `Write a complete cold outreach package for this prospect.

COMPANY: ${businessIntelligence.industry} — ${businessIntelligence.positioning}
CORE INSIGHT (the one thing that stood out): ${businessIntelligence.coreBusinessInsight}
CREATIVE DIRECTION: ${creativeDirection ? creativeDirection.designObjective : "Website redesign to improve business performance"}
REDESIGN PHILOSOPHY: ${creativeDirection ? creativeDirection.redesignPhilosophy : "Modernized"}
${mockupLink ? `MOCKUP URL: ${mockupLink}` : ""}

Generate the following:

1. THREE SUBJECT LINES — each under 50 characters, each using a different angle:
   - Curiosity angle: makes them wonder what you noticed
   - Vision angle: paints a picture of what could be
   - Personal angle: feels like it's from someone they might know

2. THREE OPENING HOOKS — each a single sentence:
   One that creates curiosity. One that is bold. One that is warm.
   None should compliment. None should advise. Each must earn attention.

3. ONE EMAIL BODY (150-200 words, the primary version):
   The first sentence must contain the core insight naturally.
   The last sentence must be a thoughtful business question.
   No generic phrases. No AI tells.

4. ONE CTA — a single question (not a statement). Something that makes them genuinely curious about the answer.

5. THREE COMPLETE EMAILS in the emails array:
   - Friendly style: warm, like a smart colleague sending a casual note, 100-160 words
   - Consultative style: thoughtful peer-to-peer business conversation, 120-180 words
   - Founder-to-Founder style: direct, personal, builder talking to builder, 80-140 words
   Each needs its own subjectLine, body, and cta (question).
   ${mockupLink ? `Each email should naturally reference and link to the mockup: ${mockupLink}` : "Each email should mention you can quickly put together a mockup."}

6. SPAM AVOIDANCE TIPS specific to this outreach's content (not generic tips).`,
          schema: OutreachEngineSchema,
        });
      } catch {
        // Engine 9 failed; continue with undefined
      }

      // ── Engine 10: Agency Review — two passes then merge ─────────────────

      let agencyReview: AgencyReviewType | undefined;
      try {
        const reviewContext = `
CREATIVE BRIEF:
${lovablePrompt ? formatLovableBrief(lovablePrompt) : "(not available)"}

OUTREACH EMAIL:
Subject Lines: ${outreach ? outreach.subjectLines.join(" | ") : "(not available)"}
Hooks: ${outreach ? outreach.hooks.join(" | ") : "(not available)"}
Email Body: ${outreach ? outreach.emailBody : "(not available)"}
CTA: ${outreach ? outreach.cta : "(not available)"}
`.trim();

        const reviewSystem =
          "You are a panel of five internal reviewers at a world-class creative agency. Review the outreach email and creative brief against the highest creative standards. Be brutally honest. Reject work that sounds generic, AI-generated, or fails to demonstrate real business understanding. Each reviewer critiques from their specialty.";

        const reviewPrompt = `Review the following creative work from your area of specialty.

${reviewContext}

Creative Director: Review the creative brief for strategic coherence, originality, and whether it would genuinely differentiate this client in their market.
Brand Strategist: Review whether the positioning, messaging, and brand direction serve the core business insight and audience psychology.
UX Director: Review whether the brief addresses the real conversion and trust bottlenecks identified in the analysis.
Motion Director: Review whether the motion philosophy is psychologically sound and aligned with the brand's positioning and pricing level.
Conversion Specialist: Review the outreach email — does it earn attention without selling? Does it sound human? Does it end with a business question that compels a reply?

Provide honest, specific feedback from each role. Flag any generic language, AI tells, or weak reasoning. Determine whether the work meets world-class agency standards.`;

        const [verifierResult, challengerResult] = await Promise.allSettled([
          generateObjectWithProvider("verifier", {
            system: reviewSystem,
            prompt: reviewPrompt,
            schema: AgencyReviewSchema,
          }),
          generateObjectWithProvider("challenger", {
            system: reviewSystem,
            prompt: reviewPrompt,
            schema: AgencyReviewSchema,
          }),
        ]);

        const verifier =
          verifierResult.status === "fulfilled"
            ? verifierResult.value
            : undefined;
        const challenger =
          challengerResult.status === "fulfilled"
            ? challengerResult.value
            : undefined;

        if (verifier && challenger) {
          // Merge: combine revisions, fail if either fails, combine notes
          agencyReview = {
            creativeDirFeedback: verifier.creativeDirFeedback,
            brandStrategistFeedback: verifier.brandStrategistFeedback,
            uxDirectorFeedback: verifier.uxDirectorFeedback,
            motionDirectorFeedback: verifier.motionDirectorFeedback,
            conversionSpecialistFeedback: verifier.conversionSpecialistFeedback,
            overallApproval:
              verifier.overallApproval && challenger.overallApproval,
            revisionsRequired: [
              ...verifier.revisionsRequired,
              ...challenger.revisionsRequired.filter(
                (r) => !verifier.revisionsRequired.includes(r)
              ),
            ],
            finalNotes: `Verifier Panel: ${verifier.finalNotes}\n\nChallenger Panel: ${challenger.finalNotes}`,
          };
        } else if (verifier) {
          agencyReview = verifier;
        } else if (challenger) {
          agencyReview = challenger;
        }
      } catch {
        // Engine 10 failed; continue with undefined
      }

      return {
        qualification,
        businessIntelligence,
        uxPsychology,
        creativeDirection,
        motionAnalysis,
        designSystem,
        competitiveIntelligence,
        decisionEngine,
        lovablePrompt,
        outreach,
        agencyReview,
      };
    }
  );
