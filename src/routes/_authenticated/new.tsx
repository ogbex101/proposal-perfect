import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Loader2,
  Sparkles,
  Copy,
  FileDown,
  FileText,
  Save,
  AlertTriangle,
  Wand2,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { HOOKS, STRATEGIES, LENGTHS, type LengthId } from "@/lib/proposal-constants";
import { listCustomHooks, listCustomStrategies } from "@/lib/profile.functions";
import { analyzeJob, generateProposal, generateMilestones, generateStrategyDocument, applyProposalEdit, polishProposal, injectPortfolioLinks, type JobAnalysis, type StrategyDocument } from "@/lib/ai.functions";
import { VoiceEditPrompt } from "@/components/VoiceEditPrompt";
import { StrategyDocumentView } from "@/components/StrategyDocument";
import { saveProposal, getProposalAnalytics } from "@/lib/proposals.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { PortfolioPicker } from "@/components/PortfolioPicker";
type FreelancerProfile = { id: string; label: string };
import { saveItem } from "@/lib/saved.functions";
import { copyText, downloadTxt, downloadPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/new")({
  component: NewProposal,
});

function nichematch(item: { title: string; description: string }, niche: string): number {
  if (!niche) return 0;
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  const terms = niche.toLowerCase().split(/\s+/);
  return terms.filter((t) => haystack.includes(t)).length;
}

type Milestone = { title: string; description: string; amount?: string };

