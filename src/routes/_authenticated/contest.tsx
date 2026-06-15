import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Trophy, Copy, Check, Loader2, Link2, Wand2,
  Palette, Type, Layout, Star, Package, MessageSquare, Eye, ChevronDown, ChevronUp, Download, ImageIcon,
} from "lucide-react";
import { PageHeader, CropCard, Eyebrow } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/MicButton";
import { VoiceEditPrompt } from "@/components/VoiceEditPrompt";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateContestBrief, applyProposalEdit, generateProposalImage } from "@/lib/ai.functions";
import { saveContestBrief } from "@/lib/contest.functions";
import type { ContestBrief } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/contest")({
  component: ContestPage,
});

function ContestPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [brief, setBrief] = useState<ContestBrief | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const generateMutation = useMutation({
    mutationFn: () => generateContestBrief({ data: { contestDescription: description, additionalContext: context || undefined } }),
    onSuccess: (result) => {
      setBrief(result as ContestBrief);
      setShareSlug(null);
      setShowPreview(true);
      toast.success("Contest brief generated!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveContestBrief({ data: { brief, contestTitle: brief?.title } }),
    onSuccess: ({ slug }) => {
      setShareSlug(slug);
      toast.success("Brief saved — share link ready!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (instruction: string) =>
      applyProposalEdit({ data: { proposalText: JSON.stringify(brief, null, 2), instruction } }),
    onSuccess: (result) => {
      if (result?.text) {
        try {
          const parsed = JSON.parse(result.text) as ContestBrief;
          setBrief(parsed);
          setShareSlug(null);
          toast.success("Brief updated!");
        } catch {
          toast.error("Could not parse AI edit — try again.");
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink() {
    if (!shareSlug) return;
    const url = `${window.location.origin}/ct/${shareSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareUrl = shareSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/ct/${shareSlug}` : null;

  return (
    <div>
      <PageHeader
        eyebrow="Contest"
        title="Contest Submission"
        description="Paste a design contest description — AI builds your creative brief, ready to submit and share."
      />

      {/* Input section */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <CropCard className="p-5">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold text-white">Contest Description</Label>
            <MicButton onTranscript={(t) => setDescription((p) => (p + " " + t).trim())} />
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the full contest description here — what the client is looking for, brand info, style preferences, target audience, deliverables needed…"
            rows={10}
            className="resize-none bg-background/60 text-sm"
          />
        </CropCard>

        <CropCard className="p-5">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold text-white">Additional Context <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <MicButton onTranscript={(t) => setContext((p) => (p + " " + t).trim())} />
          </div>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Extra info: your design style, past work to reference, any constraints or preferences you want the brief to reflect…"
            rows={6}
            className="resize-none bg-background/60 text-sm"
          />

          <div className="mt-4 space-y-2">
            <Button
              className="w-full bg-gradient-to-r from-teal to-teal/70 text-white shadow-lg shadow-teal/20 hover:shadow-teal/40"
              disabled={description.trim().length < 20 || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating brief…</>
                : <><Wand2 className="mr-2 h-4 w-4" /> Generate Creative Brief</>}
            </Button>

            {brief && (
              <>
                <Button
                  variant="outline"
                  className="w-full border-gold/30 text-gold hover:bg-gold/10"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                    : <><Link2 className="mr-2 h-4 w-4" /> Save & Get Share Link</>}
                </Button>
                {shareUrl && (
                  <div className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2">
                    <span className="flex-1 truncate font-mono text-xs text-teal">{shareUrl}</span>
                    <button onClick={copyLink} className="shrink-0 text-teal hover:text-white">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </CropCard>
      </div>

      {/* Brief Preview */}
      {brief && (
        <>
          <CropCard className="mb-4 p-5">
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setShowPreview((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-teal" />
                <Eyebrow className="text-teal">Creative Brief Preview</Eyebrow>
              </div>
              {showPreview ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showPreview && (
              <div className="mt-4">
                <ContestBriefView brief={brief} />
              </div>
            )}
          </CropCard>

          {/* Voice Editor */}
          <VoiceEditPrompt
            onApply={(instruction) => editMutation.mutate(instruction)}
            isPending={editMutation.isPending}
          />

          {/* AI Image Generation */}
          <ContestImageGenerator brief={brief} />
        </>
      )}
    </div>
  );
}

// ─── Contest Image Generator Component ────────────────────────────────────────

function ContestImageGenerator({ brief }: { brief: ContestBrief }) {
  const [images, setImages] = useState<(string | null)[]>([null, null]);
  const [loading, setLoading] = useState<boolean[]>([false, false]);

  const prompts = [
    `${brief.title} design concept. ${brief.moodKeywords.join(", ")} aesthetic. Color palette: ${brief.colorPalette.map(c => c.name).join(", ")}. Professional ${brief.layoutApproach.slice(0, 100)}`,
    `Logo and brand identity for ${brief.title}. ${brief.typography.primary} typography. ${brief.moodKeywords.slice(0, 3).join(" ")} mood. Clean minimalist presentation.`,
  ];

  async function generate() {
    setLoading([true, true]);
    setImages([null, null]);

    const results: (string | null)[] = [null, null];
    for (let i = 0; i < 2; i++) {
      try {
        const res = await generateProposalImage({ data: { prompt: prompts[i] } });
        results[i] = res.dataUrl;
        setImages([...results]);
      } catch {
        results[i] = null;
        setImages([...results]);
      } finally {
        setLoading(prev => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
      }
    }
  }

  function downloadImage(dataUrl: string, index: number) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `design-concept-${index + 1}.png`;
    a.click();
  }

  const isGenerating = loading.some(Boolean);

  return (
    <CropCard className="p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Generate Design Concepts</h3>
        </div>
        <Button
          variant="outline"
          className="border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
          onClick={generate}
          disabled={isGenerating}
        >
          {isGenerating
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            : <><Sparkles className="mr-2 h-4 w-4" /> Generate visual concepts</>}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="relative rounded-xl border border-white/10 bg-[#0a1820] overflow-hidden aspect-square flex items-center justify-center">
            {loading[i] ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                <p className="text-xs">Generating concept {i + 1}…</p>
              </div>
            ) : images[i] ? (
              <>
                <img src={images[i]!} alt={`Design concept ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => downloadImage(images[i]!, i)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-30" />
                <p className="text-xs">Concept {i + 1}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </CropCard>
  );
}

// ─── Contest Brief View Component ─────────────────────────────────────────────

export function ContestBriefView({ brief }: { brief: ContestBrief }) {
  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#060d12] p-6 md:p-8">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-teal mb-1">Contest Creative Brief</p>
        <h1 className="text-2xl font-bold text-white mb-2">{brief.title}</h1>
        <p className="text-sm leading-relaxed text-white/70">{brief.overview}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {brief.moodKeywords.map((kw) => (
            <span key={kw} className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold">
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Design Concept */}
      <Section icon={<Sparkles className="h-4 w-4 text-teal" />} title="Design Concept">
        <p className="text-sm leading-relaxed text-white/80">{brief.designConcept}</p>
      </Section>

      {/* Color Palette */}
      <Section icon={<Palette className="h-4 w-4 text-gold" />} title="Color Palette">
        <div className="flex flex-wrap gap-3">
          {brief.colorPalette.map((c) => (
            <div key={c.hex} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div
                className="h-7 w-7 rounded-md border border-white/20 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <div>
                <p className="text-xs font-semibold text-white">{c.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{c.hex} · {c.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section icon={<Type className="h-4 w-4 text-purple-400" />} title="Typography">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
          <p className="text-sm text-white"><span className="text-muted-foreground text-xs">Primary: </span>{brief.typography.primary}</p>
          <p className="text-sm text-white"><span className="text-muted-foreground text-xs">Secondary: </span>{brief.typography.secondary}</p>
          <p className="mt-2 text-xs text-muted-foreground italic">{brief.typography.rationale}</p>
        </div>
      </Section>

      {/* Layout */}
      <Section icon={<Layout className="h-4 w-4 text-blue-400" />} title="Layout Approach">
        <p className="text-sm leading-relaxed text-white/80">{brief.layoutApproach}</p>
      </Section>

      {/* Key Elements */}
      <Section icon={<Star className="h-4 w-4 text-gold" />} title="Key Design Elements">
        <ul className="space-y-1.5">
          {brief.keyElements.map((el, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/80">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              {el}
            </li>
          ))}
        </ul>
      </Section>

      {/* Differentiator */}
      <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-teal mb-2">What Makes This Win</p>
        <p className="text-sm leading-relaxed text-white/90">{brief.differentiator}</p>
      </div>

      {/* Deliverables */}
      <Section icon={<Package className="h-4 w-4 text-green-400" />} title="Deliverables">
        <ul className="space-y-1.5">
          {brief.deliverables.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
              {d}
            </li>
          ))}
        </ul>
      </Section>

      {/* Submission note */}
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-gold" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-gold">Submission Note</p>
        </div>
        <p className="text-sm leading-relaxed text-white/90 italic">"{brief.submissionNote}"</p>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
