import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Sparkles, FolderOpen, Eye, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortfolioLanding } from "@/components/PortfolioLanding";
import {
  generatePortfolio,
  listGeneratedPortfolios,
  saveGeneratedPortfolio,
} from "@/lib/portfolio-generate.functions";
import { listPortfolio } from "@/lib/portfolio.functions";
import type { PortfolioData } from "@/lib/portfolio-types";
import { cn } from "@/lib/utils";

type Mode = "link" | "saved" | "generate";

interface PortfolioPickerProps {
  jobDescription: string;
  subProfileId?: string | null;
  currentLink: string | null;
  onLinkChange: (url: string | null) => void;
  autoGenerate?: boolean;
}

function portfolioUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/p/${slug}`;
}

export function PortfolioPicker({ jobDescription, subProfileId, currentLink, onLinkChange, autoGenerate }: PortfolioPickerProps) {
  const [mode, setMode] = useState<Mode>("link");
  const [linkValue, setLinkValue] = useState(currentLink ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [generated, setGenerated] = useState<{
    data: PortfolioData;
    displayData: PortfolioData;
    niche: string;
    jobExcerpt: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ["generated-portfolios"],
    queryFn: () => listGeneratedPortfolios(),
  });
  const saved = savedQuery.data ?? [];

  const portfolioItemsQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio() });
  const portfolioItems = portfolioItemsQuery.data ?? [];
  const filteredSuggestions = portfolioItems.filter(
    (p) =>
      !linkValue ||
      p.title.toLowerCase().includes(linkValue.toLowerCase()) ||
      p.url.toLowerCase().includes(linkValue.toLowerCase()),
  );

  const generateMutation = useMutation({
    mutationFn: () => generatePortfolio({ data: { jobDescription, subProfileId: subProfileId ?? undefined } }),
    onSuccess: (res) => {
      setGenerated(res);
      setSavedSlug(null);
      setPreviewOpen(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Generation failed"),
  });

  // Auto-generate portfolio when analysis is done and no link is set yet
  useEffect(() => {
    if (autoGenerate && !currentLink && !generated && !generateMutation.isPending && jobDescription.trim().length >= 20) {
      setMode("generate");
      generateMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!generated) throw new Error("Nothing to save");
      return saveGeneratedPortfolio({
        data: {
          niche: generated.niche,
          jobExcerpt: generated.jobExcerpt,
          data: generated.data,
        },
      });
    },
    onSuccess: (row) => {
      setSavedSlug(row.slug);
      queryClient.invalidateQueries({ queryKey: ["generated-portfolios"] });
      toast.success("Saved to your portfolios");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  function handleGenerate() {
    if (jobDescription.trim().length < 20) {
      toast.info("Paste the job description first so the portfolio can be tailored to it.");
      return;
    }
    generateMutation.mutate();
  }

  async function handleUseInProposal() {
    let slug = savedSlug;
    if (!slug) {
      const row = await saveMutation.mutateAsync();
      slug = row.slug;
    }
    const url = portfolioUrl(slug);
    onLinkChange(url);
    setPreviewOpen(false);
    toast.success("Portfolio attached to this proposal");
  }

  return (
    <div className="space-y-3">
      <Label className="annotation block !text-muted-foreground">Portfolio for this job</Label>

      {/* Option selector */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: "link", label: "Paste link", icon: Link2 },
            { id: "saved", label: "Saved", icon: FolderOpen },
            { id: "generate", label: "Generate AI", icon: Sparkles },
          ] as const
        ).map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors",
                active
                  ? "border-gold/60 bg-gold/10 text-gold"
                  : "border-border bg-background/40 text-muted-foreground hover:border-teal/40",
              )}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Option 1 — paste link with portfolio autocomplete */}
      {mode === "link" && (
        <div className="relative">
          <Input
            ref={linkInputRef}
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              onLinkChange(e.target.value.trim() || null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Paste URL or type to search your portfolios…"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-sidebar shadow-lg">
              {filteredSuggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLinkValue(p.url);
                    onLinkChange(p.url);
                    setShowSuggestions(false);
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
                >
                  <span className="font-medium text-white">{p.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{p.url}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Option 2 — saved portfolios */}
      {mode === "saved" && (
        <div>
          {saved.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No saved portfolios yet. Generate one to reuse it on future proposals.
            </p>
          ) : (
            <Select
              onValueChange={(slug) => onLinkChange(portfolioUrl(slug))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved portfolio" />
              </SelectTrigger>
              <SelectContent>
                {saved.map((p) => (
                  <SelectItem key={p.id} value={p.slug}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Option 3 — generate */}
      {mode === "generate" && (
        <div className="space-y-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building your portfolio…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI portfolio for this job
              </>
            )}
          </Button>
          {generated && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              className="w-full"
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview generated portfolio
            </Button>
          )}
          {generateMutation.isPending && (
            <p className="text-xs text-muted-foreground">
              Analyzing the job, writing each section, and generating project images. This can take up to a minute.
            </p>
          )}
        </div>
      )}

      {/* Currently attached link */}
      {currentLink && (
        <a
          href={currentLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 truncate text-xs text-teal hover:underline"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {currentLink}
        </a>
      )}

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-3">
            <DialogTitle className="text-sm">Portfolio preview</DialogTitle>
          </DialogHeader>

          <div className="max-h-[64vh] overflow-y-auto">
            {generated && <PortfolioLanding data={generated.displayData} />}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !!savedSlug}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : savedSlug ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {savedSlug ? "Saved" : "Save this portfolio"}
            </Button>
            <Button type="button" onClick={handleUseInProposal} disabled={saveMutation.isPending}>
              Use in proposal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
