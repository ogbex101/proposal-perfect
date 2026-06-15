import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Wand2, Loader2, Copy, Check, Mail, Code2, Zap, Bot, Globe,
  ChevronDown, ChevronUp, Sparkles, Shield, AlertTriangle, Layers,
  ArrowRight, FileCode, Brain, Target,
} from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateScoutOutreach } from "@/lib/ai.functions";
import type { ScoutOutreach } from "@/lib/ai.functions";
import { copyText } from "@/lib/export";

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

function ScoutPage() {
  const [jobText, setJobText] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<ScoutOutreach | null>(null);

  const scoutMutation = useMutation({
    mutationFn: () => generateScoutOutreach({
      data: { jobDescription: jobText, freelancerContext: context || undefined },
    }),
    onSuccess: (data) => {
      setResult(data as ScoutOutreach);
      toast.success("Scout outreach generated!");
      setTimeout(() => {
        document.getElementById("scout-results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jobTypeMeta = result ? (JOB_TYPE_META[result.devPrompt.jobType] ?? JOB_TYPE_META["general-web"]) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Scouting"
        title="Scout Outreach"
        description="Find a job on Upwork or Freelancer, paste it here — get a magnetic cold email + full dev prompt. Better than a proposal."
      />

      {/* Input panel */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] mb-8">
        <CropCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold text-white">Job Description</Label>
            <MicButton onTranscript={(t) => setJobText(p => (p + " " + t).trim())} />
          </div>
          <Textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job post from Upwork, Freelancer, LinkedIn, or anywhere else…&#10;&#10;Include the client's description, requirements, budget, timeline — everything."
            rows={14}
            className="resize-none bg-background/60 text-sm font-mono leading-relaxed"
          />
        </CropCard>

        <div className="flex flex-col gap-5">
          <CropCard className="p-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold text-white">Your Context <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <MicButton onTranscript={(t) => setContext(p => (p + " " + t).trim())} />
            </div>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="What's your background? Tech stack you prefer? Any relevant experience for this specific job? (The more specific, the better the email)"
              rows={7}
              className="resize-none bg-background/60 text-sm"
            />
          </CropCard>

          <CropCard className="p-5 border-teal/20 bg-teal/5">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-teal mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">Cold email</p>
                  <p className="text-[10px] text-muted-foreground">Magnetic subject + spam-safe body</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Brain className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">Job analysis</p>
                  <p className="text-[10px] text-muted-foreground">Hook + strategy + spam tips</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileCode className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">Full dev prompt</p>
                  <p className="text-[10px] text-muted-foreground">Paste-ready for Cursor / Lovable / Bolt / v0</p>
                </div>
              </div>
            </div>
            <Button
              className="mt-4 w-full bg-gradient-to-r from-teal to-teal/70 text-white font-semibold shadow-lg shadow-teal/20 hover:shadow-teal/40"
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
            <div className="flex items-center gap-3">
              <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", jobTypeMeta.color)}>
                {jobTypeMeta.icon}
                {result.devPrompt.jobTypeName}
              </span>
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", COMPLEXITY_COLOR[result.devPrompt.estimatedComplexity] ?? "text-muted-foreground")}>
                {result.devPrompt.estimatedComplexity} project
              </span>
            </div>
          )}

          {/* ── EMAIL SECTION ── */}
          <Section icon={<Mail className="h-4 w-4 text-teal" />} title="Cold Email" badge={
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-[10px] font-mono text-teal">spam-safe</span>
          }>
            {/* Subject line */}
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

            {/* Email body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Email Body</p>
                <CopyButton text={result.emailBody} label="Copy full email" />
              </div>
              <div className="rounded-xl border border-white/10 bg-background/60 p-5">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">{result.emailBody}</pre>
              </div>
              <div className="mt-3 flex items-center gap-2">
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
              {/* Overview */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{result.devPrompt.projectTitle}</p>
                <p className="text-sm leading-relaxed text-white/90">{result.devPrompt.overview}</p>
              </div>

              {/* Tech stack + integrations */}
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

              {/* Core features */}
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

              {/* Enhancements */}
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

              {/* Architecture */}
              <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400">Architecture</p>
                </div>
                <p className="text-sm leading-relaxed text-white/80">{result.devPrompt.architecture}</p>
              </div>

              {/* Scalability */}
              <div className="rounded-xl border border-white/10 bg-background/40 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight className="h-3.5 w-3.5 text-green-400" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-green-400">Scalability</p>
                </div>
                <p className="text-sm leading-relaxed text-white/80">{result.devPrompt.scalabilityNotes}</p>
              </div>

              {/* The actual paste-ready prompt */}
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
