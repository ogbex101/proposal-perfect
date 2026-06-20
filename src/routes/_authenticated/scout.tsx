import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wand2, Loader2, Copy, Check, Mail, Code2, Zap, Bot, Globe,
  ChevronDown, ChevronUp, Sparkles, Shield, Layers,
  ArrowRight, FileCode, Brain, Target, Link2, MessageSquarePlus,
  Image, Download, Pencil, RefreshCw, Trash2, BookTemplate, Star,
} from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateScoutOutreach, enhanceProposal, generateProposalImage, analyzeClientWebsite } from "@/lib/ai.functions";
import type { ScoutOutreach, WebsiteData } from "@/lib/ai.functions";
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
  const [result, setResult] = useState<ScoutOutreach | null>(null);
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
    const match = mdLinkMatch ? { 0: mdLinkMatch[1] } : plainMatch;
    const url = match ? match[0] : null;
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
    mutationFn: () => generateScoutOutreach({
      data: {
        jobDescription: jobText,
        freelancerContext: context || undefined,
        customChanges: customChanges || undefined,
        mockupLink: mockupLink || undefined,
        enable3d,
        websiteData: websiteDataStr,
      },
    }),
    onSuccess: async (data) => {
      const outreach = data as ScoutOutreach;
      setResult(outreach);
      setScoutSubmitted(false);
      setSavedId(null);
      setPreviewImage(null);
      incrementGenerated();
      toast.success("Scout outreach generated!");
      setTimeout(() => {
        document.getElementById("scout-results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Auto-save to DB (non-fatal)
      saveScoutOutreach({
        data: {
          job_description: jobText,
          job_excerpt: jobText.slice(0, 200),
          job_type: outreach.devPrompt.jobType,
          subject_line: outreach.subjectLine,
          email_body: outreach.emailBody,
          hook_rationale: outreach.hookRationale,
          strategy_note: outreach.strategyNote,
          dev_prompt_title: outreach.devPrompt.projectTitle,
        },
      }).then(({ id }) => setSavedId(id)).catch(() => {});

      // Auto-generate preview image
      setGeneratingImage(true);
      try {
        const proj = (data as ScoutOutreach).devPrompt;
        const imgPrompt = `Professional project preview card for "${proj.projectTitle}", ${proj.jobTypeName}, ${proj.estimatedComplexity} complexity. Modern dark UI dashboard mockup, clean design, dark background, tech startup style, high quality digital art`;
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

  const jobTypeMeta = result ? (JOB_TYPE_META[result.devPrompt.jobType] ?? JOB_TYPE_META["general-web"]) : null;

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
                onClick={() => runWebsiteAnalysis(manualUrl.trim() || detectedUrl || undefined)}
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
                  <button onClick={() => setWebsiteData(null)} className="text-[10px] text-white/30 hover:text-white/60">Clear</button>
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
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5">{websiteData.imageUrls.length} Image Assets</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {websiteData.imageUrls.slice(0, 8).map((url, i) => (
                        <div key={i} className="aspect-video rounded overflow-hidden bg-white/5 border border-white/10">
                          <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
        <div id="scout-results" className="space-y-4">
          {/* Job type badge */}
          {jobTypeMeta && (
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", jobTypeMeta.color)}>
                {jobTypeMeta.icon}
                {result.devPrompt.jobTypeName}
              </span>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", COMPLEXITY_COLOR[result.devPrompt.estimatedComplexity] ?? "text-muted-foreground")}>
                {result.devPrompt.estimatedComplexity} project
              </span>
            </div>
          )}

          {/* ── PREVIEW IMAGE ── */}
          {(generatingImage || previewImage) && (
            <Section icon={<Image className="h-4 w-4 text-blue-400" />} title="Preview Image" badge={
              <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-0.5 text-[10px] font-mono text-blue-400">send with email</span>
            }>
              {generatingImage ? (
                <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Generating preview image…</span>
                </div>
              ) : previewImage ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Attach this image to your email or use it as a visual teaser alongside the mockup link. It shows you've already thought through the project.
                  </p>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <img src={previewImage} alt="Project preview" className="w-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={previewImage}
                      download={`preview-${result.devPrompt.projectTitle.replace(/\s+/g, "-")}.png`}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-400/20 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Download image
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/60 text-xs"
                      onClick={async () => {
                        setGeneratingImage(true);
                        setPreviewImage(null);
                        try {
                          const proj = result.devPrompt;
                          const imgPrompt = `Professional project preview card for "${proj.projectTitle}", ${proj.jobTypeName}, modern dark UI dashboard mockup, clean design, dark background, tech startup style, high quality digital art, different angle`;
                          const res = await generateProposalImage({ data: { prompt: imgPrompt } });
                          if (res?.dataUrl) setPreviewImage(res.dataUrl);
                        } catch {
                          toast.error("Could not regenerate image");
                        } finally {
                          setGeneratingImage(false);
                        }
                      }}
                    >
                      <RefreshCw className="mr-1.5 h-3 w-3" /> Regenerate
                    </Button>
                  </div>
                </div>
              ) : null}
            </Section>
          )}

          {/* ── EMAIL SECTION ── */}
          <Section icon={<Mail className="h-4 w-4 text-teal" />} title="Cold Email" badge={
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-[10px] font-mono text-teal">spam-safe</span>
          }>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Subject Line</p>
                <CopyButton text={result.subjectLine} label="Copy subject" />
              </div>
              <div className="rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
                <p className="text-lg font-semibold text-white">{result.subjectLine}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{result.subjectLine.length} characters · {result.subjectLine.length < 50 ? "✓ Under 50 char limit" : "⚠ Consider shortening"}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Email Body</p>
                <CopyButton text={result.emailBody} label="Copy full email" />
              </div>
              <div className="rounded-xl border border-white/10 bg-background/60 p-5">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">{result.emailBody}</pre>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  className="bg-teal text-white hover:bg-teal/80"
                  size="sm"
                  onClick={async () => {
                    await copyText(`Subject: ${result.subjectLine}\n\n${result.emailBody}`);
                    toast.success("Subject + body copied — ready to paste into Gmail/Outlook!");
                  }}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" /> Copy subject + body together
                </Button>
              </div>
            </div>
          </Section>

          {/* ── STRATEGY ANALYSIS ── */}
          <Section icon={<Target className="h-4 w-4 text-gold" />} title="Email Strategy & Analysis">
            <div className="space-y-4">
              <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-teal mb-1.5">Why the hook works</p>
                <p className="text-sm leading-relaxed text-white/90">{result.hookRationale}</p>
              </div>
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-gold mb-1.5">Persuasion strategy</p>
                <p className="text-sm leading-relaxed text-white/90">{result.strategyNote}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="h-3.5 w-3.5 text-green-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-green-400">Spam avoidance checklist</p>
                </div>
                <ul className="space-y-1.5">
                  {result.spamAvoidanceTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-400" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* ── DEV PROMPT SECTION ── */}
          <Section icon={<FileCode className="h-4 w-4 text-purple-400" />} title="Development Prompt" badge={
            <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2.5 py-0.5 text-[10px] font-mono text-purple-400">
              Cursor · Lovable · Bolt · v0
            </span>
          }>
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{result.devPrompt.projectTitle}</p>
                <p className="text-sm leading-relaxed text-white/90">{result.devPrompt.overview}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Tech Stack</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.devPrompt.techStack.map((t) => (
                      <span key={t} className="rounded-md border border-teal/30 bg-teal/10 px-2 py-0.5 text-[11px] font-mono text-teal">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Integrations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.devPrompt.integrations.map((t) => (
                      <span key={t} className="rounded-md border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-mono text-gold">{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Core Features</p>
                <div className="space-y-2">
                  {result.devPrompt.coreFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mt-0.5", PRIORITY_COLOR[f.priority] ?? "text-muted-foreground bg-white/5")}>
                        {f.priority === "Must Have" ? "MUST" : f.priority === "Should Have" ? "SHOULD" : "NICE"}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">{f.feature}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Enhancements & Ideas</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.devPrompt.enhancements.map((e, i) => (
                    <div key={i} className="rounded-lg border border-purple-400/20 bg-purple-400/5 p-3">
                      <p className="text-xs font-semibold text-purple-300">{e.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{e.description}</p>
                      <p className="text-[10px] text-purple-400/70 mt-1.5 italic">Impact: {e.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400">Architecture</p>
                </div>
                <p className="text-sm leading-relaxed text-white/80">{result.devPrompt.architecture}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight className="h-3.5 w-3.5 text-green-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-green-400">Scalability</p>
                </div>
                <p className="text-sm leading-relaxed text-white/80">{result.devPrompt.scalabilityNotes}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-purple-400/20 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <p className="text-sm font-bold text-white">Paste-Ready AI Coding Prompt</p>
                  </div>
                  <CopyButton text={result.devPrompt.vibeCodePrompt} label="Copy prompt" />
                </div>
                <div className="rounded-xl border border-purple-400/30 bg-purple-400/5 p-5">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-purple-100/90 font-mono text-[12px]">
                    {result.devPrompt.vibeCodePrompt}
                  </pre>
                </div>
                <Button
                  className="mt-3 w-full bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 font-semibold"
                  onClick={async () => {
                    await copyText(result.devPrompt.vibeCodePrompt);
                    toast.success("Prompt copied — paste into Cursor, Lovable, Bolt, or v0!");
                  }}
                >
                  <FileCode className="mr-2 h-4 w-4" /> Copy & paste into your AI coding tool
                </Button>
              </div>
            </div>
          </Section>
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
