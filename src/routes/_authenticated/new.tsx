import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Star,
  Zap,
  MessageSquarePlus,
  Link2,
  ExternalLink,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { MicButton } from "@/components/MicButton";
import { VoiceEditPrompt } from "@/components/VoiceEditPrompt";
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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { HOOKS, STRATEGIES, LENGTHS, type LengthId } from "@/lib/proposal-constants";
import { listCustomHooks, listCustomStrategies } from "@/lib/profile.functions";
import { listSubProfiles } from "@/lib/sub-profile.functions";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { analyzeJob, generateProposalImage, generateProposal, generateMilestones, generateStrategyDocument, generateAiHookStrategy, analyzeHookStrength, applyProposalEdit, type JobAnalysis, type StrategyDocument, type AiHookStrategy, type HookStrength } from "@/lib/ai.functions";
import { StrategyDocumentView } from "@/components/StrategyDocument";
import { saveProposal, getProposalAnalytics } from "@/lib/proposals.functions";
import { saveStrategyDoc } from "@/lib/strategy.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { listGeneratedPortfolios } from "@/lib/portfolio-generate.functions";
import { PortfolioPicker } from "@/components/PortfolioPicker";
type FreelancerProfile = { id: string; label: string };
import { saveItem } from "@/lib/saved.functions";
import { lookupFreelancerProject, submitFreelancerBid } from "@/lib/freelancer.functions";
import { copyText, downloadTxt, downloadPdf, downloadElementAsPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/new")({
  component: NewProposal,
});

type Milestone = { title: string; description: string; amount?: string };