function NewProposal() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [method, setMethod] = useState<"paste" | "form">("paste");
  const [jobText, setJobText] = useState("");

  // Guided form
  const [clientName, setClientName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [keyReq, setKeyReq] = useState("");
  const [painPoints, setPainPoints] = useState("");

  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [hookId, setHookId] = useState<string>(HOOKS[0].id);
  const [strategyId, setStrategyId] = useState<string>(STRATEGIES[0].id);
  const [length, setLength] = useState<LengthId>("robust");
  const [includePlan, setIncludePlan] = useState(true);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string[]>([]);
  const [portfolioLink, setPortfolioLink] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [useMilestones, setUseMilestones] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const [content, setContent] = useState("");
  const [explanation, setExplanation] = useState<{
    hook: string;
    strategy: string;
    question: string;
  } | null>(null);
  const [showExplain, setShowExplain] = useState(true);

  const [strategyDoc, setStrategyDoc] = useState<StrategyDocument | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);

  const [chosenProfile, setChosenProfile] = useState<FreelancerProfile | null>(null);

  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const portfolio = portfolioQuery.data ?? [];
  const analyticsQuery = useQuery({ queryKey: ["proposal-analytics"], queryFn: () => getProposalAnalytics() });
  const analytics = analyticsQuery.data;

  const customHooksQuery = useQuery({ queryKey: ["custom-hooks"], queryFn: () => listCustomHooks() });
  const customStrategiesQuery = useQuery({ queryKey: ["custom-strategies"], queryFn: () => listCustomStrategies() });

  // Merged hook/strategy lists: built-in first, then user's custom ones
  const allHooks = [
    ...HOOKS,
    ...(customHooksQuery.data ?? []).map((h) => ({ id: `custom_hook_${h.id}`, name: `★ ${h.name}`, description: h.content })),
  ];
  const allStrategies = [
    ...STRATEGIES,
    ...(customStrategiesQuery.data ?? []).map((s) => ({ id: `custom_strat_${s.id}`, name: `★ ${s.name}`, description: s.content })),
  ];

  // Compose the effective job description from whichever input method is active.
  const effectiveJob = useMemo(() => {
    if (method === "paste") return jobText.trim();
    const parts = [
      clientName && `Client: ${clientName}`,
      projectType && `Project type: ${projectType}`,
      budget && `Budget: ${budget}`,
      keyReq && `Key requirements: ${keyReq}`,
      painPoints && `Pain points: ${painPoints}`,
    ].filter(Boolean);
    return parts.join("\n");
  }, [method, jobText, clientName, projectType, budget, keyReq, painPoints]);

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeJob({ data: { jobDescription: effectiveJob } }),
    onSuccess: (result) => {
      setAnalysis({ ...result, hookSuggestions: result.hookSuggestions ?? [], detectedNiche: result.detectedNiche ?? "", suggestedLength: result.suggestedLength ?? "robust" } as JobAnalysis);
      const h = HOOKS.find((x) => x.id === result.suggestedHookId);
      const s = STRATEGIES.find((x) => x.id === result.suggestedStrategyId);
      if (h) setHookId(h.id);
      if (s) setStrategyId(s.id);
      // Auto-select primary portfolio items if none chosen yet
      if (selectedPortfolio.length === 0) {
        const primaries = portfolio.filter((p) => p.is_primary).slice(0, 3).map((p) => p.id);
        if (primaries.length) setSelectedPortfolio(primaries);
      }
      toast.success("Job analyzed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const milestoneMutation = useMutation({
    mutationFn: () => generateMilestones({ data: { jobDescription: effectiveJob, budget: budget || undefined } }),
    onSuccess: (result) => {
      setMilestones(result ?? []);
      toast.success("Milestones drafted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate milestones"),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const items = portfolio
        .filter((p) => selectedPortfolio.includes(p.id))
        .map((p) => ({ title: p.title, url: p.url, description: p.description }));
      // Prepend the tailored AI/saved/pasted portfolio link, if one was chosen.
      if (portfolioLink) {
        items.unshift({
          title: "Portfolio",
          url: portfolioLink,
          description: "A portfolio tailored to this job.",
        });
      }
      return generateProposal({
        data: {
          jobDescription: effectiveJob,
          analysis,
          hookId,
          strategyId,
          length,
          includePlan,
          portfolioItems: items,
          milestones: useMilestones ? milestones : undefined,
          budget: budget || undefined,
        },
      });
    },
    onSuccess: (result) => {
      setContent(result.content);
      setExplanation(result.explanation);
      setShowExplain(true);
      toast.success("Proposal generated");
      // auto-polish with fresh content passed directly (avoid stale closure)
      setTimeout(() => polishMutation.mutate(result.content), 150);
      // auto-trigger strategy
      setTimeout(() => strategyMutation.mutate(), 400);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const strategyMutation = useMutation({
    mutationFn: () =>
      generateStrategyDocument({
        data: {
          jobDescription: effectiveJob,
          analysis,
          budget: budget || undefined,
        },
      }),
    onSuccess: (result) => {
      if (result) {
        setStrategyDoc(result);
        setShowStrategy(true);
        toast.success("Strategy document generated");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate strategy"),
  });

  const injectMutation = useMutation({
    mutationFn: () => {
      const items = portfolio
        .filter((p) => selectedPortfolio.includes(p.id))
        .map((p) => ({ title: p.title, url: p.url, description: p.description ?? "" }));
      if (portfolioLink) {
        items.unshift({ title: "Portfolio", url: portfolioLink, description: "Tailored portfolio for this job." });
      }
      return injectPortfolioLinks({ data: { proposal: content, portfolioItems: items } });
    },
    onSuccess: (res) => {
      if (res?.content) {
        setContent(res.content);
        toast.success("Portfolio links updated in proposal");
      }
    },
    onError: () => toast.error("Could not update portfolio in proposal"),
  });

  const voiceEditMutation = useMutation({
    mutationFn: (instruction: string) =>
      applyProposalEdit({ data: { proposalText: content, instruction } }),
    onSuccess: (res) => {
      if (res?.text) {
        setContent(res.text);
        toast.success("Voice edit applied");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Voice edit failed"),
  });

  const polishMutation = useMutation({
    mutationFn: (proposalText?: string) => polishProposal({ data: { proposal: proposalText ?? content } }),
    onSuccess: (res) => {
      if (res?.content) {
        setContent(res.content);
        toast.success("Proposal polished — punctuation and formatting fixed");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not polish proposal"),
  });

  const prevSelectedRef = useRef<string[]>([]);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedPortfolio;
    if (!content || selectedPortfolio === prev) return;
    // Only inject if selection actually changed
    const added = selectedPortfolio.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !selectedPortfolio.includes(id));
    if (added.length === 0 && removed.length === 0) return;
    injectMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolio, portfolioLink]);

  const saveMutation = useMutation({
    mutationFn: (profile?: FreelancerProfile) => {
      const title =
        effectiveJob.split("\n")[0].slice(0, 70) || "Untitled proposal";
      return saveProposal({
        data: {
          title,
          job_description: effectiveJob,
          job_analysis: analysis,
          hook: hookId,
          strategy: strategyId,
          length,
          include_plan: includePlan,
          portfolio_ids: selectedPortfolio,
          budget: budget || null,
          milestones: useMilestones ? milestones : null,
          content,
          explanation,
          // attach profile label if chosen
          ...(profile ? { profile_label: profile.label, profile_id: profile.id } : {}),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Saved to history");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: () =>
      saveItem({
        data: {
          kind: "proposal",
          ref_id: null,
          snapshot: { title: effectiveJob.split("\n")[0].slice(0, 70), content, hookId, strategyId, length },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved"] });
      toast.success("Saved as template");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save template"),
  });

  const canAnalyze = effectiveJob.length >= 20;
  const canGenerate = effectiveJob.length >= 10;

  // Auto-analyze when job text is long enough and no analysis yet
  const autoAnalyzeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!canAnalyze || analysis || analyzeMutation.isPending) return;
    if (autoAnalyzeRef.current) clearTimeout(autoAnalyzeRef.current);
    autoAnalyzeRef.current = setTimeout(() => {
      analyzeMutation.mutate();
    }, 1800);
    return () => {
      if (autoAnalyzeRef.current) clearTimeout(autoAnalyzeRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveJob, analysis]);

  function reset() {
    setAnalysis(null);
    setContent("");
    setExplanation(null);
    setMilestones([]);
    setChosenProfile(null);
    setStrategyDoc(null);
    setShowStrategy(false);
  }

  function requestSave() {
    saveMutation.mutate(undefined);
  }

  function requestSaveTemplate() {
    saveTemplateMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        eyebrow="New proposal"
        title="Draft a proposal"
        description="Paste a job post or fill the guided form. Analyze it, tune the angle, then generate."
        action={
          (content || analysis) && (
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start over
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT: input + analysis */}
        <div className="space-y-6">
          {/* Method switch */}
          <div className="flex gap-2">
            <Segment active={method === "paste"} onClick={() => setMethod("paste")}>
              Paste job description
            </Segment>
            <Segment active={method === "form"} onClick={() => setMethod("form")}>
              Guided form
            </Segment>
          </div>

          <CropCard className="p-5">
            {method === "paste" ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="annotation !text-muted-foreground">Job post</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {jobText.length} chars
                  </span>
                </div>
                <Textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={9}
                  placeholder="Paste the entire job post from Upwork or any platform…"
                  className="resize-y bg-background/60 leading-relaxed"
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client name">
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Co." />
                </Field>
                <Field label="Project type">
                  <Input value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="Shopify store fix" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Key requirements">
                    <Textarea value={keyReq} onChange={(e) => setKeyReq(e.target.value)} rows={3} placeholder="What they need built or fixed…" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Pain points">
                    <Textarea value={painPoints} onChange={(e) => setPainPoints(e.target.value)} rows={3} placeholder="What's frustrating them right now…" />
                  </Field>
                </div>
              </div>
            )}

            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={!canAnalyze || analyzeMutation.isPending}
              className="mt-4 w-full bg-teal/15 text-teal hover:bg-teal/25"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reading the brief…
                </>
              ) : (
                <>
                  <ScanLine className="mr-1.5 h-4 w-4" /> Analyze job
                </>
              )}
            </Button>
          </CropCard>

          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>

        {/* RIGHT: configure + output */}
        <div className="space-y-6">
          <CropCard glow="gold" className="p-5">
            <Eyebrow>Configure</Eyebrow>
            {analytics && analytics.bestHook && (
              <div className="mt-3 rounded-md border border-gold/25 bg-gold/[0.06] p-3">
                <p className="text-xs font-medium text-gold">
                  💡 Based on your history, <strong>"{HOOKS.find((h) => h.id === analytics.bestHook)?.name ?? analytics.bestHook}"</strong> has the best response rate ({analytics.hookStats.find((h) => h.id === analytics.bestHook)?.responseRate ?? 0}%).
                </p>
              </div>
            )}
            <div className="mt-4 space-y-5">
              {/* Hook selector */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Hook style</Label>
                <div className="grid gap-1.5">
                  {allHooks.map((h) => {
                    const stat = analytics?.hookStats?.find((s) => s.id === h.id);
                    const isActive = hookId === h.id;
                    const isBest = analytics?.bestHook === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHookId(h.id)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          isActive ? "border-gold/50 bg-gold/8" : "border-border/40 bg-background/30 hover:border-border/70"
                        )}
                      >
                        <div className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 transition-colors",
                          isActive ? "border-gold bg-gold" : "border-muted-foreground")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("text-sm font-medium", isActive ? "text-white" : "text-foreground/80")}>{h.name}</span>
                            {isBest && <span className="rounded-full bg-gold/20 border border-gold/30 px-1.5 py-0.5 text-[9px] font-medium text-gold">★ Best</span>}
                            {stat && <span className="rounded-full bg-teal/10 border border-teal/20 px-1.5 py-0.5 text-[9px] text-teal">{stat.responseRate}% response</span>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{h.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strategy selector */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Strategy</Label>
                <div className="grid gap-1.5">
                  {allStrategies.map((s) => {
                    const isActive = strategyId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStrategyId(s.id)}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          isActive ? "border-teal/50 bg-teal/8" : "border-border/40 bg-background/30 hover:border-border/70"
                        )}
                      >
                        <div className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 transition-colors",
                          isActive ? "border-teal bg-teal" : "border-muted-foreground")} />
                        <div className="min-w-0">
                          <span className={cn("text-sm font-medium", isActive ? "text-white" : "text-foreground/80")}>{s.name}</span>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{s.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Length</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLength(l.id)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                        length === l.id
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-border text-muted-foreground hover:text-white",
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Include execution plan"
                hint="A 2–3 sentence approach the client approves step by step."
                checked={includePlan}
                onCheckedChange={setIncludePlan}
              />

              {/* AI / saved / pasted portfolio for this job */}
              <PortfolioPicker
                jobDescription={effectiveJob}
                currentLink={portfolioLink}
                onLinkChange={setPortfolioLink}
              />

              {/* Portfolio selection */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">
                  Additional portfolio links · up to 3
                </Label>
                {portfolio.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No portfolio items yet. Add them under Portfolio to weave links into proposals.
                  </p>
                ) : (
                  <>
                  {/* No-match hint */}
                  {analysis && portfolio.length > 0 && portfolio.every(p => nichematch(p, analysis.detectedNiche ?? "") === 0) && (
                    <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold mb-2">
                      No portfolio items match "<strong>{analysis.detectedNiche}</strong>".{" "}
                      Consider adding a portfolio piece for this niche in the{" "}
                      <a href="/portfolio" className="underline hover:no-underline">Portfolio</a> section.
                    </div>
                  )}
                  <div className="space-y-2">
                    {portfolio.map((p) => {
                      const checked = selectedPortfolio.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background/40 p-2.5"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) {
                                if (selectedPortfolio.length >= 3) {
                                  toast.info("Three portfolio links max per proposal");
                                  return;
                                }
                                setSelectedPortfolio([...selectedPortfolio, p.id]);
                              } else {
                                setSelectedPortfolio(selectedPortfolio.filter((id) => id !== p.id));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              {p.title}
                              {p.is_primary && <span className="annotation !text-gold">Primary</span>}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{p.url}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              {/* Budget + milestones */}
              <Field label="Budget (optional)">
                <Input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="$1500, $40/hr, or a range"
                />
              </Field>

              <ToggleRow
                label="Generate milestones"
                hint="A sensible milestone breakdown based on scope and budget."
                checked={useMilestones}
                onCheckedChange={(v) => {
                  setUseMilestones(v);
                  if (v && milestones.length === 0 && canGenerate) milestoneMutation.mutate();
                }}
              />

              {useMilestones && (
                <MilestoneEditor
                  milestones={milestones}
                  setMilestones={setMilestones}
                  onRegenerate={() => milestoneMutation.mutate()}
                  regenerating={milestoneMutation.isPending}
                />
              )}

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate || generateMutation.isPending}
                className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Generate proposal
                  </>
                )}
              </Button>
            </div>
          </CropCard>

          {content && (
            <OutputPanel
              content={content}
              setContent={setContent}
              explanation={explanation}
              showExplain={showExplain}
              setShowExplain={setShowExplain}
              title={effectiveJob.split("\n")[0].slice(0, 60) || "Proposal"}
              onSave={requestSave}
              saving={saveMutation.isPending}
              onSaveTemplate={requestSaveTemplate}
              savingTemplate={saveTemplateMutation.isPending}
              chosenProfile={chosenProfile}
              onGoHistory={() => navigate({ to: "/history" })}
              injecting={injectMutation.isPending}
              onPolish={() => polishMutation.mutate(undefined)}
              polishing={polishMutation.isPending}
            />
          )}

          {/* Strategy Document */}
          {strategyDoc && showStrategy && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <Eyebrow>Project strategy</Eyebrow>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setShowStrategy(false)}
                  >
                    Hide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadPdf(`Strategy-${strategyDoc.projectTitle}`, formatStrategyAsText(strategyDoc))}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download PDF
                  </Button>
                </div>
              </div>
              <StrategyDocumentView doc={strategyDoc} />
            </div>
          )}

        </div>
      </div>
      {content && (
        <VoiceEditPrompt
          onApply={(instruction) => voiceEditMutation.mutate(instruction)}
          isPending={voiceEditMutation.isPending}
        />
      )}
    </div>
  );
}

/* ---------- Strategy helper ---------- */
function formatStrategyAsText(doc: StrategyDocument): string {
  const lines: string[] = [
    `STRATEGY DOCUMENT: ${doc.projectTitle}`,
    `Estimated Duration: ${doc.totalDays} working days`,
    "",
    "OVERVIEW",
    doc.overview,
    "",
    "PROJECT PHASES",
    ...doc.phases.map((p) => [
      `Phase ${p.phase}: ${p.name} (${p.days})`,
      "  Deliverables: " + p.deliverables.join(", "),
      "  Risks: " + p.risks.join(", "),
    ].join("\n")),
    "",
    "FEATURE BREAKDOWN",
    ...doc.featureBreakdown.map((f) => `• ${f.feature} [${f.priority}] — ${f.estimatedDays}d — ${f.notes}`),
    "",
    "CRITICAL PATH",
    ...doc.criticalPath.map((c, i) => `${i + 1}. ${c}`),
    "",
    "SUCCESS METRICS",
    ...doc.successMetrics.map((m) => `• ${m}`),
    "",
    "RECOMMENDATION",
    doc.recommendation,
  ];
  return lines.join("\n");
}

/* ---------- Analysis panel ---------- */
function AnalysisPanel({ analysis }: { analysis: JobAnalysis }) {
  const hook = HOOKS.find((h) => h.id === analysis.suggestedHookId);
  const strat = STRATEGIES.find((s) => s.id === analysis.suggestedStrategyId);
  return (
    <CropCard className="p-5 bp-rise">
      <Eyebrow index="A">Job analysis</Eyebrow>
      <div className="mt-4 space-y-4">
        <Block title="Summary">{analysis.summary}</Block>
        <Block title="Client pain point">{analysis.painPoint}</Block>
        <Block title="Hidden needs">{analysis.hiddenNeeds}</Block>

        {analysis.technicalDifficulties?.length > 0 && (
          <div>
            <p className="annotation mb-2 !text-teal">Technical difficulties</p>
            <ul className="space-y-2">
              {analysis.technicalDifficulties.map((d, i) => (
                <li key={i} className="flex gap-2.5 rounded-md border border-border bg-background/40 p-2.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  <span className="text-sm">
                    <span className="font-medium text-white">{d.title}.</span>{" "}
                    <span className="text-muted-foreground">{d.explanation}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Block title="Recommended approach">{analysis.recommendedApproach}</Block>

        <div className="grid gap-3 sm:grid-cols-2">
          <SuggestionCard label="Suggested hook" name={hook?.name ?? analysis.suggestedHookId} reason={analysis.hookReason} />
          <SuggestionCard label="Suggested strategy" name={strat?.name ?? analysis.suggestedStrategyId} reason={analysis.strategyReason} />
        </div>
        <p className="annotation !text-muted-foreground">
          Suggestions applied below — override the dropdowns any time.
        </p>
      </div>
    </CropCard>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="annotation mb-1 !text-teal">{title}</p>
      <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
    </div>
  );
}

function SuggestionCard({ label, name, reason }: { label: string; name: string; reason: string }) {
  return (
    <div className="rounded-md border border-gold/25 bg-gold/[0.05] p-3">
      <p className="annotation !text-gold">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{name}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>
    </div>
  );
}

/* ---------- Output panel ---------- */
function OutputPanel({
  content, setContent, explanation, showExplain, setShowExplain,
  title, onSave, saving, onSaveTemplate, savingTemplate, chosenProfile, onGoHistory, injecting, onPolish, polishing,
}: {
  content: string; setContent: (v: string) => void;
  explanation: { hook: string; strategy: string; question: string } | null;
  showExplain: boolean; setShowExplain: (v: boolean) => void;
  title: string; onSave: () => void; saving: boolean;
  onSaveTemplate: () => void; savingTemplate: boolean;
  chosenProfile?: { label: string } | null; onGoHistory: () => void;
  injecting?: boolean; onPolish?: () => void; polishing?: boolean;
}) {
  const [editMode, setEditMode] = useState(false);

  // Parse proposal into paragraphs, strip horizontal rules
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0 && !/^[\s\-_*=]{3,}$/.test(p));

  return (
    <CropCard glow="gold" className="p-5 bp-rise">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eyebrow>Proposal</Eyebrow>
          {injecting && <span className="flex items-center gap-1 text-[10px] text-teal"><Loader2 className="h-2.5 w-2.5 animate-spin" /> updating portfolio…</span>}
        </div>
        <div className="flex items-center gap-2">
          {chosenProfile && (
            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-medium text-teal">{chosenProfile.label}</span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">{content.length} chars</span>
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn("rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              editMode ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-white")}
          >
            {editMode ? "Preview" : "Edit"}
          </button>
        </div>
      </div>

      {editMode ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="resize-y bg-background/60 text-sm leading-relaxed font-mono"
        />
      ) : (
        <div className="rounded-xl border border-border/40 bg-background/50 px-6 py-5">
          {paragraphs.map((para, i) => (
            <p key={i} className={cn(
              "leading-[1.85] mb-4 last:mb-0",
              i === 0 ? "text-[15px] text-white font-medium" : "text-[14px] text-foreground/88"
            )}>
              {para}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => copyText(content).then(() => toast.success("Copied to clipboard"))}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadTxt(title, content)}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> .txt
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadPdf(title, content).then(() => toast.success("PDF downloaded")).catch(() => toast.error("PDF failed"))}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-gold text-primary-foreground hover:bg-gold-bright">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="mr-1.5 h-3.5 w-3.5" /> Save</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSaveTemplate} disabled={savingTemplate} className="text-muted-foreground">
          Save template
        </Button>
        {onPolish && (
          <Button size="sm" variant="ghost" onClick={onPolish} disabled={polishing} className="text-teal/80 hover:text-teal ml-auto">
            {polishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Polish
          </Button>
        )}
      </div>

      {explanation && (
        <div className="mt-4 border-t border-border/70 pt-4">
          <button onClick={() => setShowExplain(!showExplain)} className="annotation hover:text-teal">
            {showExplain ? "Hide" : "Show"} the strategy behind it
          </button>
          {showExplain && (
            <div className="mt-3 space-y-3">
              <Explain label="Why this hook">{explanation.hook}</Explain>
              <Explain label="Why this strategy">{explanation.strategy}</Explain>
              <Explain label="Why this question">{explanation.question}</Explain>
              <p className="annotation !text-muted-foreground">This panel never appears in the exported proposal.</p>
            </div>
          )}
        </div>
      )}
    </CropCard>
  );
}

function Explain({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-teal/20 bg-teal/5 p-3">
      <p className="annotation !text-teal">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}

/* ---------- Milestone editor ---------- */
function MilestoneEditor({
  milestones,
  setMilestones,
  onRegenerate,
  regenerating,
}: {
  milestones: Milestone[];
  setMilestones: (m: Milestone[]) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  function update(i: number, patch: Partial<Milestone>) {
    setMilestones(milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="annotation !text-muted-foreground">Milestones</span>
        <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={regenerating} className="h-7 text-xs text-teal">
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wand2 className="mr-1 h-3 w-3" /> Auto-draft</>}
        </Button>
      </div>
      <div className="space-y-2">
        {milestones.map((m, i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <div className="flex gap-2">
              <Input value={m.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Title" className="h-8 text-sm" />
              <Input value={m.amount ?? ""} onChange={(e) => update(i, { amount: e.target.value })} placeholder="$" className="h-8 w-24 text-sm" />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input value={m.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="What's delivered" className="mt-1.5 h-8 text-sm" />
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setMilestones([...milestones, { title: "", description: "", amount: "" }])} className="w-full text-xs text-muted-foreground">
          <Plus className="mr-1 h-3 w-3" /> Add milestone
        </Button>
      </div>
    </div>
  );
}

/* ---------- small helpers ---------- */
function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "border-teal/40 bg-teal/10 text-teal" : "border-border text-muted-foreground hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-background/40 p-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </div>
  );
}
