import { useMemo, useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listSaved } from "@/lib/saved.functions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  NICHES,
  PROPOSAL_TEMPLATES,
  composeTemplate,
  type ProposalTemplate,
} from "@/lib/proposal-templates";

interface Props {
  /** Replace the current draft entirely with the template body. */
  onApply: (body: string) => void;
}

const MINE = "My templates";

export function ProposalTemplatePicker({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [niche, setNiche] = useState<string>(NICHES[0] ?? "");
  const [selected, setSelected] = useState<ProposalTemplate | null>(null);

  const savedQuery = useQuery({
    queryKey: ["saved"],
    queryFn: () => listSaved(),
    enabled: open,
  });

  const mine: ProposalTemplate[] = useMemo(() => {
    const rows = (savedQuery.data ?? []) as Array<{
      id: string;
      kind: string;
      snapshot: { title?: string; content?: string; structure?: string } | null;
    }>;
    return rows
      .filter((r) => r.kind === "proposal" && typeof r.snapshot?.content === "string")
      .map((r) => ({
        id: r.id,
        niche: MINE,
        name: r.snapshot?.title || "Saved structure",
        description: r.snapshot?.structure ?? "Saved from one of your proposals.",
        sections: {
          intro: r.snapshot!.content as string,
          value: "",
          pricing: "",
          cta: "",
          closing: "",
        },
      }));
  }, [savedQuery.data]);

  const tabs = useMemo(() => [MINE, ...NICHES], []);

  const filtered = useMemo(
    () => (niche === MINE ? mine : PROPOSAL_TEMPLATES.filter((t) => t.niche === niche)),
    [niche, mine],
  );

  function apply(t: ProposalTemplate) {
    onApply(composeTemplate(t));
    toast.success(`Loaded "${t.name}" template — customize the placeholders.`);
    setOpen(false);
    setSelected(null);
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">Start from a template</p>
          <p className="text-[11px] text-muted-foreground">
            Prefilled intro · value · pricing · CTA · closing.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-[11px]">
              <FileText className="mr-1 h-3 w-3" /> Browse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Proposal templates</DialogTitle>
              <DialogDescription>
                Pick a niche, preview a template, then load it into your draft.
                Placeholders like <code className="text-teal">{"{{client_name}}"}</code> are yours to fill in.
              </DialogDescription>
            </DialogHeader>

            {/* Niche tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-3">
              {tabs.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setNiche(n); setSelected(null); }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    niche === n
                      ? "border-teal/50 bg-teal/10 text-teal"
                      : "border-border text-muted-foreground hover:text-white",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
              {/* Template list */}
              <ScrollArea className="max-h-[420px] pr-2">
                <div className="space-y-1.5">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelected(t)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left transition-colors",
                        selected?.id === t.id
                          ? "border-teal/60 bg-teal/10"
                          : "border-border/60 bg-background/40 hover:border-teal/40",
                      )}
                    >
                      <p className="text-xs font-medium text-white">{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.description}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {/* Preview */}
              <div className="rounded-md border border-border/40 bg-background/30 p-3">
                {selected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{selected.name}</p>
                        <p className="text-[11px] text-muted-foreground">{selected.niche}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => apply(selected)}
                        className="bg-gold text-primary-foreground hover:bg-gold-bright"
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> Use template
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[340px] pr-2">
                      <div className="space-y-3 text-[12px] leading-relaxed">
                        {([
                          ["Intro", selected.sections.intro],
                          ["Value", selected.sections.value],
                          ["Pricing", selected.sections.pricing],
                          ["CTA", selected.sections.cta],
                          ["Closing", selected.sections.closing],
                        ] as const).map(([label, body]) => (
                          <div key={label}>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal">
                              {label}
                            </p>
                            <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Pick a template on the left to preview it.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
