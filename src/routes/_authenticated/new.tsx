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
  X,
  Languages,
  Key,
  Wand2,
  Plus,
  Trash2,
  RotateCcw,
  User,
  ClipboardCopy,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { HOOKS, STRATEGIES, CTAS, LENGTHS, type LengthId } from "@/lib/proposal-constants";
import { goldenKeyById } from "@/lib/prompts/shared/golden-keys";
import { listCustomHooks, listCustomStrategies } from "@/lib/profile.functions";
import { listSubProfiles } from "@/lib/sub-profile.functions";
import { analyzeJob, generateProposal, generateMilestones, generateStrategyDocument, applyProposalEdit, polishProposal, injectPortfolioLinks, craftHookLine, craftCtaLine, translateToEnglish, type JobAnalysis, type StrategyDocument } from "@/lib/ai.functions";
import { VoiceEditPrompt } from "@/components/VoiceEditPrompt";
import { StrategyDocumentView } from "@/components/StrategyDocument";
import { saveProposal, getProposalAnalytics } from "@/lib/proposals.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import { PortfolioPicker } from "@/components/PortfolioPicker";
import { ProfileImageGallery } from "@/components/ProfileImageGallery";
import { SnippetsPanel } from "@/components/SnippetsPanel";
import { ProposalTemplatePicker } from "@/components/ProposalTemplatePicker";
import { InlineRewriteToolbar } from "@/components/InlineRewriteToolbar";
import { getDraft, saveDraft, clearDraft } from "@/lib/proposal-drafts.functions";
type FreelancerProfile = { id: string; label: string };
import { saveItem } from "@/lib/saved.functions";
import { copyText, downloadTxt, downloadPdf, copyMarkdown } from "@/lib/export";
import { saveStrategyDoc } from "@/lib/strategy.functions";
import { generateAndSavePortfolioSamples, detectDigitalSkillsCategory } from "@/lib/portfolio-samples.functions";

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