function nichematch(item: { title: string; description: string }, niche: string): number {
  if (!niche) return 0;
  const text = (item.title + " " + item.description).toLowerCase();
  const words = niche.toLowerCase().split(/[\s,/&\-]+/).filter((w) => w.length > 3);
  return words.filter((w) => text.includes(w)).length;
}

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
  const strategyRef = useRef<HTMLDivElement>(null);
  const [strategyLink, setStrategyLink] = useState<string | null>(null);
  const strategyLinkApplied = useRef(false);

  // Language: "english" keeps proposal in English, "detected" writes it in the job's language
  const [proposalLanguage, setProposalLanguage] = useState<"english" | "detected">("english");
  const [toneAssertiveness, setToneAssertiveness] = useState(3); // 1-5
  const [toneFormalness, setToneFormalness] = useState(3);       // 1-5

  // AI-generated custom hook/strategy
  const [aiHookStrategy, setAiHookStrategy] = useState<AiHookStrategy | null>(null);
  const AI_HOOK_ID = "__ai__";
  const AI_STRATEGY_ID = "__ai__";

  const [hookStrength, setHookStrength] = useState<HookStrength | null>(null);
  const [showHookAnalysis, setShowHookAnalysis] = useState(false);

  const [chosenProfile, setChosenProfile] = useState<FreelancerProfile | null>(null);

  // Freelancer.com integration
  const [freelancerUrl, setFreelancerUrl] = useState("");
  const [freelancerProject, setFreelancerProject] = useState<{ id: number; title: string; budget: { minimum?: number; maximum?: number }; currency: string } | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("7");

  // Prefill from history "Use as template" or Research Agent
  const [researchHookSuggestion, setResearchHookSuggestion] = useState<string | null>(null);
  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill_job");
    if (prefill) {
      setJobText(prefill);
      setMethod("paste");
      sessionStorage.removeItem("prefill_job");
    }
    const hook = sessionStorage.getItem("prefill_hook");
    if (hook) {
      setResearchHookSuggestion(hook);
      sessionStorage.removeItem("prefill_hook");
    }
  }, []);

  const { subs, activeSubId } = useActiveProfile();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(activeSubId);

  const subProfilesQuery = useQuery({
    queryKey: ["sub-profiles"],
    queryFn: () => listSubProfiles(),
  });
  const subProfiles = subProfilesQuery.data ?? [];

  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const portfolio = portfolioQuery.data ?? [];

  const generatedPortfoliosQuery = useQuery({
    queryKey: ["generated-portfolios"],
    queryFn: () => listGeneratedPortfolios(),
  });
  const generatedPortfolios = generatedPortfoliosQuery.data ?? [];
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

  const matchedPortfolio = useMemo(() => {
    const niche = analysis?.detectedNiche?.toLowerCase().trim();
    if (!niche || !generatedPortfolios.length) return null;
    return generatedPortfolios.find((gp) => {
      const gpNiche = (gp.niche ?? "").toLowerCase().trim();
      // Check if niche strings share significant words
      const nicheWords = niche.split(/\s+/).filter((w) => w.length > 3);
      return nicheWords.some((w) => gpNiche.includes(w)) || gpNiche.includes(niche) || niche.includes(gpNiche);
    }) ?? null;
  }, [analysis?.detectedNiche, generatedPortfolios]);

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
        detectedNiche: result.detectedNiche ?? "",
        hookSuggestions: result.hookSuggestions ?? [],
      };
      setAnalysis(normalized);
      const h = HOOKS.find((x) => x.id === result.suggestedHookId);
      const s = STRATEGIES.find((x) => x.id === result.suggestedStrategyId);
      if (h) setHookId(h.id);
      if (s) setStrategyId(s.id);
      if (result.suggestedLength) setLength(result.suggestedLength as LengthId);
      if (selectedPortfolio.length === 0) {
        const niche = result.detectedNiche ?? "";
        if (niche) {
          const byNiche = [...portfolio]
            .map((p) => ({ p, score: nichematch(p, niche) + (p.is_primary ? 0.3 : 0) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);
          const ids = byNiche.slice(0, 3).map((x) => x.p.id);
          if (ids.length) {
            setSelectedPortfolio(ids);
          } else {
            const primaries = portfolio.filter((p) => p.is_primary).slice(0, 3).map((p) => p.id);
            if (primaries.length) setSelectedPortfolio(primaries);
          }
        } else {
          const primaries = portfolio.filter((p) => p.is_primary).slice(0, 3).map((p) => p.id);
          if (primaries.length) setSelectedPortfolio(primaries);
        }
      }
      // Pass fresh normalized analysis directly — React state update is async
      // so reading `analysis` inside the mutations would give stale null.
      strategyMutation.mutate(normalized);
      generateMutation.mutate(normalized);
      toast.success("Analyzing… generating proposal & strategy");
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
    // Accept an analysisOverride so the auto-trigger can pass fresh analysis
    // without waiting for React state to flush.
    mutationFn: async (analysisOverride?: JobAnalysis | null) => {
      const activeAnalysis = analysisOverride !== undefined ? analysisOverride : analysis;
      const items = portfolio
        .filter((p) => selectedPortfolio.includes(p.id))
        .map((p) => ({ title: p.title, url: p.url, description: p.description }));
      if (portfolioLink) {
        items.unshift({
          title: "Portfolio",
          url: portfolioLink,
          description: "A portfolio tailored to this job.",
        });
      }
      const detectedLang = activeAnalysis?.detectedLanguage;
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
          analysis: activeAnalysis,
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
          strategyDocument: strategyDoc
            ? `Project: ${strategyDoc.projectTitle}. Overview: ${strategyDoc.overview}. Phases: ${strategyDoc.phases.map((p) => `${p.name} (${p.days}): ${p.deliverables.join(", ")}`).join(" → ")}. Critical path: ${strategyDoc.criticalPath.join(", ")}. Total: ${strategyDoc.totalDays} days.`
            : undefined,
          toneAssertiveness,
          toneFormalness,
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

  const hookStrengthMutation = useMutation({
    mutationFn: () => {
      // Extract the first paragraph of the content as the hook
      const hookText = content.split("\n\n")[0] || content.slice(0, 400);
      return analyzeHookStrength({ data: { hookText, jobDescription: effectiveJob } });
    },
    onSuccess: (result) => {
      if (result) {
        setHookStrength(result);
        setShowHookAnalysis(true);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not analyze hook"),
  });

  const strategyMutation = useMutation({
    mutationFn: (analysisOverride?: JobAnalysis | null) => {
      const activeAnalysis = analysisOverride !== undefined ? analysisOverride : analysis;
      const detectedLang = activeAnalysis?.detectedLanguage;
      return generateStrategyDocument({
        data: {
          jobDescription: effectiveJob,
          analysis: activeAnalysis,
          budget: budget || undefined,
          targetLanguage: proposalLanguage === "detected" && detectedLang && detectedLang.toLowerCase() !== "english"
            ? detectedLang
            : undefined,
        },
      });
    },
    onSuccess: async (result) => {
      if (result) {
        setStrategyDoc(result);
        setShowStrategy(true);
        // Save to DB and compute a short shareable link
        try {
          const { slug } = await saveStrategyDoc({ data: { doc: result } });
          const url = `${window.location.origin}/s/${slug}`;
          setStrategyLink(url);
        } catch {
          /* link generation failed, skip auto-attach */
        }
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

  const lookupProjectMutation = useMutation({
    mutationFn: () => lookupFreelancerProject({ data: { projectUrl: freelancerUrl } }),
    onSuccess: (project) => {
      if (project) {
        setFreelancerProject(project);
        // Pre-fill job text from project description
        if (project.description && !jobText) setJobText(project.description);
        if (project.budget?.minimum) setBidAmount(String(project.budget.minimum));
        toast.success(`Found: ${project.title}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitBidMutation = useMutation({
    mutationFn: () => {
      if (!freelancerProject || !content) throw new Error("Generate a proposal first");
      return submitFreelancerBid({
        data: {
          projectId: freelancerProject.id,
          proposalText: content,
          bidAmount: parseFloat(bidAmount) || 100,
          deliveryDays: parseInt(deliveryDays) || 7,
        },
      });
    },
    onSuccess: () => toast.success("🎉 Bid submitted to Freelancer.com!"),
    onError: (e: Error) => toast.error(e.message),
  });

  const canAnalyze = effectiveJob.length >= 20;
  const canGenerate = effectiveJob.length >= 10;

  // Auto-append the strategy link to the proposal once both are ready.
  // Use a ref flag so it fires exactly once per generation session.
  useEffect(() => {
    if (!strategyLink || !content || strategyLinkApplied.current) return;
    if (content.includes("/strategy?")) return; // already has a link
    setContent((prev) => prev + `\n\nI've prepared a full project strategy document for this — timeline, phases, risk factors, and success metrics. You can review it here: ${strategyLink}`);
    strategyLinkApplied.current = true;
  }, [strategyLink, content]);

  function reset() {
    setAnalysis(null);
    setContent("");
    setExplanation(null);
    setMilestones([]);
    setChosenProfile(null);
    setStrategyDoc(null);
    setShowStrategy(false);
    setStrategyLink(null);
    strategyLinkApplied.current = false;
    setProposalLanguage("english");
    setAiHookStrategy(null);
    setToneAssertiveness(3);
    setToneFormalness(3);
    setHookStrength(null);
    setShowHookAnalysis(false);
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

      {researchHookSuggestion && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-teal/40 bg-teal/8 px-4 py-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-teal mb-1">Research Agent hook suggestion</p>
            <p className="text-sm text-white leading-relaxed">"{researchHookSuggestion}"</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-teal hover:bg-teal/10"
              onClick={() => { copyText(researchHookSuggestion).then(() => toast.success("Copied")); }}>
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-white"
              onClick={() => setResearchHookSuggestion(null)}>
              ✕
            </Button>
          </div>
        </div>
      )}

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

          {/* Freelancer.com integration panel */}
          <CropCard className="p-4 border-teal/20 bg-teal/5">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="h-4 w-4 text-teal" />
              <span className="text-sm font-semibold text-teal">Freelancer.com</span>
              <span className="text-[10px] text-muted-foreground">— paste project URL to auto-fill and submit bid</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={freelancerUrl}
                onChange={(e) => setFreelancerUrl(e.target.value)}
                placeholder="https://www.freelancer.com/projects/..."
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="border-teal/40 text-teal hover:bg-teal/10 shrink-0"
                disabled={lookupProjectMutation.isPending || !freelancerUrl.includes("freelancer.com")}
                onClick={() => lookupProjectMutation.mutate()}
              >
                {lookupProjectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Project"}
              </Button>
            </div>

            {freelancerProject && (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-background/40 border border-line/40 px-3 py-2">
                  <p className="text-xs font-medium text-white truncate">{freelancerProject.title}</p>
                  {(freelancerProject.budget.minimum || freelancerProject.budget.maximum) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Budget: {freelancerProject.currency} {freelancerProject.budget.minimum}–{freelancerProject.budget.maximum}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Bid amount ({freelancerProject.currency})</Label>
                    <Input
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      type="number"
                      min="1"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Days</Label>
                    <Input
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(e.target.value)}
                      type="number"
                      min="1"
                      max="365"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-teal text-primary-foreground hover:bg-teal/80"
                  disabled={submitBidMutation.isPending || !content}
                  onClick={() => submitBidMutation.mutate()}
                >
                  {submitBidMutation.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Submitting bid…</>
                  ) : (
                    <><Send className="mr-1.5 h-4 w-4" /> Submit bid to Freelancer.com</>
                  )}
                </Button>
                {!content && (
                  <p className="text-[11px] text-muted-foreground text-center">Generate a proposal first, then submit</p>
                )}
              </div>
            )}
          </CropCard>

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
                  <div className="flex items-center gap-2">
                    <Label className="annotation !text-muted-foreground">Job post</Label>
                    <MicButton onTranscript={(t) => setJobText((prev) => prev ? prev + " " + t : t)} />
                  </div>
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

          {analysis && <AnalysisPanel analysis={analysis} onUseHook={(hookId, line) => { setHookId(hookId); setAiHookStrategy(null); toast.success("Hook applied — regenerate proposal to use it"); }} />}

          {/* Niche-matched portfolio banner */}
          {analysis && matchedPortfolio && (
            <div className="rounded-lg border border-gold/25 bg-gold/[0.06] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gold mb-1">
                    Portfolio match found — {matchedPortfolio.niche ?? analysis.detectedNiche}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {matchedPortfolio.title} — tailored for this niche. Use it in your proposal to show the client relevant work.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-gold/30 text-gold hover:bg-gold/10 text-xs h-7"
                  onClick={() => {
                    const url = `/p/${matchedPortfolio.slug}`;
                    setPortfolioLink(url);
                    toast.success("Portfolio linked to this proposal");
                  }}
                >
                  Use this portfolio
                </Button>
              </div>
              {matchedPortfolio.niche && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold/60" />
                  <span className="text-[10px] text-muted-foreground">Niche: {matchedPortfolio.niche} · Detected: {analysis.detectedNiche}</span>
                </div>
              )}
            </div>
          )}
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
                {analysis && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-3 w-3 text-teal" />
                    <span className="text-[11px] text-teal">AI auto-selected hook &amp; strategy from analysis · change below if needed</span>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={
                    <span className="flex items-center gap-1.5">
                      Hook
                      {analysis && hookId === analysis.suggestedHookId && hookId !== AI_HOOK_ID && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-teal/15 border border-teal/30 px-1.5 py-0.5 text-[9px] font-semibold text-teal">
                          <Sparkles className="h-2 w-2" /> matched
                        </span>
                      )}
                    </span>
                  }>
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
                  <Field label={
                    <span className="flex items-center gap-1.5">
                      Strategy
                      {analysis && strategyId === analysis.suggestedStrategyId && strategyId !== AI_STRATEGY_ID && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-teal/15 border border-teal/30 px-1.5 py-0.5 text-[9px] font-semibold text-teal">
                          <Sparkles className="h-2 w-2" /> matched
                        </span>
                      )}
                    </span>
                  }>
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

              {/* Tone calibrator */}
              <div className="space-y-3">
                <Label className="annotation mb-0 block !text-muted-foreground">Tone</Label>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Consultative</span>
                    <span className="text-white font-medium">{["", "Very Consultative", "Consultative", "Balanced", "Assertive", "Very Assertive"][toneAssertiveness]}</span>
                    <span>Assertive</span>
                  </div>
                  <Slider
                    min={1} max={5} step={1}
                    value={[toneAssertiveness]}
                    onValueChange={([v]) => setToneAssertiveness(v)}
                    className="w-full"
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Casual</span>
                    <span className="text-white font-medium">{["", "Very Casual", "Casual", "Semi-formal", "Professional", "Very Formal"][toneFormalness]}</span>
                    <span>Formal</span>
                  </div>
                  <Slider
                    min={1} max={5} step={1}
                    value={[toneFormalness]}
                    onValueChange={([v]) => setToneFormalness(v)}
                    className="w-full"
                  />
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
                subProfileId={selectedSubId}
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
                    {analysis?.detectedNiche && (
                      <p className="mb-1 text-[10px] text-muted-foreground">Sorted by niche match · {analysis.detectedNiche}</p>
                    )}
                    <div className="space-y-2">
                      {[...portfolio]
                        .sort((a, b) => {
                          const niche = analysis?.detectedNiche ?? "";
                          const scoreB = nichematch(b, niche) + (b.is_primary ? 0.3 : 0);
                          const scoreA = nichematch(a, niche) + (a.is_primary ? 0.3 : 0);
                          return scoreB - scoreA;
                        })
                        .map((p) => {
                          const checked = selectedPortfolio.includes(p.id);
                          const matchScore = nichematch(p, analysis?.detectedNiche ?? "");
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
                                <span className="flex items-center gap-2 text-sm font-medium text-white flex-wrap">
                                  {p.title}
                                  {p.is_primary && <span className="annotation !text-gold">Primary</span>}
                                  {matchScore > 0 && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-gold/15 border border-gold/30 px-1.5 py-0.5 text-[9px] font-semibold text-gold">
                                      <Sparkles className="h-2 w-2" /> niche match
                                    </span>
                                  )}
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
                variant="outline"
                disabled={!canGenerate || strategyMutation.isPending}
                onClick={() => strategyMutation.mutate(undefined)}
                className="w-full border-teal/40 text-teal hover:bg-teal/10"
              >
                {strategyMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Map className="mr-1.5 h-4 w-4" />
                )}
                Generate strategy doc
              </Button>

              {strategyDoc && (
                <div className="rounded-md border border-teal/20 bg-teal/[0.04] px-3 py-2">
                  <p className="text-xs text-teal">
                    ✓ Strategy document ready — the proposal will reference it to show the client your preparation.
                  </p>
                </div>
              )}

              <Button
                onClick={() => generateMutation.mutate(undefined)}
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
              hookStrengthMutation={hookStrengthMutation}
              hookStrength={hookStrength}
              showHookAnalysis={showHookAnalysis}
              setShowHookAnalysis={setShowHookAnalysis}
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
                    onClick={() => {
                      if (!strategyRef.current) { toast.error("Strategy not rendered yet"); return; }
                      toast.loading("Capturing diagrams…", { id: "strat-pdf" });
                      downloadElementAsPdf(strategyRef.current, `Strategy-${strategyDoc.projectTitle}`)
                        .then(() => toast.success("Strategy PDF downloaded", { id: "strat-pdf" }))
                        .catch(() => toast.error("PDF failed — try again", { id: "strat-pdf" }));
                    }}
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const url = strategyLink ?? await (async () => {
                          const { slug } = await saveStrategyDoc({ data: { doc: strategyDoc } });
                          const u = `${window.location.origin}/s/${slug}`;
                          setStrategyLink(u);
                          return u;
                        })();
                        navigator.clipboard.writeText(url)
                          .then(() => toast.success("Short link copied — share with your client"))
                          .catch(() => { toast.success("Link: " + url); });
                      } catch {
                        toast.error("Could not generate link");
                      }
                    }}
                  >
                    <Link2 className="mr-1.5 h-3.5 w-3.5" /> Share Link
                  </Button>
                </div>
              </div>
              <div ref={strategyRef}>
                <StrategyDocumentView doc={strategyDoc} />
              </div>
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
function AnalysisPanel({ analysis, onUseHook }: { analysis: JobAnalysis; onUseHook: (hookId: string, line: string) => void }) {
  const strat = STRATEGIES.find((s) => s.id === analysis.suggestedStrategyId);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function scoreColor(score: number) {
    if (score >= 85) return "text-teal";
    if (score >= 70) return "text-gold";
    return "text-muted-foreground";
  }
  function scoreBg(score: number) {
    if (score >= 85) return "border-teal/30 bg-teal/8";
    if (score >= 70) return "border-gold/30 bg-gold/8";
    return "border-line/40 bg-background/40";
  }

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

        {/* Hook suggestions */}
        {analysis.hookSuggestions && analysis.hookSuggestions.length > 0 ? (
          <div>
            <p className="annotation mb-3 !text-gold flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Hook suggestions — rated for this job
            </p>
            <div className="space-y-3">
              {analysis.hookSuggestions.map((h, i) => (
                <div key={i} className={cn("rounded-xl border p-4", scoreBg(h.score))}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                      <span className="text-xs font-semibold text-white">{h.hookName}</span>
                      {i === 0 && (
                        <span className="rounded-full bg-gold/20 border border-gold/30 px-2 py-0.5 text-[9px] font-bold text-gold">
                          TOP PICK
                        </span>
                      )}
                    </div>
                    {/* Score ring */}
                    <div className={cn("shrink-0 flex flex-col items-center", scoreColor(h.score))}>
                      <span className="text-lg font-black leading-none">{h.score}</span>
                      <span className="text-[9px] font-mono opacity-70">/ 100</span>
                    </div>
                  </div>
                  <p className="text-sm text-white leading-relaxed italic mb-2">
                    "{h.openingLine}"
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">{h.scoreReason}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-[11px] bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30"
                      onClick={() => onUseHook(h.hookId, h.openingLine)}
                    >
                      <Zap className="h-3 w-3 mr-1" /> Use this hook
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-3 text-[11px] text-muted-foreground hover:text-white"
                      onClick={() => {
                        copyText(h.openingLine).then(() => {
                          setCopiedIdx(i);
                          setTimeout(() => setCopiedIdx(null), 2000);
                        });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {copiedIdx === i ? "Copied!" : "Copy line"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SuggestionCard
            label="Suggested hook"
            name={HOOKS.find((h) => h.id === analysis.suggestedHookId)?.name ?? analysis.suggestedHookId}
            reason={analysis.hookReason}
          />
        )}

        <SuggestionCard label="Suggested strategy" name={strat?.name ?? analysis.suggestedStrategyId} reason={analysis.strategyReason} />

        <p className="annotation !text-muted-foreground">
          Click "Use this hook" to apply it, then regenerate the proposal.
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
  hookStrengthMutation,
  hookStrength,
  showHookAnalysis,
  setShowHookAnalysis,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hookStrengthMutation: any;
  hookStrength: HookStrength | null;
  showHookAnalysis: boolean;
  setShowHookAnalysis: (v: boolean) => void;
}) {
  const [aiInstruction, setAiInstruction] = useState("");
  const [prevContent, setPrevContent] = useState<string | null>(null);

  const applyEditMutation = useMutation({
    mutationFn: () => applyProposalEdit({
      data: { proposalText: content, instruction: aiInstruction },
    }),
    onSuccess: (result) => {
      if (result?.text) {
        setPrevContent(content);
        setContent(result.text);
        setAiInstruction("");
        toast.success("AI edit applied — review and save");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Edit failed"),
  });

  return (
    <>
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

      {/* Toggle: Preview / Edit */}
      {(() => {
        const [preview, setPreview] = (useState as <T>(v: T) => [T, (v: T) => void])(true);
        return (
          <>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex rounded-lg border border-line/60 overflow-hidden text-xs">
                <button
                  onClick={() => setPreview(true)}
                  className={cn("px-3 py-1.5 transition-colors", preview ? "bg-gold/20 text-gold font-medium" : "text-muted-foreground hover:text-white")}
                >
                  Preview
                </button>
                <button
                  onClick={() => setPreview(false)}
                  className={cn("px-3 py-1.5 transition-colors border-l border-line/60", !preview ? "bg-sidebar text-white font-medium" : "text-muted-foreground hover:text-white")}
                >
                  Edit
                </button>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{content.length} chars</span>
            </div>

            {preview ? (
              <div className="mt-3 rounded-lg border border-line/40 bg-background/40 p-5 min-h-[14rem] max-h-[36rem] overflow-y-auto">
                <ProposalPreview content={content} />
              </div>
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="mt-3 resize-y bg-background/60 text-sm leading-relaxed"
              />
            )}
          </>
        );
      })()}

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
        <ProposalImageGenerator />
        <Button
          size="sm"
          variant="outline"
          className="border-teal/30 text-teal hover:bg-teal/10"
          onClick={() => hookStrengthMutation.mutate(undefined)}
          disabled={hookStrengthMutation.isPending}
        >
          {hookStrengthMutation.isPending ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scoring hook…</>
          ) : (
            <><Zap className="mr-1.5 h-3.5 w-3.5" /> Score my hook</>
          )}
        </Button>
      </div>

      {content && (
        <div className="mt-4 rounded-xl border border-teal/30 bg-teal/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquarePlus className="h-4 w-4 text-teal" />
            <span className="text-sm font-semibold text-teal">AI Editor</span>
            <span className="text-xs text-muted-foreground ml-1">— tell the AI what to change</span>
          </div>
          <div className="flex gap-2">
            <MicButton onTranscript={(t) => setAiInstruction((prev) => prev ? prev + " " + t : t)} className="shrink-0" />
            <input
              className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/40"
              placeholder='e.g. "make the hook more confident", "shorten by 40%", "add urgency to the CTA"…'
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && aiInstruction.trim().length >= 3) {
                  e.preventDefault();
                  applyEditMutation.mutate();
                }
              }}
              disabled={applyEditMutation.isPending}
            />
            <Button
              size="sm"
              className="bg-teal text-primary-foreground hover:bg-teal/80 shrink-0"
              disabled={applyEditMutation.isPending || aiInstruction.trim().length < 3}
              onClick={() => applyEditMutation.mutate()}
            >
              {applyEditMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          {prevContent && (
            <button
              className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline hover:text-white transition-colors"
              onClick={() => { setContent(prevContent); setPrevContent(null); toast.info("Reverted to previous version"); }}
            >
              ↩ Undo last edit
            </button>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Try: "make it more assertive" · "shorten by 30%" · "translate to French" · "add a stronger CTA" · "remove portfolio section"
          </p>
        </div>
      )}

      {hookStrength && showHookAnalysis && (
        <div className="mt-3 rounded-lg border border-border bg-background/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                hookStrength.score >= 8 ? "bg-teal/20 text-teal" :
                hookStrength.score >= 5 ? "bg-gold/20 text-gold" :
                "bg-red-500/20 text-red-400"
              )}>
                {hookStrength.score}
              </div>
              <span className="text-xs text-white font-medium">{hookStrength.verdict}</span>
            </div>
            <button
              className="text-[10px] text-muted-foreground hover:text-white"
              onClick={() => setShowHookAnalysis(false)}
            >
              ✕
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {hookStrength.strengths.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal">What works</p>
                <ul className="space-y-1">
                  {hookStrength.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-white/80">✓ {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {hookStrength.weaknesses.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-400">What kills it</p>
                <ul className="space-y-1">
                  {hookStrength.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-white/80">✗ {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {hookStrength.score < 9 && (
            <div className="rounded-md border border-gold/20 bg-gold/[0.04] p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gold">Stronger opening ↓</p>
              <p className="text-xs text-white/90 leading-relaxed italic">"{hookStrength.rewrite}"</p>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{hookStrength.rewriteRationale}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-6 px-2 text-[10px] text-gold hover:bg-gold/10"
                onClick={() => {
                  const parts = content.split("\n\n");
                  parts[0] = hookStrength.rewrite;
                  setContent(parts.join("\n\n"));
                  setShowHookAnalysis(false);
                  toast.success("Hook replaced — review the full proposal");
                }}
              >
                ↑ Replace my hook with this
              </Button>
            </div>
          )}
        </div>
      )}

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

    {/* Floating voice edit orb */}
    <VoiceEditPrompt
      isPending={applyEditMutation.isPending}
      onApply={(instruction) => {
        setAiInstruction(instruction);
        applyEditMutation.mutate();
      }}
    />
    </>
  );
}

function ProposalImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const genMutation = useMutation({
    mutationFn: () => generateProposalImage({ data: { prompt } }),
    onSuccess: (res) => { if (res?.dataUrl) setImageUrl(res.dataUrl); },
    onError: (e: Error) => toast.error(e.message || "Image generation failed"),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="border-gold/30 text-gold hover:bg-gold/10 mt-2"
        onClick={() => setOpen(true)}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate an image for this proposal
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-gold" />
        <span className="text-sm font-semibold text-gold">Image Generator</span>
        <button className="ml-auto text-muted-foreground hover:text-white text-xs" onClick={() => setOpen(false)}>✕</button>
      </div>
      <input
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/40"
        placeholder='e.g. "modern dashboard UI screenshot, dark theme" or "mobile app design, clean minimal"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim().length >= 3) genMutation.mutate(); }}
        disabled={genMutation.isPending}
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="bg-gold text-primary-foreground hover:bg-gold-bright"
          disabled={genMutation.isPending || prompt.trim().length < 3}
          onClick={() => genMutation.mutate()}>
          {genMutation.isPending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…</>
            : <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate</>}
        </Button>
        {imageUrl && (
          <Button size="sm" variant="outline" className="border-line/40"
            onClick={() => { const a = document.createElement("a"); a.href = imageUrl; a.download = "proposal-image.png"; a.click(); }}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download
          </Button>
        )}
      </div>
      {imageUrl && (
        <div className="mt-3">
          <img src={imageUrl} alt="Generated" className="rounded-lg border border-line/40 w-full object-cover max-h-64" />
          <p className="mt-1.5 text-[10px] text-muted-foreground">Right-click or download to save. Use in your portfolio or attach to your proposal.</p>
        </div>
      )}
    </div>
  );
}

// ─── Proposal preview renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} className="font-semibold text-white">{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={m.index} className="italic text-foreground/80">{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function ProposalPreview({ content }: { content: string }) {
  const lines = content.split(/\n/);
  const nodes: React.ReactNode[] = [];
  let key = 0;
  let inParagraph = false;
  let paraLines: string[] = [];

  function flushParagraph() {
    if (!paraLines.length) return;
    const text = paraLines.join(" ").trim();
    if (text) {
      nodes.push(
        <p key={key++} className="text-sm leading-[1.8] text-foreground/90 indent-4">
          {renderInline(text)}
        </p>,
      );
    }
    paraLines = [];
    inParagraph = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip horizontal rules entirely
    if (/^([_\-*]){3,}$/.test(trimmed)) continue;

    if (!trimmed) {
      flushParagraph();
      nodes.push(<div key={key++} className="h-2" />);
    } else if (/^##\s+/.test(line)) {
      flushParagraph();
      nodes.push(
        <div key={key++} className="mt-6 mb-2 first:mt-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gold/80">{line.replace(/^##\s+/, "")}</p>
          <div className="mt-1 h-px bg-gold/20" />
        </div>,
      );
    } else if (/^#\s+/.test(line)) {
      flushParagraph();
      nodes.push(
        <p key={key++} className="mt-6 mb-1 text-base font-bold text-white first:mt-0">{line.replace(/^#\s+/, "")}</p>,
      );
    } else if (/^[-•*]\s+/.test(line)) {
      flushParagraph();
      nodes.push(
        <div key={key++} className="flex gap-2 pl-2 my-1">
          <span className="mt-[3px] shrink-0 text-teal/70 text-sm">·</span>
          <span className="text-sm leading-relaxed text-foreground/90">{renderInline(trimmed.replace(/^[-•*]\s+/, ""))}</span>
        </div>,
      );
    } else if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const num = line.match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={key++} className="flex gap-2 pl-2 my-1">
          <span className="mt-[3px] shrink-0 font-mono text-[11px] text-gold/70 w-4 text-right">{num}.</span>
          <span className="text-sm leading-relaxed text-foreground/90">{renderInline(trimmed.replace(/^\d+\.\s+/, ""))}</span>
        </div>,
      );
    } else {
      // Regular prose — accumulate into paragraph
      paraLines.push(trimmed);
      inParagraph = true;
    }
  }
  flushParagraph();

  return <div className="space-y-1.5 text-[15px]">{nodes}</div>;
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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
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
