import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wand2, Loader2, Copy, Check, Mail, Code2, Zap, Bot, Globe,
  ChevronDown, ChevronUp, Sparkles, Shield, Layers,
  ArrowRight, FileCode, Brain, Target, Link2, MessageSquarePlus,
  Image, Download, Pencil, RefreshCw, Trash2, BookTemplate, Star,
  BarChart2, Eye, Palette, Activity, TrendingUp, Lightbulb,
  CheckCircle2, XCircle, AlertCircle, Users, Search,
} from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enhanceProposal, generateProposalImage, analyzeClientWebsite } from "@/lib/ai.functions";
import type { WebsiteData } from "@/lib/ai.functions";
import { runScoutPipeline } from "@/lib/scout.pipeline";
import type { ScoutPipelineResult, OutreachEngineType } from "@/lib/scout.pipeline";
import { copyText } from "@/lib/export";
import {
  saveScoutOutreach, listOutreachTemplates, analyzeAndSaveOutreachTemplate,
  deleteOutreachTemplate, matchTemplateToJob,
} from "@/lib/scout.functions";
import type { OutreachTemplate } from "@/lib/scout.functions";

export const Route = createFileRoute("/_authenticated/scout")({
  component: ScoutPage,
});

const JOB_TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  "vibe-coding":  { icon: <Sparkles className="h-4 w-4" />, color: "text-purple-400 border-purple-400/30 bg-purple-400/10", label: "Vibe Coding / No-Code" },
  "full-stack":   { icon: <Code2 className="h-4 w-4" />,    color: "text-teal border-teal/30 bg-teal/10",                  label: "Full-Stack Dev" },
  "automation":   { icon: <Zap className="h-4 w-4" />,      color: "text-gold border-gold/30 bg-gold/10",                  label: "Automation" },
  "ai-agent":     { icon: <Bot className="h-4 w-4" />,      color: "text-blue-400 border-blue-400/30 bg-blue-400/10",      label: "AI Agent" },
  "general-web":  { icon: <Globe className="h-4 w-4" />,    color: "text-green-400 border-green-400/30 bg-green-400/10",   label: "Web Dev" },
};

const COMPLEXITY_COLOR: Record<string, string> = {
  Simple:     "text-green-400 bg-green-400/10 border-green-400/30",
  Medium:     "text-gold bg-gold/10 border-gold/30",
  Complex:    "text-orange-400 bg-orange-400/10 border-orange-400/30",
  Enterprise: "text-red-400 bg-red-400/10 border-red-400/30",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Must Have":    "text-red-400 bg-red-400/10",
  "Should Have":  "text-gold bg-gold/10",
  "Nice to Have": "text-muted-foreground bg-white/5",
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await copyText(text);
        setCopied(true);
        toast.success("Copied!");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-line/40 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-white hover:border-teal/40 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function Section({ open: defaultOpen = true, icon, title, badge, children }: {
  open?: boolean;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <CropCard className="overflow-hidden">
      <button
        className="flex w-full items-center gap-3 p-5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
          {icon}
        </div>
        <span className="flex-1 font-semibold text-white">{title}</span>
        {badge}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border/40 p-5">{children}</div>}
    </CropCard>
  );
}

function CollapsibleSection({ icon, title, badge, children, defaultOpen = false }: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <CropCard className="overflow-hidden">
      <button className="flex w-full items-center gap-3 p-5 text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">{icon}</div>
        <span className="flex-1 font-semibold text-white">{title}</span>
        {badge}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border/40 p-5">{children}</div>}
    </CropCard>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      "rounded-full border px-2 py-0.5 text-[10px] font-mono",
      score >= 80 ? "border-teal/30 bg-teal/10 text-teal" :
      score >= 60 ? "border-gold/30 bg-gold/10 text-gold" :
      "border-white/20 bg-white/5 text-muted-foreground"
    )}>
      {score}% confidence
    </span>
  );
}