// ── Daily proposal counter (localStorage) ───────────────────────────────────
type DayStats = { date: string; generated: number; submitted: number };
function todayKey() { return new Date().toISOString().slice(0, 10); }
function readDayStats(): DayStats {
  try {
    const raw = localStorage.getItem("pp_day_stats");
    const parsed: DayStats = raw ? JSON.parse(raw) : { date: "", generated: 0, submitted: 0 };
    if (parsed.date !== todayKey()) return { date: todayKey(), generated: 0, submitted: 0 };
    return parsed;
  } catch { return { date: todayKey(), generated: 0, submitted: 0 }; }
}
function writeDayStats(stats: DayStats) {
  try { localStorage.setItem("pp_day_stats", JSON.stringify(stats)); } catch {}
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

  const [dayStats, setDayStats] = useState<DayStats>(() =>
    typeof window !== "undefined" ? readDayStats() : { date: todayKey(), generated: 0, submitted: 0 }
  );
  const [proposalSubmitted, setProposalSubmitted] = useState(false);

  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [hookId, setHookId] = useState<string>(HOOKS[0].id);
  const [strategyId, setStrategyId] = useState<string>(STRATEGIES[0].id);
  const [ctaId, setCtaId] = useState<string>(CTAS[0].id);
  const [length, setLength] = useState<LengthId>("robust");
  const [includePlan, setIncludePlan] = useState(true);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string[]>([]);
  const [portfolioLink, setPortfolioLink] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [useMilestones, setUseMilestones] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  // Tone controls (1-5)
  const [toneAssertiveness, setToneAssertiveness] = useState(3);
  const [toneFormalness, setToneFormalness] = useState(3);

  // Selected profile image (separate from sub-profile picker)
  const [avatar, setAvatar] = useState<{ path: string; url: string } | null>(null);

  const [content, setContent] = useState("");
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");
  const [explanation, setExplanation] = useState<{
    hook: string;
    strategy: string;
    question: string;
  } | null>(null);
  const [showExplain, setShowExplain] = useState(true);
  const [factCheck, setFactCheck] = useState<{ flagged: Array<{ claim: string; reason: string }>; allTraceable: boolean; remediated: boolean } | null>(null);
  const [factCheckAck, setFactCheckAck] = useState(false);
  // Fix 9 — record why portfolios were auto-matched so the UI can show it.
  const [autoMatchInfo, setAutoMatchInfo] = useState<{ titles: string[]; skills: string[] } | null>(null);

  const [strategyDoc, setStrategyDoc] = useState<StrategyDocument | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [strategySlug, setStrategySlug] = useState<string | null>(null);
  const [strategyLinkSaving, setStrategyLinkSaving] = useState(false);
  const [samplesSlug, setSamplesSlug] = useState<string | null>(null);
  const [samplesGenerating, setSamplesGenerating] = useState(false);

  const [chosenProfile, setChosenProfile] = useState<FreelancerProfile | null>(null);

  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const portfolio = portfolioQuery.data ?? [];
  const analyticsQuery = useQuery({ queryKey: ["proposal-analytics"], queryFn: () => getProposalAnalytics() });
  const analytics = analyticsQuery.data;
  const subProfilesQuery = useQuery({ queryKey: ["sub-profiles"], queryFn: () => listSubProfiles() });
  const subProfiles = subProfilesQuery.data ?? [];

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

  // Fix 8 — abort in-flight analysis. The controller is stored so a Cancel button can
  // abort it; a run token lets us ignore a stale response that resolves after cancel.
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const analyzeRunRef = useRef(0);

  const analyzeMutation = useMutation({
    mutationFn: () => {
      analyzeAbortRef.current?.abort();
      const controller = new AbortController();
      analyzeAbortRef.current = controller;
      const runId = ++analyzeRunRef.current;
      return analyzeJob({ data: { jobDescription: effectiveJob }, signal: controller.signal })
        .then((result) => {
          if (runId !== analyzeRunRef.current) throw new Error("__cancelled__");
          return result;
        });
    },
    onSuccess: (result) => {
      setAnalysis({ ...result, hookSuggestions: result.hookSuggestions ?? [], detectedNiche: result.detectedNiche ?? "", suggestedLength: result.suggestedLength ?? "robust" } as JobAnalysis);
      const h = HOOKS.find((x) => x.id === result.suggestedHookId);
      const s = STRATEGIES.find((x) => x.id === result.suggestedStrategyId);
      const c = CTAS.find((x) => x.id === (result as any).suggestedCtaId);
      if (h) setHookId(h.id);
      if (s) setStrategyId(s.id);
      if (c) setCtaId(c.id);
      // Fix 9 — tag-driven auto-match. Build a set of detected skill terms from the
      // detected niche + extracted entities + job text, then score each portfolio by
      // how many of its niche_tags appear in that term blob. Records the matched skills
      // so the UI can show "Auto-matched X, based on detected skills: ...".
      const norm = (s: string) => s.toLowerCase().replace(/[-_/]+/g, " ").trim();
      const detectedBlob = norm(
        (result.detectedNiche ?? "") + " " + ((result as any).extractedEntities ?? []).join(" ") + " " + effectiveJob,
      );
      if (selectedPortfolio.length === 0) {
        const matchedSkills = new Set<string>();
        const scored = portfolio
          .map((p: any) => {
            const tags: string[] = [...((p as any).niche_tags ?? []), (p as any).niche].filter(Boolean);
            const hits = tags.filter((t: string) => t && detectedBlob.includes(norm(t)));
            hits.forEach((h: string) => matchedSkills.add(h));
            return { id: p.id, title: p.title, score: hits.length };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (scored.length > 0) {
          setSelectedPortfolio(scored.map((s) => s.id));
          setAutoMatchInfo({ titles: scored.map((s) => s.title), skills: [...matchedSkills] });
          toast.success(`Auto-matched ${scored.length} portfolio${scored.length > 1 ? "s" : ""} for this job`);
        } else {
          setAutoMatchInfo(null);
          const primaries = portfolio.filter((p) => p.is_primary).slice(0, 3).map((p) => p.id);
          if (primaries.length) setSelectedPortfolio(primaries);
        }
      }
      if ((result as any).usedFallbackEngine) {
        toast.warning("Using simplified analysis — full intelligence engine unavailable. Hook/strategy quality may differ and the Golden Key won't appear.", { duration: 7000 });
      } else {
        toast.success("Job analyzed");
      }
      // Auto-start strategy generation only if job is worth it
      if (!strategyDoc && !strategyMutation.isPending && result.strategyWorthy !== false) {
        setTimeout(() => strategyMutation.mutate(), 500);
      } else if (result.strategyWorthy === false) {
        toast.info(`Strategy doc skipped — ${result.strategyWorthyReason || "simple job, not needed"}`);
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      if (msg === "__cancelled__" || msg.toLowerCase().includes("abort")) return; // user-cancelled
      toast.error(msg);
    },
  });

  // Fix 8 — abort the in-flight analysis and fully reset analysis state so a new job
  // post can be pasted and analyzed immediately without a broken half-loaded UI.
  function cancelAnalysis() {
    analyzeRunRef.current++; // invalidate any in-flight response
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    analyzeMutation.reset();
    setAnalysis(null);
    setExplanation(null);
    setFactCheck(null);
    setAutoMatchInfo(null);
    toast.info("Analysis cancelled");
  }

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
      const isStrategyWorthy = (analysis as any)?.strategyWorthy !== false;

      // Run hook crafting, CTA crafting, and strategy generation in parallel
      const [hookResult, ctaResult, strategyData] = await Promise.all([
        // Claude crafts the opening hook paragraph
        craftHookLine({ data: { jobDescription: effectiveJob, analysis, hookId } }).catch(() => null),
        // Mistral crafts the closing CTA line
        craftCtaLine({ data: { jobDescription: effectiveJob, analysis, ctaId } }).catch(() => null),
        // Strategy: reuse existing or generate new (only if job is strategy-worthy)
        (async () => {
          if (!isStrategyWorthy) return { strategyResult: null as StrategyDocument | null, slug: null as string | null };
          if (strategyDoc && strategySlug) return { strategyResult: strategyDoc, slug: strategySlug };
          const freshStrategy = await generateStrategyDocument({
            data: { jobDescription: effectiveJob, analysis, budget: budget || undefined },
          });
          const saved = await saveStrategyDoc({ data: { doc: freshStrategy! } });
          return { strategyResult: freshStrategy ?? null, slug: saved.slug };
        })(),
      ]);

      const { strategyResult, slug } = strategyData;
      const strategyLink = slug
        ? `I've already mapped out a full project strategy — phases, risk factors, and success metrics — you can review it here: ${window.location.origin}/strategy/${slug}`
        : undefined;

      // Step 2: Generate proposal with strategy link
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
      const proposalResult = await generateProposal({
        data: {
          jobDescription: effectiveJob,
          analysis,
          hookId,
          strategyId,
          ctaId,
          length,
          includePlan,
          portfolioItems: items,
          milestones: useMilestones ? milestones : undefined,
          budget: budget || undefined,
          toneAssertiveness,
          toneFormalness,
          strategyDocument: strategyLink,
          extractedEntities: (analysis as any)?.extractedEntities ?? [],
          craftedHookParagraph: hookResult?.hookParagraph ?? undefined,
          craftedCtaLine: ctaResult?.ctaLine ?? undefined,
        },
      });
      return { proposalResult, strategyResult, slug };
    },
    onSuccess: ({ proposalResult, strategyResult, slug }) => {
      setContent(proposalResult!.content);
      setAiGeneratedContent(proposalResult!.content);
      setExplanation(proposalResult!.explanation);
      setFactCheck((proposalResult as any)?.factCheck ?? null);
      setFactCheckAck(false);
      setShowExplain(true);
      setProposalSubmitted(false);
      // Set strategy state from the data returned
      if (strategyResult) {
        setStrategyDoc(strategyResult);
        setShowStrategy(true);
      }
      if (slug) setStrategySlug(slug);
      // Increment daily generated counter
      const fresh = readDayStats();
      const updated = { ...fresh, generated: fresh.generated + 1 };
      writeDayStats(updated);
      setDayStats(updated);
      toast.success("Proposal generated");
      // auto-polish with fresh content passed directly (avoid stale closure)
      setTimeout(() => polishMutation.mutate(proposalResult!.content), 150);
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
    onSuccess: async (result) => {
      if (!result) return;
      setStrategyDoc(result);
      setShowStrategy(true);

      // Auto-save strategy and generate shareable link
      setStrategyLinkSaving(true);
      try {
        const { slug } = await saveStrategyDoc({ data: { doc: result } });
        setStrategySlug(slug);
        toast.success("Strategy ready — shareable link generated");
      } catch {
        toast.error("Strategy generated but link could not be saved — try downloading as PDF");
      } finally {
        setStrategyLinkSaving(false);
      }

      // Auto-generate digital skills portfolio samples if job matches
      const category = detectDigitalSkillsCategory(effectiveJob);
      if (category && !samplesSlug) {
        setSamplesGenerating(true);
        try {
          const { slug } = await generateAndSavePortfolioSamples({
            data: {
              jobDescription: effectiveJob,
              category,
              profileImageUrl: avatar?.url ?? undefined,
            },
          });
          setSamplesSlug(slug);
          toast.success(`${category} portfolio samples generated`);
        } catch {
          // Non-fatal — samples are a bonus
        } finally {
          setSamplesGenerating(false);
        }
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
      applyProposalEdit({
        data: {
          proposalText: content,
          instruction,
          // Fix 4 — give the editor the structural blueprint so it can locate and
          // correctly re-style specific paragraphs (hook/CTA). Undefined on fallback runs.
          blueprint: (analysis as any)?.intelligence?.proposalBlueprint,
          registerId: (analysis as any)?.intelligence?.clientIntelligence?.recommendedRegisterId,
        },
      }),
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
          cta: ctaId,
          length,
          include_plan: includePlan,
          portfolio_ids: selectedPortfolio,
          submitted: proposalSubmitted,
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
    setAiGeneratedContent("");
    setExplanation(null);
    setMilestones([]);
    setChosenProfile(null);
    setStrategyDoc(null);
    setShowStrategy(false);
    setAvatar(null);
    setToneAssertiveness(3);
    setToneFormalness(3);
    setProposalSubmitted(false);
    clearDraft({}).catch(() => {});
  }

  function markSubmitted() {
    if (proposalSubmitted) return;
    // Fabrication guard (Fix 7): block marking-ready while unverifiable claims are
    // unacknowledged, so a fabricated stat can't slip out unreviewed.
    if (factCheck && factCheck.flagged.length > 0 && !factCheckAck) {
      toast.error("Review the flagged unverifiable claims and check the confirmation box first.");
      return;
    }
    setProposalSubmitted(true);
    const fresh = readDayStats();
    const updated = { ...fresh, submitted: fresh.submitted + 1 };
    writeDayStats(updated);
    setDayStats(updated);
    toast.success("Marked as submitted! 🎯");
  }

  // ── Auto-save draft (debounced) ──────────────────────────────────────
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    getDraft({}).then((d) => {
      draftRestoredRef.current = true;
      if (!d?.payload) return;
      const p = d.payload as Record<string, unknown>;
      if (typeof p.jobText === "string") setJobText(p.jobText);
      if (typeof p.content === "string") setContent(p.content);
      if (typeof p.budget === "string") setBudget(p.budget);
      if (typeof p.toneAssertiveness === "number") setToneAssertiveness(p.toneAssertiveness);
      if (typeof p.toneFormalness === "number") setToneFormalness(p.toneFormalness);
      if (p.avatar && typeof p.avatar === "object") setAvatar(p.avatar as { path: string; url: string });
      if (p.content || p.jobText) toast.info("Draft restored");
    }).catch(() => { draftRestoredRef.current = true; });
  }, []);

  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const hasContent = jobText.length > 20 || content.length > 0;
    if (!hasContent) return;
    const t = setTimeout(() => {
      saveDraft({
        data: { payload: { jobText, content, budget, toneAssertiveness, toneFormalness, avatar } },
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [jobText, content, budget, toneAssertiveness, toneFormalness, avatar]);

  function insertSnippet(text: string) {
    setContent((prev) => prev ? `${prev}\n\n${text}` : text);
  }

  function applyRewrite(selected: string, replacement: string) {
    setContent((prev) => prev.includes(selected) ? prev.replace(selected, replacement) : prev);
  }

  function requestSave() {
    saveMutation.mutate(chosenProfile ?? undefined);
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

      {/* Daily tracker bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          <span className="text-xs font-medium text-white/60">Today</span>
          <span className="font-mono text-sm font-bold text-gold">{dayStats.generated}</span>
          <span className="text-xs text-white/30">generated</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <ClipboardCopy className="h-3.5 w-3.5 text-teal" />
          <span className="text-xs font-medium text-white/60">Submitted</span>
          <span className="font-mono text-sm font-bold text-teal">{dayStats.submitted}</span>
          <span className="text-xs text-white/30">today</span>
        </div>
        {content && (
          <button
            onClick={markSubmitted}
            disabled={proposalSubmitted}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all",
              proposalSubmitted
                ? "border-teal/40 bg-teal/10 text-teal cursor-default"
                : "border-white/20 bg-white/5 text-white/60 hover:border-teal/40 hover:text-teal"
            )}
          >
            {proposalSubmitted ? (
              <><User className="h-3.5 w-3.5" /> Submitted ✓</>
            ) : (
              <><User className="h-3.5 w-3.5" /> Mark as submitted</>
            )}
          </button>
        )}
      </div>

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

            {analyzeMutation.isPending ? (
              <div className="mt-4 flex gap-2">
                <Button disabled className="flex-1 bg-teal/15 text-teal">
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reading the brief…
                </Button>
                <Button
                  onClick={cancelAnalysis}
                  variant="outline"
                  className="border-red-400/40 text-red-300 hover:bg-red-400/10"
                >
                  <X className="mr-1.5 h-4 w-4" /> Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  // Fix 8 — clear the previous result fully before starting a fresh analysis
                  setAnalysis(null);
                  setExplanation(null);
                  setFactCheck(null);
                  setAutoMatchInfo(null);
                  analyzeMutation.mutate();
                }}
                disabled={!canAnalyze}
                className="mt-4 w-full bg-teal/15 text-teal hover:bg-teal/25"
              >
                <ScanLine className="mr-1.5 h-4 w-4" /> Analyze job
              </Button>
            )}
          </CropCard>

          {analysis && <AnalysisPanel analysis={analysis} />}
        </div>

        {/* RIGHT: configure + output */}
        <div className="space-y-6">
          <ProfileImageGallery
            selectedPath={avatar?.path ?? null}
            onSelect={(v) => setAvatar(v)}
          />
          <ProposalTemplatePicker
            onApply={(body) => {
              setContent(body);
              toast.info("Template loaded — replace placeholders, then polish with AI.");
            }}
          />
          <SnippetsPanel onInsert={insertSnippet} />
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
              {/* Tone controls */}
              <div className="rounded-md border border-border/60 bg-background/40 p-3 space-y-3">
                <Label className="annotation !text-muted-foreground">Tone</Label>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Consultative</span><span className="text-white">Assertiveness</span><span>Assertive</span>
                  </div>
                  <Slider value={[toneAssertiveness]} min={1} max={5} step={1} onValueChange={(v) => setToneAssertiveness(v[0])} />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Casual</span><span className="text-white">Formalness</span><span>Formal</span>
                  </div>
                  <Slider value={[toneFormalness]} min={1} max={5} step={1} onValueChange={(v) => setToneFormalness(v[0])} />
                </div>
              </div>

              {/* Profile selector */}
              {subProfiles.length > 0 && (
                <div>
                  <Label className="annotation mb-2 block !text-muted-foreground">Generate as profile</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChosenProfile(null)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        !chosenProfile ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-white"
                      )}
                    >
                      <User className="h-3 w-3" /> Main
                    </button>
                    {subProfiles.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setChosenProfile({ id: sp.id, label: sp.label })}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          chosenProfile?.id === sp.id ? "border-teal/50 bg-teal/10 text-teal" : "border-border text-muted-foreground hover:text-white"
                        )}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Hook selector */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Hook style</Label>
                {/* Top 3 AI-ranked hooks for this specific job — shown after analysis */}
                {analysis?.hookSuggestions && analysis.hookSuggestions.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    <p className="annotation !text-gold mb-1">AI-ranked for this job</p>
                    {analysis.hookSuggestions.slice(0, 3).map((hs) => (
                      <button
                        key={hs.hookId}
                        type="button"
                        onClick={() => setHookId(hs.hookId)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          hookId === hs.hookId ? "border-gold/60 bg-gold/10" : "border-gold/20 bg-gold/[0.03] hover:border-gold/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn("text-[12px] font-semibold", hookId === hs.hookId ? "text-gold" : "text-white")}>{hs.hookName}</span>
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            hs.score >= 85 ? "bg-green-500/20 text-green-400" : hs.score >= 70 ? "bg-teal/20 text-teal" : "bg-muted/40 text-muted-foreground"
                          )}>{hs.score}/100</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{hs.scoreReason}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Select value={hookId} onValueChange={setHookId}>
                  <SelectTrigger className="h-9 bg-background/60 text-sm">
                    <SelectValue placeholder="Select hook style" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allHooks.map((h) => {
                      const stat = analytics?.hookStats?.find((s) => s.id === h.id);
                      const isBest = analytics?.bestHook === h.id;
                      return (
                        <SelectItem key={h.id} value={h.id}>
                          <span className="flex items-center gap-1.5">
                            {h.name}
                            {isBest && <span className="text-[9px] text-gold">★ Best</span>}
                            {stat ? <span className="text-[9px] text-teal">{stat.responseRate}%</span> : null}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {(() => {
                  const selected = allHooks.find((h) => h.id === hookId);
                  return selected ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{selected.description}</p>
                  ) : null;
                })()}
              </div>

              {/* Strategy selector */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Strategy</Label>
                <Select value={strategyId} onValueChange={setStrategyId}>
                  <SelectTrigger className="h-9 bg-background/60 text-sm">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allStrategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const selected = allStrategies.find((s) => s.id === strategyId);
                  return selected ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{selected.description}</p>
                  ) : null;
                })()}
              </div>

              {/* CTA selector */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">
                  Call to Action
                  {analysis && (analysis as any).ctaSuggestions?.length > 0 && (
                    <span className="ml-1.5 text-[10px] text-gold">· AI ranked</span>
                  )}
                </Label>
                {/* AI-ranked CTA suggestions */}
                {analysis && (analysis as any).ctaSuggestions?.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {(analysis as any).ctaSuggestions.slice(0, 2).map((cs: { ctaId: string; ctaName: string; closingLine: string; score: number; scoreReason: string }) => (
                      <button
                        key={cs.ctaId}
                        type="button"
                        onClick={() => setCtaId(cs.ctaId)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          ctaId === cs.ctaId ? "border-purple-400/60 bg-purple-400/10" : "border-purple-400/20 bg-purple-400/[0.03] hover:border-purple-400/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn("text-[12px] font-semibold", ctaId === cs.ctaId ? "text-purple-300" : "text-white")}>{cs.ctaName}</span>
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            cs.score >= 85 ? "bg-green-500/20 text-green-400" : cs.score >= 70 ? "bg-teal/20 text-teal" : "bg-muted/40 text-muted-foreground"
                          )}>{cs.score}/100</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{cs.scoreReason}</p>
                      </button>
                    ))}
                  </div>
                )}
                <Select value={ctaId} onValueChange={setCtaId}>
                  <SelectTrigger className="h-9 bg-background/60 text-sm">
                    <SelectValue placeholder="Select CTA style" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CTAS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const selected = CTAS.find((c) => c.id === ctaId);
                  return selected ? (
                    <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{selected.description}</p>
                  ) : null;
                })()}
              </div>

              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">Length</Label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLength(l.id);
                        if (analysis && !generateMutation.isPending) {
                          generateMutation.mutate();
                        }
                      }}
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
                subProfileId={chosenProfile?.id ?? null}
                currentLink={portfolioLink}
                onLinkChange={setPortfolioLink}
                autoGenerate={!!analysis && !portfolioLink}
                detectedNiche={analysis?.detectedNiche ?? null}
                detectedSkills={(analysis as any)?.extractedEntities ?? []}
              />

              {/* Portfolio selection */}
              <div>
                <Label className="annotation mb-2 block !text-muted-foreground">
                  Additional portfolio links · up to 3
                </Label>
                {/* Fix 9 — auto-match indicator (overridable: user can toggle items below) */}
                {autoMatchInfo && autoMatchInfo.titles.length > 0 && (
                  <div className="mb-2 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-xs text-teal">
                    <span className="font-semibold">Auto-matched:</span> {autoMatchInfo.titles.join(", ")}
                    {autoMatchInfo.skills.length > 0 && (
                      <span className="text-teal/70"> · based on detected skills: {autoMatchInfo.skills.join(", ")}</span>
                    )}
                    <span className="block text-teal/50 mt-0.5">Toggle any item below to override.</span>
                  </div>
                )}
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

        </div>
      </div>

      {/* ── Full-width output section ─────────────────────────────────────── */}
      {content && (
        <div className="mt-8 space-y-6">
          {/* Fabrication guard warning (Fix 7): unverifiable claims left after auto-remediation */}
          {factCheck && factCheck.flagged.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-300">
                    Unverifiable claim{factCheck.flagged.length > 1 ? "s" : ""} detected — review before sending
                  </p>
                  <p className="mt-1 text-[12px] text-amber-200/80">
                    {factCheck.remediated
                      ? "The system auto-removed some fabricated facts, but these still couldn't be traced to your job post, portfolio, or inputs:"
                      : "These specific claims could not be traced to your job post, portfolio, or inputs and may be fabricated:"}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {factCheck.flagged.map((f, i) => (
                      <li key={i} className="text-[12px] text-amber-100/90">
                        <span className="font-medium">“{f.claim}”</span>
                        <span className="text-amber-200/60"> — {f.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-[12px] text-amber-200 cursor-pointer">
                    <input type="checkbox" checked={factCheckAck} onChange={(e) => setFactCheckAck(e.target.checked)} className="accent-amber-400" />
                    I've reviewed these and confirm they're accurate (or I'll edit them out)
                  </label>
                </div>
              </div>
            </div>
          )}
          {/* Comparison: AI Generated vs Your Version */}
          {aiGeneratedContent && (
            <div>
              <div className="mb-3 flex items-center gap-3">
                <Eyebrow>Proposal comparison</Eyebrow>
                <span className="text-[11px] text-muted-foreground">AI original on the left · your edited version on the right</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {/* AI Generated */}
                <CropCard className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-teal" />
                      <span className="text-xs font-semibold text-teal uppercase tracking-wider">AI Generated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{aiGeneratedContent.length} chars</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-white" onClick={() => copyText(aiGeneratedContent).then(() => toast.success("AI version copied"))}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto rounded-xl border border-teal/20 bg-background/50 px-5 py-4 scrollbar-thin">
                    {aiGeneratedContent.split(/\n{2,}/).map((p, i) => (
                      <p key={i} className={cn("leading-[1.85] mb-4 last:mb-0", i === 0 ? "text-[14px] text-white font-medium" : "text-[13px] text-foreground/85")}>
                        {p.replace(/\n/g, " ").trim()}
                      </p>
                    ))}
                  </div>
                </CropCard>

                {/* Your Version */}
                <CropCard glow="gold" className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-semibold text-gold uppercase tracking-wider">Your Version</span>
                      {content !== aiGeneratedContent && (
                        <span className="rounded-full bg-gold/15 border border-gold/30 px-1.5 py-0.5 text-[9px] font-medium text-gold">Edited</span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{content.length} chars</span>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto rounded-xl border border-gold/20 bg-background/50 px-5 py-4 scrollbar-thin">
                    {content.split(/\n{2,}/).map((p, i) => (
                      <p key={i} className={cn("leading-[1.85] mb-4 last:mb-0", i === 0 ? "text-[14px] text-white font-medium" : "text-[13px] text-foreground/85")}>
                        {p.replace(/\n/g, " ").trim()}
                      </p>
                    ))}
                  </div>
                </CropCard>
              </div>
            </div>
          )}

          {/* Output panel (editable, save, export) */}
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
            detectedLanguage={analysis?.detectedLanguage ?? null}
          />
        </div>
      )}

      {/* Strategy Document */}
      {strategyDoc && showStrategy && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Eyebrow>Project strategy</Eyebrow>
            <div className="flex flex-wrap gap-2">
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

          {/* Shareable strategy link */}
          <div className="rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-teal uppercase tracking-wider">Shareable Link</span>
              {strategyLinkSaving && <Loader2 className="h-3 w-3 animate-spin text-teal" />}
            </div>
            {strategySlug ? (
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`/s/${strategySlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-0 truncate font-mono text-xs text-teal hover:underline"
                >
                  {typeof window !== "undefined" ? window.location.origin : ""}/s/{strategySlug}
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-7 border-teal/30 text-teal hover:bg-teal/10 text-xs"
                  onClick={() => {
                    const url = `${window.location.origin}/s/${strategySlug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Strategy link copied");
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy link
                </Button>
              </div>
            ) : strategyLinkSaving ? (
              <p className="text-xs text-white/40">Generating shareable link…</p>
            ) : (
              <p className="text-xs text-red-400">Link generation failed — use Download PDF instead</p>
            )}
          </div>

          {/* Digital skills portfolio samples */}
          {(samplesGenerating || samplesSlug) && (
            <div className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gold uppercase tracking-wider">Portfolio Samples</span>
                {samplesGenerating && <Loader2 className="h-3 w-3 animate-spin text-gold" />}
              </div>
              {samplesSlug ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`/sample/${samplesSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 truncate font-mono text-xs text-gold hover:underline"
                  >
                    {typeof window !== "undefined" ? window.location.origin : ""}/sample/{samplesSlug}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 border-gold/30 text-gold hover:bg-gold/10 text-xs"
                    onClick={() => {
                      const url = `${window.location.origin}/sample/${samplesSlug}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Samples link copied");
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy link
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-white/40">Generating portfolio samples…</p>
              )}
            </div>
          )}

          <StrategyDocumentView doc={strategyDoc} />
        </div>
      )}

      {content && (
        <>
          <VoiceEditPrompt
            onApply={(instruction) => voiceEditMutation.mutate(instruction)}
            isPending={voiceEditMutation.isPending}
          />
          <InlineRewriteToolbar fullText={content} onReplace={applyRewrite} enabled={!!content} />
        </>
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
// Humanize a raw id (e.g. "authority_proof" → "Authority Proof") so a lookup miss
// never shows the user a broken snake_case string.
function prettyId(id: string | undefined): string {
  if (!id) return "—";
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AnalysisPanel({ analysis }: { analysis: JobAnalysis }) {
  const hook = HOOKS.find((h) => h.id === analysis.suggestedHookId);
  const strat = STRATEGIES.find((s) => s.id === analysis.suggestedStrategyId);
  return (
    <CropCard className="p-5 bp-rise">
      <Eyebrow index="A">Job analysis</Eyebrow>
      {(analysis as any).usedFallbackEngine && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Simplified analysis — the full intelligence engine was unavailable for this run. Hook/strategy/CTA quality may be weaker and the Golden Key card won't appear. Re-run to try the full engine again.</span>
        </div>
      )}
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
          <SuggestionCard label="Suggested hook" name={hook?.name ?? prettyId(analysis.suggestedHookId)} reason={analysis.hookReason} />
          <SuggestionCard label="Suggested strategy" name={strat?.name ?? prettyId(analysis.suggestedStrategyId)} reason={analysis.strategyReason} />
        </div>
        {/* Fix 12 — Golden Key decision card */}
        <GoldenKeyCard goldenKey={(analysis as any)?.intelligence?.proposalBlueprint?.goldenKey} />
        <p className="annotation !text-muted-foreground">
          Suggestions applied below — override the dropdowns any time.
        </p>
      </div>
    </CropCard>
  );
}

function GoldenKeyCard({ goldenKey }: { goldenKey?: { use: boolean; keyId: string | null; placement: string | null; reason: string } }) {
  if (!goldenKey) return null;
  const key = goldenKey.use ? goldenKeyById(goldenKey.keyId ?? undefined) : undefined;
  return (
    <div className="rounded-md border border-teal/25 bg-teal/[0.05] p-3">
      <div className="flex items-center gap-2">
        <Key className="h-3.5 w-3.5 text-teal" />
        <p className="annotation !text-teal">Golden Key</p>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
          goldenKey.use ? "bg-teal/15 text-teal" : "bg-white/5 text-muted-foreground")}>
          {goldenKey.use ? `Used · ${goldenKey.placement ?? "?"}` : "Not used"}
        </span>
      </div>
      {key && (
        <p className="mt-2 text-sm italic text-white/90 leading-relaxed">"{key.text}"</p>
      )}
      {key && (
        <p className="mt-1 text-[10px] text-teal/60">{key.pattern} · {key.register}</p>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{goldenKey.reason}</p>
    </div>
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
  detectedLanguage,
}: {
  content: string; setContent: (v: string) => void;
  explanation: { hook: string; strategy: string; question: string } | null;
  showExplain: boolean; setShowExplain: (v: boolean) => void;
  title: string; onSave: () => void; saving: boolean;
  onSaveTemplate: () => void; savingTemplate: boolean;
  chosenProfile?: { label: string } | null; onGoHistory: () => void;
  injecting?: boolean; onPolish?: () => void; polishing?: boolean;
  detectedLanguage?: string | null;
}) {
  const [editMode, setEditMode] = useState(false);

  // Fix 11 — English review preview for non-English proposals (never replaces the real text).
  const isNonEnglish = !!detectedLanguage && !/english/i.test(detectedLanguage);
  const [showEnglish, setShowEnglish] = useState(false);
  const [englishText, setEnglishText] = useState<string | null>(null);
  const translateMutation = useMutation({
    mutationFn: () => translateToEnglish({ data: { text: content, sourceLanguage: detectedLanguage ?? undefined } }),
    onSuccess: (res) => { setEnglishText(res!.text); setShowEnglish(true); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Translation failed"),
  });
  // Invalidate a stale translation if the proposal text changes.
  useEffect(() => { setEnglishText(null); setShowEnglish(false); }, [content]);

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
          {isNonEnglish && (
            <button
              onClick={() => {
                if (englishText) { setShowEnglish((v) => !v); }
                else { translateMutation.mutate(); }
              }}
              disabled={translateMutation.isPending}
              className={cn("flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                showEnglish ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-border text-muted-foreground hover:text-white")}
            >
              {translateMutation.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Languages className="h-3 w-3" />}
              {showEnglish ? "Hide English" : "Preview in English"}
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={cn("rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              editMode ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-muted-foreground hover:text-white")}
          >
            {editMode ? "Preview" : "Edit"}
          </button>
        </div>
      </div>

      {/* Fix 11 — English translation preview (review only; NOT the submittable text) */}
      {isNonEnglish && showEnglish && englishText && (
        <div className="mb-4 rounded-xl border border-blue-400/30 bg-blue-400/[0.06] px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <Languages className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">English preview — for review only</span>
          </div>
          <p className="mb-3 text-[11px] text-blue-200/70">
            The {detectedLanguage} proposal above is what will be submitted. This translation is only to help you sanity-check the content.
          </p>
          {englishText.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="mb-3 text-[13px] leading-[1.8] text-foreground/80 last:mb-0">{p.replace(/\n/g, " ").trim()}</p>
          ))}
        </div>
      )}

      {editMode ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="resize-y bg-background/60 text-sm leading-relaxed font-mono"
        />
      ) : (
        <div data-rewrite-target="proposal" className="rounded-xl border border-border/40 bg-background/50 px-6 py-5">
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
        <Button size="sm" variant="secondary" onClick={() => copyMarkdown(title, content).then(() => toast.success("Markdown copied"))}>
          <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Markdown
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
