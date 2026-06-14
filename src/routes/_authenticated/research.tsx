import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Brain, Loader2, Target, AlertTriangle, TrendingUp,
  Lightbulb, Zap, Copy, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { cn } from "@/lib/utils";
import { researchClientAndJob, type ResearchBrief } from "@/lib/ai.functions";
import { copyText } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

function ResearchPage() {
  const [jobText, setJobText] = useState("");
  const [clientInfo, setClientInfo] = useState("");
  const [brief, setBrief] = useState<ResearchBrief | null>(null);

  const research = useMutation({
    mutationFn: () => researchClientAndJob({ data: { jobText, clientInfo: clientInfo || undefined } }),
    onSuccess: (data) => { if (data) setBrief(data); },
    onError: (e: Error) => toast.error(e.message || "Research failed"),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Intelligence"
        title="Research Agent"
        description="Paste a job post and the AI gives you a full intel brief — client profile, real problem, win probability, and the best proposal opening."
      />

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