function InsightBlock({ label, text, highlight }: { label: string; text: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight ? "border-gold/20 bg-gold/5" : "border-white/10 bg-white/[0.03]")}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
    </div>
  );
}

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  const colorMap: Record<string, string> = {
    teal: "border-teal/30 bg-teal/10 text-teal/90",
    gold: "border-gold/30 bg-gold/10 text-gold/90",
    red: "border-red-400/30 bg-red-400/10 text-red-300",
    purple: "border-purple-400/30 bg-purple-400/10 text-purple-300",
    orange: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  };
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={cn("rounded-full border px-2.5 py-1 text-xs", colorMap[color] ?? "border-white/20 bg-white/5 text-foreground/70")}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Daily scout counter (localStorage) ──────────────────────────────────────
type ScoutDayStats = { date: string; generated: number; submitted: number };
function scoutTodayKey() { return new Date().toISOString().slice(0, 10); }
function readScoutDayStats(): ScoutDayStats {
  try {
    const raw = localStorage.getItem("pp_scout_day_stats");
    const parsed: ScoutDayStats = raw ? JSON.parse(raw) : { date: "", generated: 0, submitted: 0 };
    if (parsed.date !== scoutTodayKey()) return { date: scoutTodayKey(), generated: 0, submitted: 0 };
    return parsed;
  } catch { return { date: scoutTodayKey(), generated: 0, submitted: 0 }; }
}
function writeScoutDayStats(stats: ScoutDayStats) {
  try { localStorage.setItem("pp_scout_day_stats", JSON.stringify(stats)); } catch {}
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageMode = "scout" | "enhance" | "templates";

function ScoutPage() {
  const [mode, setMode] = useState<PageMode>("scout");

  return (
    <div>
      <PageHeader
        eyebrow="Scouting"
        title="Scout & Enhance"
        description="Scout cold email outreach for any job, or paste an existing proposal and enhance it to convert."
      />

      {/* Mode tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border/60 bg-sidebar/60 p-1 w-fit">
        {([
          { id: "scout", label: "Scout Outreach" },
          { id: "enhance", label: "Enhance Proposal" },
          { id: "templates", label: "Outreach Templates" },
        ] as { id: PageMode; label: string }[]).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "px-5 py-1.5 rounded-lg text-sm font-medium transition-all",
              mode === m.id
                ? "bg-gold text-background shadow-sm"
                : "text-muted-foreground hover:text-white",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "scout" ? <ScoutMode /> : mode === "enhance" ? <EnhanceMode /> : <OutreachTemplatesMode />}
    </div>
  );
}

// ─── Scout Mode ───────────────────────────────────────────────────────────────

function ScoutMode() {
  const [jobText, setJobText] = useState("");
  const [context, setContext] = useState("");
  const [customChanges, setCustomChanges] = useState("");
  const [mockupLink, setMockupLink] = useState("");
  const [enable3d, setEnable3d] = useState(false);
  const [result, setResult] = useState<ScoutPipelineResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scoutSubmitted, setScoutSubmitted] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [analyzingWebsite, setAnalyzingWebsite] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [dayStats, setDayStats] = useState<ScoutDayStats>(() =>
    typeof window !== "undefined" ? readScoutDayStats() : { date: scoutTodayKey(), generated: 0, submitted: 0 }
  );

  function incrementGenerated() {
    const fresh = readScoutDayStats();
    const updated = { ...fresh, generated: fresh.generated + 1 };
    writeScoutDayStats(updated);
    setDayStats(updated);
  }

  function markScoutSubmitted() {
    if (scoutSubmitted || !savedId) return;
    setScoutSubmitted(true);
    const fresh = readScoutDayStats();
    const updated = { ...fresh, submitted: fresh.submitted + 1 };
    writeScoutDayStats(updated);
    setDayStats(updated);
    // also update DB
    import("@/lib/scout.functions").then(({ updateScoutStatus }) => {
      updateScoutStatus({ data: { id: savedId, submitted: true } }).catch(() => {});
    });
  }

  // Extract URL from job text when it changes
  const prevJobRef = useRef("");
  useEffect(() => {
    if (jobText === prevJobRef.current) return;
    prevJobRef.current = jobText;
    // Handle plain URLs and markdown [text](url) links
    const mdLinkMatch = jobText.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/);
    const plainMatch = jobText.match(/https?:\/\/[^\s\]>)"]+/);
    const url = mdLinkMatch ? mdLinkMatch[1] : (plainMatch ? plainMatch[0] : null);
    setDetectedUrl(url);
    if (!url) {
      setWebsiteData(null);
    }
  }, [jobText]);

  async function runWebsiteAnalysis(urlOverride?: string) {
    const rawUrl = urlOverride ?? (manualUrl.trim() || detectedUrl);
    if (!rawUrl) return;
    // Strip markdown link format: [text](url) → url
    const mdMatch = rawUrl.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const extracted = mdMatch ? mdMatch[2] : rawUrl;
    // Clean trailing punctuation
    const url = extracted.replace(/[.,;:!?)}\]'"]+$/, "").trim();
    if (!url) return;
    try { new URL(url); } catch { toast.error(`Invalid URL: "${url}"`); return; }
    setAnalyzingWebsite(true);
    try {
      const data = await analyzeClientWebsite({ data: { url } });
      if (data) setWebsiteData(data as WebsiteData);
      toast.success("Website analyzed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Website scan failed: ${msg}`);
    } finally {
      setAnalyzingWebsite(false);
    }
  }

  const websiteDataStr = websiteData
    ? [
        `BRAND: ${websiteData.brandName} — ${websiteData.businessType} in ${websiteData.industry}`,
        `WEBSITE TITLE: ${websiteData.title}`,
        `DESCRIPTION: ${websiteData.description}`,
        `PRIMARY CONVERSION GOAL: ${websiteData.primaryGoal}`,
        websiteData.secondaryGoals?.length ? `SECONDARY GOALS: ${websiteData.secondaryGoals.join(", ")}` : null,
        `TARGET AUDIENCE: ${websiteData.targetAudience}`,
        `UNIQUE VALUE PROPOSITION: ${websiteData.uniqueValueProp}`,
        websiteData.pricingPosition ? `PRICING POSITION: ${websiteData.pricingPosition}` : null,
        websiteData.businessInsights ? `BUSINESS INSIGHTS: ${websiteData.businessInsights}` : null,
        // Scores
        websiteData.scores ? [
          `WEBSITE SCORES (1-10):`,
          `  Branding: ${websiteData.scores.branding}/10 | UX: ${websiteData.scores.ux}/10 | Visual Design: ${websiteData.scores.visualDesign}/10 | Content: ${websiteData.scores.content}/10`,
          `  Performance: ${websiteData.scores.performance}/10 | Trust: ${websiteData.scores.trust}/10 | Accessibility: ${websiteData.scores.accessibility}/10 | SEO: ${websiteData.scores.seo}/10`,
          `  Conversion: ${websiteData.scores.conversion}/10 | Motion Design: ${websiteData.scores.motionDesign}/10 | Overall: ${websiteData.scores.overall}/10`,
          `  WEAKEST AREAS (drive all recommendations): ${websiteData.scores.weakestAreas.join(", ")}`,
          `  Score Notes: ${websiteData.scores.scoreNotes}`,
        ].join("\n") : null,
        // Brand assets
        websiteData.logoUrl ? `LOGO URL: ${websiteData.logoUrl}` : null,
        websiteData.brandColors.length ? `BRAND COLORS: ${websiteData.brandColors.join(", ")}` : null,
        websiteData.fontFamilies.length ? `FONTS: ${websiteData.fontFamilies.join(", ")}` : null,
        websiteData.buttonStyle ? `BUTTON STYLE: ${websiteData.buttonStyle}` : null,
        websiteData.cardStyle ? `CARD STYLE: ${websiteData.cardStyle}` : null,
        websiteData.borderRadius ? `BORDER RADIUS: ${websiteData.borderRadius}` : null,
        websiteData.shadowStyle ? `SHADOWS: ${websiteData.shadowStyle}` : null,
        websiteData.spacingSystem ? `SPACING: ${websiteData.spacingSystem}` : null,
        websiteData.layoutStyle ? `LAYOUT: ${websiteData.layoutStyle}` : null,
        websiteData.componentStyle ? `COMPONENT STYLE: ${websiteData.componentStyle}` : null,
        websiteData.photographyStyle ? `PHOTOGRAPHY STYLE: ${websiteData.photographyStyle}` : null,
        websiteData.motionStyle ? `EXISTING MOTION: ${websiteData.motionStyle}` : null,
        websiteData.iconStyle ? `ICON STYLE: ${websiteData.iconStyle}` : null,
        websiteData.imageUrls.length ? `IMAGE ASSETS: ${websiteData.imageUrls.slice(0, 8).join(", ")}` : null,
        // Navigation & CTAs
        websiteData.navigationStructure?.length ? `NAVIGATION: ${websiteData.navigationStructure.join(" → ")}` : null,
        websiteData.callsToAction?.length ? `EXISTING CTAs: ${websiteData.callsToAction.join(", ")}` : null,
        websiteData.trustSignals?.length ? `TRUST SIGNALS: ${websiteData.trustSignals.join(", ")}` : null,
        websiteData.existingAnimations ? `EXISTING ANIMATIONS: ${websiteData.existingAnimations}` : null,
        websiteData.interactiveElements ? `INTERACTIVE ELEMENTS: ${websiteData.interactiveElements}` : null,
        // Insights
        `DESIGN LANGUAGE: ${websiteData.designLanguage}`,
        `WHAT WORKS: ${websiteData.whatWorks}`,
        `OPPORTUNITIES: ${websiteData.opportunities}`,
        `CONVERSION BOTTLENECKS: ${websiteData.conversionBottlenecks}`,
        websiteData.seoStructure ? `SEO STRUCTURE: ${websiteData.seoStructure}` : null,
        websiteData.mobileExperience ? `MOBILE EXPERIENCE: ${websiteData.mobileExperience}` : null,
        websiteData.existingTech.length ? `EXISTING TECH STACK: ${websiteData.existingTech.join(", ")}` : null,
        websiteData.keyPages.length ? `KEY PAGES: ${websiteData.keyPages.join(", ")}` : null,
        websiteData.contentSections.length
          ? `CONTENT SECTIONS (reuse this copy verbatim in the mockup):\n${websiteData.contentSections.map(s => `  [${s.section} — ${s.location}]\n  "${s.content}"\n  WHY REUSE: ${s.usefulness}`).join("\n")}`
          : null,
      ].filter(Boolean).join("\n")
    : undefined;

  const scoutMutation = useMutation({
    mutationFn: () => runScoutPipeline({
      data: {
        jobDescription: jobText,
        freelancerContext: context || undefined,
        mockupLink: mockupLink || undefined,
        websiteData: websiteDataStr ? websiteDataStr.slice(0, 14000) : undefined,
        websiteUrl: detectedUrl || undefined,
      },
    }),
    onSuccess: async (data) => {
      const pipeline = data as ScoutPipelineResult;
      setResult(pipeline);
      setScoutSubmitted(false);
      setSavedId(null);
      setPreviewImage(null);
      incrementGenerated();
      toast.success("Analysis complete!");
      setTimeout(() => {
        document.getElementById("scout-results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Auto-save to DB using outreach results (non-fatal)
      const outreach = pipeline.outreach;
      if (outreach) {
        saveScoutOutreach({
          data: {
            job_description: jobText,
            job_excerpt: jobText.slice(0, 200),
            job_type: "web_design",
            subject_line: outreach.subjectLines[0] ?? "",
            email_body: outreach.emailBody,
            hook_rationale: pipeline.businessIntelligence?.coreBusinessInsight ?? "",
            strategy_note: pipeline.decisionEngine?.redesignStrategy ?? "",
            dev_prompt_title: pipeline.lovablePrompt ? "Creative Brief" : "",
          },
        }).then(({ id }) => setSavedId(id)).catch(() => {});
      }

      // Auto-generate preview image
      setGeneratingImage(true);
      try {
        const bizName = pipeline.businessIntelligence?.industry ?? "web project";
        const imgPrompt = `Professional project preview card for ${bizName} website redesign. Modern dark UI dashboard mockup, clean design, dark background, tech startup style, high quality digital art`;
        const res = await generateProposalImage({ data: { prompt: imgPrompt } });
        if (res?.dataUrl) setPreviewImage(res.dataUrl);
      } catch {
        // image generation failing is non-fatal
      } finally {
        setGeneratingImage(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      {/* Daily stats bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <Mail className="h-3.5 w-3.5 text-teal" />
          <span className="text-xs font-medium text-white/60">Today</span>
          <span className="font-mono text-sm font-bold text-teal">{dayStats.generated}</span>
          <span className="text-xs text-white/30">outreach sent</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          <span className="text-xs font-medium text-white/60">Submitted</span>
          <span className="font-mono text-sm font-bold text-gold">{dayStats.submitted}</span>
          <span className="text-xs text-white/30">today</span>
        </div>
        {result && savedId && (
          <button
            onClick={markScoutSubmitted}
            disabled={scoutSubmitted}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all",
              scoutSubmitted
                ? "border-teal/40 bg-teal/10 text-teal cursor-default"
                : "border-white/20 bg-white/5 text-white/60 hover:border-teal/40 hover:text-teal"
            )}
          >
            {scoutSubmitted ? <>✓ Submitted</> : <>Mark as submitted</>}
          </button>
        )}
      </div>

      {/* Input panel */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] mb-8">
        <div className="space-y-4">
          <CropCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-white">Job Description</Label>
              <MicButton onTranscript={(t) => setJobText(p => (p + " " + t).trim())} />
            </div>
            <Textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the full job post from Upwork, Freelancer, LinkedIn, or anywhere else…&#10;&#10;Include the client's description, requirements, budget, timeline — everything."
              rows={10}
              className="resize-none bg-background/60 text-sm font-mono leading-relaxed"
            />
          </CropCard>

          {/* Custom changes */}
          <CropCard className="p-5 border-gold/20 bg-gold/5">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquarePlus className="h-4 w-4 text-gold" />
              <Label className="text-sm font-semibold text-white">Custom instructions <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            </div>
            <Textarea
              value={customChanges}
              onChange={(e) => setCustomChanges(e.target.value)}
              placeholder="Specific things to add or change in the email…&#10;e.g. mention I've done something similar for a fintech startup, emphasise quick turnaround, ask about their existing codebase"
              rows={3}
              className="resize-none bg-background/60 text-sm"
            />
          </CropCard>

          {/* Mockup link */}
          <CropCard className="p-5 border-teal/20 bg-teal/5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-teal" />
              <Label className="text-sm font-semibold text-white">Mockup link <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            </div>
            <Input
              value={mockupLink}
              onChange={(e) => setMockupLink(e.target.value)}
              placeholder="https://... (Figma, portfolio, live demo, generated portfolio link)"
              className="bg-background/60 text-sm"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              If set, the email will naturally mention the mockup and link it. If empty, it'll mention you can quickly produce one.
            </p>
          </CropCard>

          {/* Dedicated website URL input */}
          <CropCard className="p-5 border-blue-400/20 bg-blue-400/5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-blue-400" />
              <Label className="text-sm font-semibold text-white">Client Website URL <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            </div>
            <div className="flex gap-2">
              <Input
                value={manualUrl}
                onChange={(e) => { setManualUrl(e.target.value); setWebsiteData(null); }}
                placeholder={detectedUrl ? `Auto-detected: ${detectedUrl}` : "https://clientsite.com"}
                className="bg-background/60 text-sm font-mono flex-1"
              />
              <button
                onClick={() => runWebsiteAnalysis()}
                disabled={analyzingWebsite || (!manualUrl.trim() && !detectedUrl)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-400/20 border border-blue-400/30 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-400/30 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {analyzingWebsite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {analyzingWebsite ? "Analyzing…" : "Scan site"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Paste the client's website URL and scan it. The system will extract their brand assets, colors, fonts, copy, and design language — all fed directly into the mockup prompt.
            </p>

            {/* Rich website data display */}
            {websiteData && (
              <div className="mt-4 space-y-3 border-t border-blue-400/20 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Website analyzed ✓</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const text = [
                          `BRAND: ${websiteData.brandName} — ${websiteData.businessType} in ${websiteData.industry}`,
                          `TITLE: ${websiteData.title}`,
                          `DESCRIPTION: ${websiteData.description}`,
                          `GOAL: ${websiteData.primaryGoal}`,
                          websiteData.targetAudience && `AUDIENCE: ${websiteData.targetAudience}`,
                          websiteData.uniqueValueProp && `VALUE PROP: ${websiteData.uniqueValueProp}`,
                          websiteData.pricingPosition && `PRICING: ${websiteData.pricingPosition}`,
                          websiteData.brandColors.length && `BRAND COLORS: ${websiteData.brandColors.join(", ")}`,
                          websiteData.fontFamilies.length && `FONTS: ${websiteData.fontFamilies.join(", ")}`,
                          websiteData.existingTech.length && `TECH STACK: ${websiteData.existingTech.join(", ")}`,
                          websiteData.navigationStructure.length && `NAVIGATION: ${websiteData.navigationStructure.join(" → ")}`,
                          websiteData.callsToAction.length && `CTAs: ${websiteData.callsToAction.join(", ")}`,
                          websiteData.trustSignals.length && `TRUST SIGNALS: ${websiteData.trustSignals.join(", ")}`,
                          websiteData.designLanguage && `DESIGN LANGUAGE: ${websiteData.designLanguage}`,
                          websiteData.buttonStyle && `BUTTON STYLE: ${websiteData.buttonStyle}`,
                          websiteData.layoutStyle && `LAYOUT: ${websiteData.layoutStyle}`,
                          websiteData.scores && [
                            `SCORES — Overall: ${websiteData.scores.overall}/10`,
                            `  Branding: ${websiteData.scores.branding} | UX: ${websiteData.scores.ux} | Visual Design: ${websiteData.scores.visualDesign} | Content: ${websiteData.scores.content}`,
                            `  Performance: ${websiteData.scores.performance} | Trust: ${websiteData.scores.trust} | SEO: ${websiteData.scores.seo} | Conversion: ${websiteData.scores.conversion}`,
                            `  Weakest: ${websiteData.scores.weakestAreas.join(", ")}`,
                            `  Notes: ${websiteData.scores.scoreNotes}`,
                          ].join("\n"),
                          websiteData.whatWorks && `WHAT WORKS: ${websiteData.whatWorks}`,
                          websiteData.opportunities && `OPPORTUNITIES: ${websiteData.opportunities}`,
                          websiteData.conversionBottlenecks && `BOTTLENECKS: ${websiteData.conversionBottlenecks}`,
                          websiteData.businessInsights && `BUSINESS INSIGHTS: ${websiteData.businessInsights}`,
                          websiteData.seoStructure && `SEO: ${websiteData.seoStructure}`,
                          websiteData.mobileExperience && `MOBILE: ${websiteData.mobileExperience}`,
                          websiteData.contentSections.length && `CONTENT SECTIONS:\n${websiteData.contentSections.map(s => `  [${s.section}] "${s.content}" — ${s.usefulness}`).join("\n")}`,
                          websiteData.imageUrls.length && `IMAGE ASSETS:\n${websiteData.imageUrls.map(u => `  ${u}`).join("\n")}`,
                        ].filter(Boolean).join("\n");
                        navigator.clipboard.writeText(text).then(() => toast.success("Analysis copied"));
                      }}
                      className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors"
                    >
                      <Copy className="h-3 w-3" /> Copy analysis
                    </button>
                    <button onClick={() => setWebsiteData(null)} className="text-[10px] text-white/30 hover:text-white/60">Clear</button>
                  </div>
                </div>

                {/* Logo + brand colors */}
                <div className="flex items-start gap-3">
                  {websiteData.logoUrl && (
                    <div className="shrink-0 h-10 w-10 rounded-lg border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
                      <img src={websiteData.logoUrl} alt="Logo" className="max-h-8 max-w-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  <div className="min-w-0 space-y-1 text-[11px]">
                    <p className="font-semibold text-white">{websiteData.brandName}</p>
                    <p className="text-white/50">{websiteData.businessType} · {websiteData.industry}</p>
                    {websiteData.brandColors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {websiteData.brandColors.slice(0, 6).map((c, i) => (
                          <span key={i} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Core info */}
                <div className="space-y-1 text-[11px] text-white/60">
                  <p><span className="text-white/40">Goal:</span> {websiteData.primaryGoal}</p>
                  <p><span className="text-white/40">Audience:</span> {websiteData.targetAudience}</p>
                  <p><span className="text-white/40">Value prop:</span> {websiteData.uniqueValueProp}</p>
                  {websiteData.pricingPosition && <p><span className="text-white/40">Pricing:</span> {websiteData.pricingPosition}</p>}
                  {websiteData.fontFamilies.length > 0 && (
                    <p><span className="text-white/40">Fonts:</span> {websiteData.fontFamilies.join(", ")}</p>
                  )}
                  {websiteData.existingTech.length > 0 && (
                    <p><span className="text-white/40">Tech:</span> {websiteData.existingTech.join(", ")}</p>
                  )}
                </div>

                {/* Score grid */}
                {websiteData.scores && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Website Scores</p>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        websiteData.scores.overall >= 7 ? "border-green-400/30 bg-green-400/10 text-green-400"
                        : websiteData.scores.overall >= 5 ? "border-gold/30 bg-gold/10 text-gold"
                        : "border-red-400/30 bg-red-400/10 text-red-400"
                      )}>
                        Overall {websiteData.scores.overall}/10
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {([
                        ["Branding", websiteData.scores.branding],
                        ["UX", websiteData.scores.ux],
                        ["Visual Design", websiteData.scores.visualDesign],
                        ["Content", websiteData.scores.content],
                        ["Performance", websiteData.scores.performance],
                        ["Trust", websiteData.scores.trust],
                        ["Accessibility", websiteData.scores.accessibility],
                        ["SEO", websiteData.scores.seo],
                        ["Conversion", websiteData.scores.conversion],
                        ["Motion Design", websiteData.scores.motionDesign],
                      ] as [string, number][]).map(([label, score]) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", score >= 7 ? "bg-green-400" : score >= 5 ? "bg-gold" : "bg-red-400")}
                              style={{ width: `${score * 10}%` }}
                            />
                          </div>
                          <span className={cn("text-[9px] font-mono w-4 text-right", score <= 4 ? "text-red-400 font-bold" : "text-white/40")}>{score}</span>
                          <span className="text-[9px] text-white/40 truncate w-20">{label}</span>
                        </div>
                      ))}
                    </div>
                    {websiteData.scores.weakestAreas.length > 0 && (
                      <p className="mt-2 text-[10px] text-red-400/80">
                        ↑ Driving recommendations: {websiteData.scores.weakestAreas.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {/* Opportunities & bottlenecks */}
                {(websiteData.opportunities || websiteData.conversionBottlenecks) && (
                  <div className="space-y-1.5 rounded-lg bg-white/[0.03] border border-white/10 p-3 text-[11px]">
                    {websiteData.whatWorks && <p><span className="text-green-400">What works:</span> <span className="text-white/50">{websiteData.whatWorks}</span></p>}
                    {websiteData.businessInsights && <p><span className="text-blue-400">Business:</span> <span className="text-white/50">{websiteData.businessInsights}</span></p>}
                    {websiteData.opportunities && <p><span className="text-gold">Opportunities:</span> <span className="text-white/50">{websiteData.opportunities}</span></p>}
                    {websiteData.conversionBottlenecks && <p><span className="text-red-400">Bottlenecks:</span> <span className="text-white/50">{websiteData.conversionBottlenecks}</span></p>}
                  </div>
                )}

                {/* Content sections */}
                {websiteData.contentSections.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">Extracted Content Sections</p>
                    {websiteData.contentSections.slice(0, 5).map((sec, i) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white/70">{sec.section}</span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/30">{sec.location}</span>
                        </div>
                        <p className="text-white/50 italic line-clamp-2">"{sec.content}"</p>
                        <p className="text-blue-400/70 mt-1">{sec.usefulness}</p>
                      </div>
                    ))}
                    {websiteData.contentSections.length > 5 && (
                      <p className="text-[10px] text-white/30">+{websiteData.contentSections.length - 5} more sections extracted</p>
                    )}
                  </div>
                )}

                {/* Image thumbnails */}
                {websiteData.imageUrls.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">{websiteData.imageUrls.length} Image Assets</p>
                      <button
                        onClick={async () => {
                          let downloaded = 0;
                          for (const url of websiteData.imageUrls) {
                            try {
                              const res = await fetch(url);
                              const blob = await res.blob();
                              const ext = url.split(".").pop()?.split("?")[0] ?? "jpg";
                              const filename = `asset-${++downloaded}.${ext}`;
                              const a = document.createElement("a");
                              a.href = URL.createObjectURL(blob);
                              a.download = filename;
                              a.click();
                              URL.revokeObjectURL(a.href);
                              await new Promise(r => setTimeout(r, 200));
                            } catch { downloaded++; }
                          }
                          toast.success(`Downloaded ${downloaded} assets`);
                        }}
                        className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                      >
                        <Download className="h-3 w-3" /> Download all
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {websiteData.imageUrls.slice(0, 8).map((url, i) => (
                        <div key={i} className="group relative aspect-video rounded overflow-hidden bg-white/5 border border-white/10">
                          <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                          <a
                            href={url}
                            download={`asset-${i + 1}.${url.split(".").pop()?.split("?")[0] ?? "jpg"}`}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4 text-white" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto-detected URL notice */}
            {!websiteData && detectedUrl && !manualUrl && (
              <p className="mt-2 text-[11px] text-blue-300/60">
                URL auto-detected from job post: <span className="font-mono">{detectedUrl}</span>. Click "Scan site" to analyze it.
              </p>
            )}
          </CropCard>

          {/* 3D animation toggle */}
          <CropCard className="p-5 border-purple-400/20 bg-purple-400/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enable3d}
                onChange={(e) => setEnable3d(e.target.checked)}
                className="h-4 w-4 accent-purple-400 cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-white">3D animation design layout</p>
                <p className="text-[11px] text-muted-foreground">Enable Three.js / React Three Fiber, GSAP parallax, and cinematic motion in the dev prompt</p>
              </div>
            </label>
          </CropCard>
        </div>

        <div className="flex flex-col gap-5">
          <CropCard className="p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-white">Your Context <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <MicButton onTranscript={(t) => setContext(p => (p + " " + t).trim())} />
            </div>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Your background, tech stack, relevant experience for this specific job?"
              rows={6}
              className="resize-none bg-background/60 text-sm"
            />
          </CropCard>

          <CropCard className="p-5 border-teal/20 bg-teal/5">
            <div className="space-y-3 mb-4">
              {[
                { icon: <Mail className="h-4 w-4 text-teal" />, title: "Cold email", sub: "Subject → Hook → Insight → Solution → Proof → CTA" },
                { icon: <Brain className="h-4 w-4 text-gold" />, title: "Email strategy", sub: "Why each section works + spam avoidance tips" },
                { icon: <FileCode className="h-4 w-4 text-purple-400" />, title: "Full dev prompt", sub: "Paste-ready for Cursor / Lovable / Bolt / v0" },
                { icon: <Image className="h-4 w-4 text-blue-400" />, title: "Preview image", sub: "Send with the email to impress" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full bg-gradient-to-r from-teal to-teal/70 text-white font-semibold shadow-lg shadow-teal/20 hover:shadow-teal/40"
              disabled={jobText.trim().length < 30 || scoutMutation.isPending}
              onClick={() => scoutMutation.mutate()}
              size="lg"
            >
              {scoutMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating outreach…</>
                : <><Wand2 className="mr-2 h-4 w-4" /> Generate Scout Outreach</>}
            </Button>
          </CropCard>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div id="scout-results" className="space-y-4 mt-6">

          {/* ── Qualification Score ── */}
          {result.qualification && (
            <CropCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-gold" />
                  <Eyebrow>Opportunity Qualification</Eyebrow>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold font-mono",
                    result.qualification.outreachPriority === "A" ? "border-teal/40 bg-teal/10 text-teal" :
                    result.qualification.outreachPriority === "B" ? "border-gold/40 bg-gold/10 text-gold" :
                    "border-white/20 bg-white/5 text-muted-foreground"
                  )}>
                    Priority {result.qualification.outreachPriority}
                  </span>
                  <span className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    result.qualification.redesignImpact === "High" ? "border-teal/40 bg-teal/10 text-teal" :
                    result.qualification.redesignImpact === "Medium" ? "border-gold/40 bg-gold/10 text-gold" :
                    "border-white/20 bg-white/5 text-muted-foreground"
                  )}>
                    {result.qualification.redesignImpact} Impact
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Prospect Score</span>
                    <span className="text-sm font-bold font-mono text-foreground">{result.qualification.prospectScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", result.qualification.prospectScore >= 70 ? "bg-teal" : result.qualification.prospectScore >= 45 ? "bg-gold" : "bg-destructive/60")}
                      style={{ width: `${result.qualification.prospectScore}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Website Quality</p>
                  <p className="text-sm font-medium text-foreground">{result.qualification.currentWebsiteQuality}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Primary Opportunity</p>
                  <p className="text-sm font-medium text-foreground">{result.qualification.primaryOpportunity}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{result.qualification.reasoning}</p>
            </CropCard>
          )}

          {/* ── Business Intelligence ── */}
          {result.businessIntelligence && (
            <CollapsibleSection
              icon={<Brain className="h-4 w-4 text-purple-400" />}
              title="Business Intelligence"
              badge={<ConfidenceBadge score={result.businessIntelligence.confidenceScore} />}
              defaultOpen={false}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Industry", result.businessIntelligence.industry],
                    ["Business Model", result.businessIntelligence.businessModel],
                    ["Revenue Model", result.businessIntelligence.revenueModel],
                    ["Pricing Level", result.businessIntelligence.pricingLevel],
                  ].map(([label, val]) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm text-foreground">{val}</p>
                    </div>
                  ))}
                </div>
                <InsightBlock label="Core Business Insight" text={result.businessIntelligence.coreBusinessInsight} highlight />
                <InsightBlock label="Biggest Conversion Bottleneck" text={result.businessIntelligence.biggestConversionBottleneck} />
                <InsightBlock label="Biggest Trust Bottleneck" text={result.businessIntelligence.biggestTrustBottleneck} />
                <InsightBlock label="Biggest Perception Bottleneck" text={result.businessIntelligence.biggestPerceptionBottleneck} />
                <TagList label="Emotional Drivers" items={result.businessIntelligence.emotionalDrivers} color="purple" />
                <TagList label="Buying Objections" items={result.businessIntelligence.buyingObjections} color="red" />
                <TagList label="Trust Requirements" items={result.businessIntelligence.trustRequirements} color="teal" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── UX Psychology ── */}
          {result.uxPsychology && (
            <CollapsibleSection
              icon={<Eye className="h-4 w-4 text-blue-400" />}
              title="UX Psychology"
              badge={<ConfidenceBadge score={result.uxPsychology.confidenceScore} />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <InsightBlock label="Cognitive Load" text={result.uxPsychology.cognitiveLoad} />
                <InsightBlock label="Trust Progression" text={result.uxPsychology.trustProgression} />
                <InsightBlock label="Emotional Journey" text={result.uxPsychology.emotionalJourney} />
                <InsightBlock label="CTA Hierarchy" text={result.uxPsychology.ctaHierarchy} />
                <TagList label="User Friction Points" items={result.uxPsychology.userFriction} color="red" />
                <TagList label="User Uncertainty Points" items={result.uxPsychology.userUncertainty} color="gold" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── Creative Direction ── */}
          {result.creativeDirection && (
            <CollapsibleSection
              icon={<Palette className="h-4 w-4 text-pink-400" />}
              title="Creative Direction"
              badge={
                <span className="rounded-full border border-pink-400/30 bg-pink-400/10 px-2 py-0.5 text-[10px] font-medium text-pink-300">
                  {result.creativeDirection.redesignPhilosophy}
                </span>
              }
              defaultOpen={false}
            >
              <div className="space-y-3">
                <InsightBlock label="Design Objective" text={result.creativeDirection.designObjective} highlight />
                <InsightBlock label="Brand Direction" text={result.creativeDirection.brandDirection} />
                <TagList label="Strengths to Preserve" items={result.creativeDirection.strengths} color="teal" />
                <TagList label="Weaknesses to Address" items={result.creativeDirection.weaknesses} color="red" />
                <TagList label="Recommendations" items={result.creativeDirection.recommendations} color="gold" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── Motion Director ── */}
          {result.motionAnalysis && (
            <CollapsibleSection
              icon={<Activity className="h-4 w-4 text-cyan-400" />}
              title="Motion Analysis"
              badge={<ConfidenceBadge score={result.motionAnalysis.confidenceScore} />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <InsightBlock label="Psychological Impact" text={result.motionAnalysis.psychologicalImpact} />
                <InsightBlock label="Animation Philosophy" text={result.motionAnalysis.animationPhilosophy} />
                <div className="flex items-center gap-2">
                  {result.motionAnalysis.motionStrengthensPositioning
                    ? <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
                    : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  }
                  <span className="text-sm text-foreground/80">
                    Motion {result.motionAnalysis.motionStrengthensPositioning ? "strengthens" : "weakens"} brand positioning
                  </span>
                </div>
                <TagList label="Motion Recommendations" items={result.motionAnalysis.recommendations} color="cyan" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── Design System ── */}
          {result.designSystem && (
            <CollapsibleSection
              icon={<Layers className="h-4 w-4 text-indigo-400" />}
              title="Design System"
              badge={<ConfidenceBadge score={result.designSystem.confidenceScore} />}
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 gap-2">
                {[
                  ["Typography", result.designSystem.typography],
                  ["Color System", result.designSystem.colorSystem],
                  ["Layout & Grid", result.designSystem.layout],
                  ["Components", result.designSystem.components],
                  ["Accessibility", result.designSystem.accessibility],
                  ["Responsive Behaviour", result.designSystem.responsiveBehaviour],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{val}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* ── Competitive Intelligence ── */}
          {result.competitiveIntelligence && (
            <CollapsibleSection
              icon={<TrendingUp className="h-4 w-4 text-orange-400" />}
              title="Competitive Intelligence"
              badge={<ConfidenceBadge score={result.competitiveIntelligence.confidenceScore} />}
              defaultOpen={false}
            >
              <div className="space-y-3">
                <InsightBlock label="Messaging Opportunity" text={result.competitiveIntelligence.messagingOpportunity} highlight />
                <InsightBlock label="Luxury Perception Gap" text={result.competitiveIntelligence.luxuryPerceptionGap} />
                <TagList label="Identified Competitors" items={result.competitiveIntelligence.identifiedCompetitors} color="orange" />
                <TagList label="Competitive Gaps" items={result.competitiveIntelligence.competitiveGaps} color="red" />
                <TagList label="Opportunities" items={result.competitiveIntelligence.opportunities} color="teal" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── Decision Engine ── */}
          {result.decisionEngine && (
            <CollapsibleSection
              icon={<Target className="h-4 w-4 text-gold" />}
              title="Redesign Decision"
              badge={<ConfidenceBadge score={result.decisionEngine.confidenceScore} />}
              defaultOpen
            >
              <div className="space-y-3">
                <InsightBlock label="Redesign Strategy" text={result.decisionEngine.redesignStrategy} highlight />
                <InsightBlock label="Biggest ROI" text={result.decisionEngine.biggestROI} />
                <InsightBlock label="Lowest Effort / Highest Impact" text={result.decisionEngine.lowestEffortHighestImpact} />
                <TagList label="What Should Change" items={result.decisionEngine.whatShouldChange} color="teal" />
                <TagList label="What Should Never Change" items={result.decisionEngine.whatShouldNeverChange} color="red" />
                <TagList label="Changes Client Would Approve" items={result.decisionEngine.changesClientWouldApprove} color="gold" />
              </div>
            </CollapsibleSection>
          )}

          {/* ── Lovable Creative Brief ── */}
          {result.lovablePrompt && (
            <Section
              icon={<Lightbulb className="h-4 w-4 text-yellow-400" />}
              title="Lovable Creative Brief"
              badge={
                <CopyButton text={result.lovablePrompt.creativeBrief} label="Copy brief" />
              }
            >
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">{result.lovablePrompt.creativeBrief}</pre>
            </Section>
          )}

          {/* ── Outreach Email ── */}
          {result.outreach && (
            <Section
              icon={<Mail className="h-4 w-4 text-teal" />}
              title="Outreach Email"
              badge={<CopyButton text={result.outreach.emailBody} label="Copy email" />}
            >
              <div className="space-y-4">
                {/* Subject Lines */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Subject Lines</p>
                  <div className="space-y-1.5">
                    {result.outreach.subjectLines.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm text-foreground flex-1">{s}</span>
                        <CopyButton text={s} label="Copy" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opening Hooks */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Opening Hooks</p>
                  <div className="space-y-1.5">
                    {result.outreach.hooks.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-4 mt-0.5">{i + 1}.</span>
                        <span className="text-sm text-foreground/90 flex-1 leading-relaxed">{h}</span>
                        <CopyButton text={h} label="Copy" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Body */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Email Body</p>
                    <span className="text-[10px] text-muted-foreground">{result.outreach.emailBody.split(/\s+/).length} words</span>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">{result.outreach.emailBody}</pre>
                  </div>
                </div>

                {/* CTA */}
                <div className="rounded-lg border border-teal/20 bg-teal/5 p-3 flex items-start gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-teal mt-0.5 shrink-0" />
                  <p className="text-sm text-teal/90 leading-relaxed">{result.outreach.cta}</p>
                </div>

                {/* Copy full */}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={async () => {
                    const full = `Subject: ${result.outreach!.subjectLines[0]}\n\n${result.outreach!.emailBody}`;
                    await copyText(full);
                    toast.success("Full email copied!");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy full email
                </Button>
              </div>
            </Section>
          )}

          {/* ── Agency Review ── */}
          {result.agencyReview && (
            <CollapsibleSection
              icon={<Shield className="h-4 w-4 text-teal" />}
              title="Agency Review"
              badge={
                result.agencyReview.overallApproval
                  ? <span className="flex items-center gap-1 rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[10px] text-teal"><CheckCircle2 className="h-3 w-3" />Approved</span>
                  : <span className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-400"><XCircle className="h-3 w-3" />Needs Revision</span>
              }
              defaultOpen={false}
            >
              <div className="space-y-3">
                {[
                  ["Creative Director", result.agencyReview.creativeDirFeedback],
                  ["Brand Strategist", result.agencyReview.brandStrategistFeedback],
                  ["UX Director", result.agencyReview.uxDirectorFeedback],
                  ["Motion Director", result.agencyReview.motionDirectorFeedback],
                  ["Conversion Specialist", result.agencyReview.conversionSpecialistFeedback],
                ].map(([role, feedback]) => (
                  <InsightBlock key={role} label={role} text={feedback} />
                ))}
                {result.agencyReview.revisionsRequired.length > 0 && (
                  <TagList label="Revisions Required" items={result.agencyReview.revisionsRequired} color="red" />
                )}
                {result.agencyReview.finalNotes && (
                  <InsightBlock label="Final Notes" text={result.agencyReview.finalNotes} />
                )}
              </div>
            </CollapsibleSection>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Enhance Mode ─────────────────────────────────────────────────────────────

function EnhanceMode() {
  const [existingProposal, setExistingProposal] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [customChanges, setCustomChanges] = useState("");
  const [mockupLink, setMockupLink] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const enhanceMutation = useMutation({
    mutationFn: () => enhanceProposal({
      data: {
        proposal: existingProposal,
        jobDescription,
        customChanges: customChanges || undefined,
        mockupLink: mockupLink || undefined,
      },
    }),
    onSuccess: async (res) => {
      if (res?.content) {
        setEnhanced(res.content);
        toast.success("Proposal enhanced!");
        setTimeout(() => {
          document.getElementById("enhance-result")?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        // Auto-generate preview image
        setGeneratingImage(true);
        setPreviewImage(null);
        try {
          const excerpt = jobDescription.slice(0, 80);
          const imgPrompt = `Professional freelance proposal preview card, ${excerpt}, modern dark UI, clean design, dark background, tech professional, high quality digital art`;
          const imgRes = await generateProposalImage({ data: { prompt: imgPrompt } });
          if (imgRes?.dataUrl) setPreviewImage(imgRes.dataUrl);
        } catch { /* non-fatal */ }
        finally { setGeneratingImage(false); }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editMode, setEditMode] = useState(false);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Left — inputs */}
      <div className="space-y-4">
        <CropCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold text-white">Existing Proposal to Enhance</Label>
            <MicButton onTranscript={(t) => setExistingProposal(p => (p + " " + t).trim())} />
          </div>
          <Textarea
            value={existingProposal}
            onChange={(e) => setExistingProposal(e.target.value)}
            placeholder="Paste your existing proposal here — from ChatGPT, Gemini, another tool, or something you wrote yourself.&#10;&#10;The AI will strip the generic parts, sharpen the hook, add mockup language, and make it sound like you."
            rows={12}
            className="resize-none bg-background/60 text-sm leading-relaxed"
          />
        </CropCard>

        <CropCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold text-white">Job Description <span className="text-muted-foreground font-normal text-xs">(for context)</span></Label>
            <MicButton onTranscript={(t) => setJobDescription(p => (p + " " + t).trim())} />
          </div>
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description so the AI can tailor the enhanced proposal to it…"
            rows={5}
            className="resize-none bg-background/60 text-sm"
          />
        </CropCard>

        {/* Custom changes */}
        <CropCard className="p-5 border-gold/20 bg-gold/5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquarePlus className="h-4 w-4 text-gold" />
            <Label className="text-sm font-semibold text-white">Custom changes to add <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          </div>
          <Textarea
            value={customChanges}
            onChange={(e) => setCustomChanges(e.target.value)}
            placeholder="What do you want changed or added?&#10;e.g. mention I built a similar app for a healthcare startup, keep the opening line but change the second paragraph, add a stronger CTA"
            rows={3}
            className="resize-none bg-background/60 text-sm"
          />
        </CropCard>

        {/* Mockup link */}
        <CropCard className="p-5 border-teal/20 bg-teal/5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-teal" />
            <Label className="text-sm font-semibold text-white">Mockup link <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          </div>
          <Input
            value={mockupLink}
            onChange={(e) => setMockupLink(e.target.value)}
            placeholder="https://... — will be woven naturally into the proposal"
            className="bg-background/60 text-sm"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            The AI will insert language like: <em className="text-white/50">"I've put together a quick mockup to show you the direction — [link] — this is just a starting concept and I can tune every detail to your exact specifications."</em>
          </p>
        </CropCard>
      </div>

      {/* Right — action + results */}
      <div className="flex flex-col gap-5">
        <CropCard className="p-5 border-teal/20 bg-teal/5">
          <div className="space-y-3 mb-4">
            {[
              { icon: <Wand2 className="h-4 w-4 text-teal" />, title: "Strip AI slop", sub: "Remove generic filler phrases" },
              { icon: <Target className="h-4 w-4 text-gold" />, title: "Sharpen the hook", sub: "Job-specific opening that proves you read it" },
              { icon: <Link2 className="h-4 w-4 text-blue-400" />, title: "Add mockup language", sub: "Always mention mockup — naturally" },
              { icon: <Pencil className="h-4 w-4 text-purple-400" />, title: "Apply custom changes", sub: "Your exact instructions, incorporated" },
              { icon: <Image className="h-4 w-4 text-green-400" />, title: "Generate preview image", sub: "Attach to email for visual impact" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full bg-gradient-to-r from-teal to-teal/70 text-white font-semibold shadow-lg shadow-teal/20 hover:shadow-teal/40"
            disabled={existingProposal.trim().length < 30 || enhanceMutation.isPending}
            onClick={() => enhanceMutation.mutate()}
            size="lg"
          >
            {enhanceMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enhancing proposal…</>
              : <><Sparkles className="mr-2 h-4 w-4" /> Enhance Proposal</>}
          </Button>
        </CropCard>

        {/* Preview image */}
        {(generatingImage || previewImage) && (
          <CropCard className="p-5 border-blue-400/20 bg-blue-400/5">
            <div className="flex items-center gap-2 mb-3">
              <Image className="h-4 w-4 text-blue-400" />
              <Eyebrow className="text-blue-400">Preview Image</Eyebrow>
              {generatingImage && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
            </div>
            {previewImage ? (
              <>
                <p className="text-[11px] text-muted-foreground mb-3">Send this with your proposal email to visually stand out.</p>
                <div className="overflow-hidden rounded-xl border border-white/10 mb-3">
                  <img src={previewImage} alt="Proposal preview" className="w-full object-cover" />
                </div>
                <a
                  href={previewImage}
                  download="proposal-preview.png"
                  className="flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-400/20 transition-colors w-fit"
                >
                  <Download className="h-3.5 w-3.5" /> Download image
                </a>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Generating preview image…</p>
            )}
          </CropCard>
        )}
      </div>

      {/* Enhanced proposal result — full width */}
      {enhanced && (
        <div id="enhance-result" className="lg:col-span-2">
          <CropCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eyebrow>Enhanced Proposal</Eyebrow>
                <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[10px] font-mono text-teal">
                  {enhanced.split(/\s+/).length} words
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditMode(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-line/40 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-white hover:border-teal/40 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {editMode ? "View" : "Edit"}
                </button>
                <CopyButton text={enhanced} label="Copy proposal" />
              </div>
            </div>

            {editMode ? (
              <Textarea
                value={enhanced}
                onChange={(e) => setEnhanced(e.target.value)}
                rows={16}
                className="resize-y bg-background/60 text-sm leading-relaxed"
              />
            ) : (
              <div className="rounded-xl border border-white/10 bg-background/60 p-5">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">{enhanced}</pre>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-teal text-white hover:bg-teal/80"
                onClick={async () => {
                  await copyText(enhanced);
                  toast.success("Enhanced proposal copied!");
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy full proposal
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border/60"
                onClick={() => enhanceMutation.mutate()}
                disabled={enhanceMutation.isPending}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-enhance
              </Button>
            </div>
          </CropCard>
        </div>
      )}
    </div>
  );
}

// ─── Outreach Templates Mode ──────────────────────────────────────────────────

function OutreachTemplatesMode() {
  const queryClient = useQueryClient();
  const [pastedEmail, setPastedEmail] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState<"mockup" | "consultive" | "general">("general");
  const [jobForMatch, setJobForMatch] = useState("");
  const [matchResult, setMatchResult] = useState<{ bestId: string | null; reason: string } | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["outreach-templates"],
    queryFn: () => listOutreachTemplates(),
  });
  const templates = templatesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: () => analyzeAndSaveOutreachTemplate({
      data: { name: templateName, email_content: pastedEmail, category: templateCategory },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
      setPastedEmail("");
      setTemplateName("");
      toast.success("Template analyzed and saved!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOutreachTemplate({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matchMutation = useMutation({
    mutationFn: () => matchTemplateToJob({
      data: {
        jobDescription: jobForMatch,
        templates: templates.map((t) => ({
          id: t.id, name: t.name, category: t.category,
          hook_style: t.hook_style, cta_style: t.cta_style,
          structure_analysis: t.structure_analysis,
        })),
      },
    }),
    onSuccess: (res) => setMatchResult(res as { bestId: string | null; reason: string }),
    onError: (e: Error) => toast.error(e.message),
  });

  const CATEGORY_COLORS = {
    mockup: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    consultive: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    general: "text-gold border-gold/30 bg-gold/10",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: add new template */}
      <div className="space-y-5">
        <CropCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookTemplate className="h-5 w-5 text-gold" />
            <h2 className="font-semibold text-white">Add Outreach Template</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Paste a cold email outreach that worked well. The AI will analyze how it was crafted — hook style, insight approach, CTA style — and store it as a reusable template.
          </p>

          <div className="space-y-4">
            <div>
              <Label className="annotation mb-1.5 block !text-muted-foreground">Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Mockup-first for web builds, Consultive for SaaS clients"
                className="bg-background/60"
              />
            </div>

            <div>
              <Label className="annotation mb-1.5 block !text-muted-foreground">Category</Label>
              <div className="flex gap-2">
                {(["mockup", "consultive", "general"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategory(cat)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      templateCategory === cat ? CATEGORY_COLORS[cat] : "border-border/40 text-muted-foreground hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                <strong className="text-blue-400">Mockup</strong> = leads with design preview work ·{" "}
                <strong className="text-purple-400">Consultive</strong> = leads with strategic insight
              </p>
            </div>

            <div>
              <Label className="annotation mb-1.5 block !text-muted-foreground">Paste Email Content</Label>
              <Textarea
                value={pastedEmail}
                onChange={(e) => setPastedEmail(e.target.value)}
                placeholder="Paste the full cold email here — subject line and body…"
                rows={10}
                className="resize-none bg-background/60 text-sm font-mono"
              />
            </div>

            <Button
              className="w-full bg-gold text-background hover:bg-gold/90"
              disabled={!pastedEmail.trim() || !templateName.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing template…</>
                : <><Sparkles className="mr-2 h-4 w-4" /> Analyze & Save Template</>}
            </Button>
          </div>
        </CropCard>

        {/* Match template to job */}
        <CropCard className="p-5 border-teal/20 bg-teal/5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-teal" />
            <h3 className="font-semibold text-white text-sm">Match Template to Job</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Paste a job description and the AI will pick which of your saved templates is the best fit.
          </p>
          <Textarea
            value={jobForMatch}
            onChange={(e) => setJobForMatch(e.target.value)}
            placeholder="Paste the job description here…"
            rows={5}
            className="resize-none bg-background/60 text-sm mb-3"
          />
          <Button
            variant="outline"
            className="w-full border-teal/30 text-teal hover:bg-teal/10"
            disabled={!jobForMatch.trim() || templates.length === 0 || matchMutation.isPending}
            onClick={() => matchMutation.mutate()}
          >
            {matchMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching…</>
              : <><Brain className="mr-2 h-4 w-4" /> Find Best Template</>}
          </Button>
          {matchResult && (
            <div className="mt-3 rounded-lg border border-teal/20 bg-teal/5 p-3 text-sm">
              <p className="font-medium text-teal mb-1">
                Best fit: {templates.find((t) => t.id === matchResult.bestId)?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">{matchResult.reason}</p>
            </div>
          )}
        </CropCard>
      </div>

      {/* Right: saved templates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Saved Templates ({templates.length})</h2>
        </div>

        {templatesQuery.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {templates.length === 0 && !templatesQuery.isPending && (
          <CropCard className="p-6 text-center">
            <BookTemplate className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No templates yet. Add your first one on the left.</p>
          </CropCard>
        )}

        {templates.map((t) => {
          const isBestMatch = matchResult?.bestId === t.id;
          return (
            <CropCard key={t.id} className={cn("p-4", isBestMatch && "border-teal/40 bg-teal/5")}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isBestMatch && <Star className="h-3.5 w-3.5 text-teal shrink-0" />}
                  <span className="font-semibold text-white text-sm">{t.name}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[t.category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.general)}>
                    {t.category}
                  </span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] text-white/60 mb-3">
                <p><span className="text-white/40">Hook style:</span> {t.hook_style}</p>
                <p><span className="text-white/40">CTA style:</span> {t.cta_style}</p>
                <p className="text-white/50 italic">{t.structure_analysis}</p>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-[11px] text-teal hover:text-teal/80 select-none">
                  View email content
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] text-white/60 font-mono bg-white/5 rounded-lg p-3 leading-relaxed max-h-48 overflow-y-auto">
                  {t.email_content}
                </pre>
              </details>
            </CropCard>
          );
        })}
      </div>
    </div>
  );
}
