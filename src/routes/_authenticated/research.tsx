import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Brain, Loader2, Target, AlertTriangle, TrendingUp,
  Lightbulb, Zap, Copy, ChevronRight, Compass, Trophy,
  XCircle, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { cn } from "@/lib/utils";
import {
  researchClientAndJob,
  adviseProposalStrategy,
  type ResearchBrief,
  type StrategyAdvice,
} from "@/lib/ai.functions";
import { copyText } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

type Tab = "intel" | "strategy";

function ResearchPage() {
  const [tab, setTab] = useState<Tab>("intel");
  const [jobText, setJobText] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [advice, setAdvice] = useState<StrategyAdvice | null>(null);

  const research = useMutation({
    mutationFn: () => researchClientAndJob({ data: { jobText, clientInfo: clientInfo || undefined } }),
    onSuccess: (data) => { if (data) setBrief(data); },
    onError: (e: Error) => toast.error(e.message || "Research failed"),
  });

  const strategyAdvisor = useMutation({
    mutationFn: () => adviseProposalStrategy({ data: { jobText } }),
    onSuccess: (data) => { if (data) setAdvice(data); },
    onError: (e: Error) => toast.error(e.message || "Strategy analysis failed"),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Intelligence"
        title="Research Agent"
        description="Two AI agents: Client Intel maps the opportunity, Strategy Advisor picks your winning hook and strategy."
      />

      {/* Tab switcher */}
      <div className="mb-6 flex gap-2">
        {(
          [
            { id: "intel", label: "Client Intel", icon: Brain },
            { id: "strategy", label: "Strategy Advisor", icon: Compass },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border text-muted-foreground hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* CLIENT INTEL TAB */}
      {tab === "intel" && (
        <div className="space-y-5">
          <CropCard className="p-6">
            <Eyebrow><Brain className="inline h-3 w-3 mr-1" /> research inputs</Eyebrow>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="job-text">Job post / project description <span className="text-destructive">*</span></Label>
                  <MicButton onTranscript={(t) => setJobText((p) => p ? p + " " + t : t)} />
                </div>
                <Textarea
                  id="job-text"
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={8}
                  placeholder="Paste the full job post, project brief, or RFP here…"
                  className="resize-y bg-background/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-info">Client / company info <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="client-info"
                  value={clientInfo}
                  onChange={(e) => setClientInfo(e.target.value)}
                  rows={3}
                  placeholder="Company name, website, LinkedIn, or any other context about who they are…"
                  className="resize-y bg-background/60"
                />
              </div>
              <Button
                className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
                disabled={research.isPending || jobText.trim().length < 10}
                onClick={() => research.mutate()}
              >
                {research.isPending
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Researching…</>
                  : <><Brain className="mr-1.5 h-4 w-4" /> Run research agent</>}
              </Button>
            </div>
          </CropCard>

          {brief && (
            <BriefView
              brief={brief}
              onUseInProposal={() => {
                sessionStorage.setItem("prefill_hook", brief.proposalStrategy.one_line_hook);
                sessionStorage.setItem("prefill_job", jobText);
                window.location.href = "/new";
              }}
            />
          )}
        </div>
      )}

      {/* STRATEGY ADVISOR TAB */}
      {tab === "strategy" && (
        <div className="space-y-5">
          <CropCard className="p-6">
            <Eyebrow><Compass className="inline h-3 w-3 mr-1" /> strategy inputs</Eyebrow>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Job post <span className="text-destructive">*</span></Label>
                  <MicButton onTranscript={(t) => setJobText((p) => p ? p + " " + t : t)} />
                </div>
                <Textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={8}
                  placeholder="Paste the job post and the AI will tell you exactly which hook and strategy will win it…"
                  className="resize-y bg-background/60"
                />
              </div>
              <Button
                className="w-full"
                disabled={strategyAdvisor.isPending || jobText.trim().length < 10}
                onClick={() => strategyAdvisor.mutate()}
              >
                {strategyAdvisor.isPending
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing strategy…</>
                  : <><Compass className="mr-1.5 h-4 w-4" /> Analyze & advise strategy</>}
              </Button>
            </div>
          </CropCard>

          {advice && <StrategyAdviceView advice={advice} />}
        </div>
      )}
    </div>
  );
}

function StrategyAdviceView({ advice }: { advice: StrategyAdvice }) {
  const lengthLabels: Record<string, string> = {
    brief: "Brief — under 1500 chars (Freelancer.com / crowded market)",
    robust: "Robust — 2000-3000 chars (standard Upwork job)",
    explanatory: "Explanatory — 3000-5000 chars (complex / high-budget)",
  };

  return (
    <div className="space-y-4">
      {/* Winning insight */}
      <CropCard className="p-5 border-gold/40 bg-gold/[0.03]">
        <Eyebrow><Trophy className="inline h-3 w-3 mr-1 text-gold" /> <span className="text-gold">winning insight</span></Eyebrow>
        <p className="mt-3 text-sm leading-relaxed text-white">{advice.winningInsight}</p>
      </CropCard>

      {/* Recommended hook */}
      <CropCard className="p-5">
        <Eyebrow><Zap className="inline h-3 w-3 mr-1 text-teal" /> <span className="text-teal">recommended hook — {advice.recommendedHook.name}</span></Eyebrow>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground/80">{advice.recommendedHook.reason}</p>
          <div className="rounded-lg border border-teal/30 bg-teal/8 p-4">
            <p className="text-[10px] font-mono text-teal mb-2">OPENING LINE — USE THIS VERBATIM OR ADAPT IT</p>
            <p className="text-white leading-relaxed font-medium">"{advice.recommendedHook.openingLine}"</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-6 px-2 text-[10px] text-teal hover:bg-teal/10"
              onClick={() => { copyText(advice.recommendedHook.openingLine); toast.success("Copied"); }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
        </div>
      </CropCard>

      {/* Recommended strategy */}
      <CropCard className="p-5">
        <Eyebrow><Lightbulb className="inline h-3 w-3 mr-1 text-gold" /> <span className="text-gold">recommended strategy — {advice.recommendedStrategy.name}</span></Eyebrow>
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-foreground/80">{advice.recommendedStrategy.reason}</p>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <p className="text-[10px] font-mono text-muted-foreground mb-2">HOW TO APPLY THIS STRATEGY</p>
            <p className="text-foreground/90 leading-relaxed">{advice.recommendedStrategy.howToApply}</p>
          </div>
        </div>
      </CropCard>

      {/* Length recommendation */}
      <CropCard className="p-5">
        <Eyebrow>proposal length</Eyebrow>
        <div className="mt-3 flex items-start gap-3">
          <span className="rounded border border-gold/50 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold capitalize">{advice.lengthRecommendation.length}</span>
          <div>
            <p className="text-xs text-muted-foreground">{lengthLabels[advice.lengthRecommendation.length]}</p>
            <p className="mt-1 text-sm text-foreground/90">{advice.lengthRecommendation.reason}</p>
          </div>
        </div>
      </CropCard>

      {/* Hook ranking */}
      <CropCard className="p-5">
        <Eyebrow><BarChart3 className="inline h-3 w-3 mr-1" /> hook ranking for this job</Eyebrow>
        <div className="mt-3 space-y-2">
          {[...advice.hookRanking]
            .sort((a, b) => b.score - a.score)
            .map((h, i) => (
              <div key={h.id} className={cn(
                "flex items-start gap-3 rounded-md border p-2.5 text-sm",
                i === 0 ? "border-teal/40 bg-teal/5" : "border-border bg-background/30",
              )}>
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <span className={cn(
                    "text-base font-bold tabular-nums leading-none",
                    h.score >= 8 ? "text-teal" : h.score >= 5 ? "text-gold" : "text-muted-foreground",
                  )}>{h.score}</span>
                  <div className="h-1.5 w-10 overflow-hidden rounded-full bg-border">
                    <div className={cn("h-full rounded-full", h.score >= 8 ? "bg-teal" : h.score >= 5 ? "bg-gold" : "bg-muted-foreground")}
                      style={{ width: `${h.score * 10}%` }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-white">{h.name}</span>
                  {i === 0 && <span className="ml-2 rounded-full bg-teal/20 px-1.5 py-0.5 text-[10px] font-medium text-teal">Best choice</span>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.reason}</p>
                </div>
              </div>
            ))}
        </div>
      </CropCard>

      {/* Strategy ranking */}
      <CropCard className="p-5">
        <Eyebrow><BarChart3 className="inline h-3 w-3 mr-1" /> strategy ranking for this job</Eyebrow>
        <div className="mt-3 space-y-2">
          {[...advice.strategyRanking]
            .sort((a, b) => b.score - a.score)
            .map((s, i) => (
              <div key={s.id} className={cn(
                "flex items-start gap-3 rounded-md border p-2.5 text-sm",
                i === 0 ? "border-gold/40 bg-gold/5" : "border-border bg-background/30",
              )}>
                <div className="flex flex-col items-center gap-0.5 pt-0.5">
                  <span className={cn(
                    "text-base font-bold tabular-nums leading-none",
                    s.score >= 8 ? "text-gold" : s.score >= 5 ? "text-teal" : "text-muted-foreground",
                  )}>{s.score}</span>
                  <div className="h-1.5 w-10 overflow-hidden rounded-full bg-border">
                    <div className={cn("h-full rounded-full", s.score >= 8 ? "bg-gold" : s.score >= 5 ? "bg-teal" : "bg-muted-foreground")}
                      style={{ width: `${s.score * 10}%` }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-white">{s.name}</span>
                  {i === 0 && <span className="ml-2 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold">Best choice</span>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
                </div>
              </div>
            ))}
        </div>
      </CropCard>

      {/* Mistakes to avoid */}
      {advice.avoidMistakes.length > 0 && (
        <CropCard className="p-5">
          <Eyebrow><XCircle className="inline h-3 w-3 mr-1 text-red-400" /> <span className="text-red-400">mistakes to avoid for this job</span></Eyebrow>
          <ul className="mt-3 space-y-2">
            {advice.avoidMistakes.map((m, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <XCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span className="text-foreground/90">{m}</span>
              </li>
            ))}
          </ul>
        </CropCard>
      )}

      {/* Go to proposal generator */}
      <Button
        className="w-full bg-teal/15 text-teal hover:bg-teal/25 border border-teal/30"
        onClick={() => { window.location.href = "/new"; }}
      >
        <ChevronRight className="mr-1.5 h-4 w-4" /> Open proposal generator with this job →
      </Button>
    </div>
  );
}

function BriefView({ brief, onUseInProposal }: { brief: ResearchBrief; onUseInProposal: () => void }) {
  return (
    <div className="space-y-4">
      {/* Quick facts */}
      <CropCard className="p-5">
        <Eyebrow><Zap className="inline h-3 w-3 mr-1 text-gold" /> quick intel</Eyebrow>
        <div className="mt-3 flex flex-wrap gap-2">
          {brief.quickFacts.map((f, i) => (
            <span key={i} className="inline-block rounded-full border border-line/60 bg-sidebar px-2.5 py-0.5 text-xs text-foreground/80">
              {f}
            </span>
          ))}
        </div>
      </CropCard>

      {/* Client profile */}
      <CropCard className="p-5">
        <Eyebrow><Target className="inline h-3 w-3 mr-1" /> client profile</Eyebrow>
        <div className="mt-3 space-y-3 text-sm">
          <Row label="Industry" value={brief.clientProfile.likely_industry} />
          <Row label="Company size" value={brief.clientProfile.company_size_estimate} />
          <Row label="Decision style" value={brief.clientProfile.decision_making_style} />
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">PAIN POINTS</p>
            <ul className="space-y-1">
              {brief.clientProfile.pain_points.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold shrink-0">·</span>
                  <span className="text-foreground/90">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          {brief.clientProfile.red_flags.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-400" /> RED FLAGS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {brief.clientProfile.red_flags.map((f, i) => (
                  <span key={i} className="rounded-full border border-red-500/30 bg-red-500/10 text-red-400 px-2.5 py-0.5 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CropCard>

      {/* Job analysis */}
      <CropCard className="p-5">
        <Eyebrow><TrendingUp className="inline h-3 w-3 mr-1" /> job analysis</Eyebrow>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1">REAL PROBLEM</p>
            <p className="text-foreground/90 leading-relaxed">{brief.jobAnalysis.real_problem}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">UNSTATED NEEDS</p>
            <ul className="space-y-1">
              {brief.jobAnalysis.unstated_needs.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-teal shrink-0">·</span>
                  <span className="text-foreground/90">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <Row label="Budget tier" value={brief.jobAnalysis.likely_budget_tier} />
          <Row label="Competition" value={brief.jobAnalysis.competition_level} />
          <div className="rounded-lg border border-gold/30 bg-gold/8 px-3 py-2">
            <p className="text-[10px] font-mono text-gold mb-0.5">WIN PROBABILITY</p>
            <p className="text-sm text-white">{brief.jobAnalysis.win_probability}</p>
          </div>
        </div>
      </CropCard>

      {/* Proposal strategy */}
      <CropCard className="p-5">
        <Eyebrow><Lightbulb className="inline h-3 w-3 mr-1 text-gold" /> <span className="text-gold">proposal strategy</span></Eyebrow>
        <div className="mt-3 space-y-4 text-sm">
          <div className="rounded-lg border border-teal/30 bg-teal/8 p-4">
            <p className="text-[10px] font-mono text-teal mb-2">ONE-LINE HOOK — USE THIS TO OPEN YOUR PROPOSAL</p>
            <p className="text-white leading-relaxed font-medium">"{brief.proposalStrategy.one_line_hook}"</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-teal hover:bg-teal/10"
                onClick={() => { copyText(brief.proposalStrategy.one_line_hook); toast.success("Copied"); }}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button size="sm" className="h-6 px-2 text-[10px] bg-teal/20 text-teal border border-teal/30 hover:bg-teal/30"
                onClick={onUseInProposal}>
                <ChevronRight className="h-3 w-3 mr-1" /> Open in proposal generator →
              </Button>
            </div>
          </div>
          <Row label="Opening angle" value={brief.proposalStrategy.opening_angle} />
          <Row label="Tone" value={brief.proposalStrategy.recommended_tone} />
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">CREDIBILITY SIGNALS TO MENTION</p>
            <ul className="space-y-1">
              {brief.proposalStrategy.key_credibility_signals.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-gold shrink-0">·</span><span className="text-foreground/90">{s}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">OBJECTIONS TO PRE-EMPT</p>
            <ul className="space-y-1">
              {brief.proposalStrategy.objections_to_pre_empt.map((o, i) => (
                <li key={i} className="flex gap-2"><span className="text-red-400 shrink-0">·</span><span className="text-foreground/90">{o}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </CropCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className={cn("shrink-0 text-[10px] font-mono text-muted-foreground w-28")}>{label.toUpperCase()}</span>
      <span className="text-foreground/90">{value}</span>
    </div>
  );
}
