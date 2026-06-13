import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Map,
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
import { listSubProfiles } from "@/lib/sub-profile.functions";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { analyzeJob, generateProposal, generateMilestones, generateStrategyDocument, generateAiHookStrategy, type JobAnalysis, type StrategyDocument, type AiHookStrategy } from "@/lib/ai.functions";
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

  // Language: "english" keeps proposal in English, "detected" writes it in the job's language
  const [proposalLanguage, setProposalLanguage] = useState<"english" | "detected">("english");

  // AI-generated custom hook/strategy
  const [aiHookStrategy, setAiHookStrategy] = useState<AiHookStrategy | null>(null);
  const AI_HOOK_ID = "__ai__";
  const AI_STRATEGY_ID = "__ai__";

  const [chosenProfile, setChosenProfile] = useState<FreelancerProfile | null>(null);

  const { subs, activeSubId } = useActiveProfile();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(activeSubId);

  const subProfilesQuery = useQuery({
    queryKey: ["sub-profiles"],
    queryFn: () => listSubProfiles(),
  });
  const subProfiles = subProfilesQuery.data ?? [];

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
      const normalized: JobAnalysis = {
        ...result,
        detectedLanguage: result.detectedLanguage ?? "English",
        suggestedLength: result.suggestedLength ?? "robust",
      };
      setAnalysis(normalized);
      const h = HOOKS.find((x) => x.id === result.suggestedHookId);
      const s = STRATEGIES.find((x) => x.id === result.suggestedStrategyId);
      if (h) setHookId(h.id);
      if (s) setStrategyId(s.id);
      // Auto-apply AI-suggested length
      if (result.suggestedLength) setLength(result.suggestedLength as LengthId);
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
      const detectedLang = analysis?.detectedLanguage;
      const targetLanguage =
        proposalLanguage === "detected" && detectedLang && detectedLang.toLowerCase() !== "english"
          ? detectedLang
          : undefined;
      const customHookText = hookId === AI_HOOK_ID && aiHookStrategy
        ? `${aiHookStrategy.hookName}: ${aiHookStrategy.hookOpeningLine} (${aiHookStrategy.hookRationale})`
        : undefined;
      const customStrategyText = strategyId === AI_STRATEGY_ID && aiHookStrategy
        ? `${aiHookStrategy.strategyName}: ${aiHookStrategy.strategyApproach}`
        : undefined;
      return generateProposal({
        data: {
          jobDescription: effectiveJob,
          analysis,
          hookId: hookId === AI_HOOK_ID ? HOOKS[0].id : hookId,
          strategyId: strategyId === AI_STRATEGY_ID ? STRATEGIES[0].id : strategyId,
          customHookText,
          customStrategyText,
          length,
          includePlan,
          portfolioItems: items,
          milestones: useMilestones ? milestones : undefined,
          budget: budget || undefined,
          targetLanguage,
        },
      });
    },
    onSuccess: async (result) => {
      setContent(result.content);
      setExplanation(result.explanation);
      setShowExplain(true);
      // Auto-save to history so every generated proposal is archived.
      try {
        const title = effectiveJob.split("\n")[0].slice(0, 70) || "Untitled proposal";
        await saveProposal({
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
            content: result.content,
            explanation: result.explanation,
          },
        });
        queryClient.invalidateQueries({ queryKey: ["proposals"] });
        queryClient.invalidateQueries({ queryKey: ["proposal-analytics"] });
        toast.success("Proposal generated & saved to history");
      } catch {
        // Generation still succeeded; saving failed silently — user can save manually.
        toast.success("Proposal generated");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const aiHookStrategyMutation = useMutation({
    mutationFn: () => generateAiHookStrategy({ data: { jobDescription: effectiveJob, analysis } }),
    onSuccess: (result) => {
      if (result) {
        setAiHookStrategy(result);
        setHookId(AI_HOOK_ID);
        setStrategyId(AI_STRATEGY_ID);
        toast.success("AI hook + strategy crafted for this job");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate hook/strategy"),
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

  function reset() {
    setAnalysis(null);
    setContent("");
    setExplanation(null);
    setMilestones([]);
    setChosenProfile(null);
    setStrategyDoc(null);
    setShowStrategy(false);
    setProposalLanguage("english");
    setAiHookStrategy(null);
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
          {/* Profile selector */}
          {subProfiles.length > 0 && (
            <CropCard className="p-4">
              <div className="flex items-center gap-3">
                <Label className="shrink-0 text-xs text-muted-foreground">Generating as:</Label>
                <Select
                  value={selectedSubId ?? "head"}
                  onValueChange={(v) => setSelectedSubId(v === "head" ? null : v)}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head">Head Profile (main)</SelectItem>
                    {subProfiles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CropCard>
          )}

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
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hook">
                    <Select value={hookId} onValueChange={(v) => { setHookId(v); if (v !== AI_HOOK_ID) setAiHookStrategy(null); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AI_HOOK_ID}>
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-teal" />
                            {aiHookStrategy ? `✓ ${aiHookStrategy.hookName}` : "AI-crafted for this job"}
                          </span>
                        </SelectItem>
                        {allHooks.map((h) => (
                          <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Strategy">
                    <Select value={strategyId} onValueChange={(v) => { setStrategyId(v); if (v !== AI_STRATEGY_ID) setAiHookStrategy(null); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AI_STRATEGY_ID}>
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-teal" />
                            {aiHookStrategy ? `✓ ${aiHookStrategy.strategyName}` : "AI-crafted for this job"}
                          </span>
                        </SelectItem>
                        {allStrategies.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Generate AI hook+strategy button (shown when either is set to AI) */}
                {(hookId === AI_HOOK_ID || strategyId === AI_STRATEGY_ID) && !aiHookStrategy && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-teal/30 text-teal hover:bg-teal/10"
                    disabled={!canAnalyze || aiHookStrategyMutation.isPending}
                    onClick={() => aiHookStrategyMutation.mutate()}
                  >
                    {aiHookStrategyMutation.isPending ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Crafting…</>
                    ) : (
                      <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate AI hook + strategy</>
                    )}
                  </Button>
                )}

                {/* Preview of the AI-generated hook */}
                {aiHookStrategy && (hookId === AI_HOOK_ID || strategyId === AI_STRATEGY_ID) && (
                  <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-3 space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal mb-0.5">{aiHookStrategy.hookName}</p>
                      <p className="text-xs text-white/90 italic">"{aiHookStrategy.hookOpeningLine}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gold mb-0.5">{aiHookStrategy.strategyName}</p>
                      <p className="text-xs text-muted-foreground">{aiHookStrategy.strategyApproach}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-white"
                      onClick={() => aiHookStrategyMutation.mutate()}
                      disabled={aiHookStrategyMutation.isPending}
                    >
                      {aiHookStrategyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "↻ Regenerate"}
                    </Button>
                  </div>
                )}
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

              {/* Language selector — shown when job is not in English */}
              {analysis?.detectedLanguage && analysis.detectedLanguage.toLowerCase() !== "english" && (
                <div className="rounded-md border border-border bg-background/40 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Job detected in <span className="font-semibold text-white">{analysis.detectedLanguage}</span>. Proposal language:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProposalLanguage("english")}
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                        proposalLanguage === "english"
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-border text-muted-foreground hover:text-white",
                      )}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setProposalLanguage("detected")}
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                        proposalLanguage === "detected"
                          ? "border-teal/50 bg-teal/10 text-teal"
                          : "border-border text-muted-foreground hover:text-white",
                      )}
                    >
                      {analysis.detectedLanguage}
                    </button>
                  </div>
                </div>
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
            />
          )}

          {content && canGenerate && (
            <Button
              variant="outline"
              size="sm"
              disabled={strategyMutation.isPending}
              onClick={() => strategyMutation.mutate()}
              className="border-teal/40 text-teal hover:bg-teal/10"
            >
              {strategyMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Map className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate strategy doc
            </Button>
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
  content,
  setContent,
  explanation,
  showExplain,
  setShowExplain,
  title,
  onSave,
  saving,
  onSaveTemplate,
  savingTemplate,
  chosenProfile,
  onGoHistory,
}: {
  content: string;
  setContent: (v: string) => void;
  explanation: { hook: string; strategy: string; question: string } | null;
  showExplain: boolean;
  setShowExplain: (v: boolean) => void;
  title: string;
  onSave: () => void;
  saving: boolean;
  onSaveTemplate: () => void;
  savingTemplate: boolean;
  chosenProfile?: { label: string } | null;
  onGoHistory: () => void;
}) {
  return (
    <CropCard glow="gold" className="p-5 bp-rise">
      <div className="flex items-center justify-between">
        <Eyebrow>Generated proposal</Eyebrow>
        <div className="flex items-center gap-2">
          {chosenProfile && (
            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-medium text-teal">
              {chosenProfile.label}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">{content.length} chars</span>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        className="mt-3 resize-y bg-background/60 text-sm leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => copyText(content).then(() => toast.success("Copied"))}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadTxt(title, content)}>
          <FileText className="mr-1.5 h-3.5 w-3.5" /> .txt
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadPdf(title, content).then(() => toast.success("PDF downloaded")).catch(() => toast.error("PDF failed"))}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-gold text-primary-foreground hover:bg-gold-bright">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="mr-1.5 h-3.5 w-3.5" /> Save to history</>}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSaveTemplate} disabled={savingTemplate} className="text-muted-foreground">
          Save as template
        </Button>
      </div>

      {explanation && (
        <div className="mt-5 border-t border-border/70 pt-4">
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
