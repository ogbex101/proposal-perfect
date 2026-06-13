import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Loader2, Copy, Trash2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { toast } from "sonner";
import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { generateConversionResponses } from "@/lib/ai.functions";
import { listConversions, saveConversion, deleteConversion } from "@/lib/conversion.functions";
import { copyText } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/conversion")({
  component: ConversionPage,
});

type ConversionResult = {
  bestReply: string;
  bestReplyReason: string;
  alternatives: Array<{ mode: string; reply: string }>;
};

type ConversionRow = {
  id: string;
  input: string;
  outputs: string[];
  created_at: string;
};

const modeColors: Record<string, string> = {
  "Founder-to-Founder": "text-gold",
  "As a Friend": "text-teal",
  "Show Knowledge": "text-blue-400",
  "Strong Understanding": "text-purple-400",
  "Sharp & Brief": "text-red-400",
};

function ConversionPage() {
  const qc = useQueryClient();
  const [clientMsg, setClientMsg] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [sentProposal, setSentProposal] = useState("");
  const [replyLanguage, setReplyLanguage] = useState("English");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ["conversions"],
    queryFn: () => listConversions(),
  });
  const rows = (history.data ?? []) as ConversionRow[];

  const generate = useMutation({
    mutationFn: () => generateConversionResponses({
      data: {
        clientMessage: clientMsg,
        jobDescription: jobDesc || undefined,
        sentProposal: sentProposal || undefined,
        replyLanguage: replyLanguage !== "English" ? replyLanguage : undefined,
      },
    }),
    onSuccess: async (data) => {
      if (!data) return;
      setResult(data);
      await saveConversion({
        data: {
          input: clientMsg,
          outputs: [data.bestReply, ...data.alternatives.map((a) => `${a.mode}: ${a.reply}`)],
        },
      });
      qc.invalidateQueries({ queryKey: ["conversions"] });
      toast.success("Replies ready");
    },
    onError: (e: Error) => toast.error(e.message || "Could not generate"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversion({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversions"] }),
    onError: (e: Error) => toast.error(e.message || "Could not delete"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Follow-up"
        title="Conversion Messages"
        description="Paste the full context. Get the best reply instantly — client is waiting."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left: generator */}
        <div className="space-y-4">
          <CropCard className="p-5 space-y-4">
            {/* Job description (optional) */}
            <div>
              <Label className="annotation !text-muted-foreground">Job description <span className="text-[10px] text-muted-foreground/60">(optional — improves context)</span></Label>
              <Textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                rows={3}
                placeholder="Paste the original job post…"
                className="mt-1.5 resize-y bg-background/60 text-sm leading-relaxed"
              />
            </div>

            {/* Sent proposal (optional) */}
            <div>
              <Label className="annotation !text-muted-foreground">Your sent proposal <span className="text-[10px] text-muted-foreground/60">(optional — grounds the reply)</span></Label>
              <Textarea
                value={sentProposal}
                onChange={(e) => setSentProposal(e.target.value)}
                rows={3}
                placeholder="Paste the proposal you already sent…"
                className="mt-1.5 resize-y bg-background/60 text-sm leading-relaxed"
              />
            </div>

            {/* Client message (required) */}
            <div>
              <Label className="annotation !text-muted-foreground">Client's message <span className="text-destructive text-[10px]">*</span></Label>
              <Textarea
                value={clientMsg}
                onChange={(e) => setClientMsg(e.target.value)}
                rows={4}
                placeholder="Paste exactly what the client sent you — question, objection, interest, update…"
                className="mt-1.5 resize-y bg-background/60 leading-relaxed"
              />
            </div>

            {/* Language */}
            <div>
              <Label className="annotation !text-muted-foreground">Reply language</Label>
              <select
                value={replyLanguage}
                onChange={(e) => setReplyLanguage(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {["English","French","Spanish","Portuguese","Arabic","German","Italian","Dutch","Russian","Chinese","Japanese","Korean"].map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <Button
              className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
              disabled={generate.isPending || clientMsg.trim().length < 5}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating best reply…</>
              ) : (
                <><Zap className="mr-1.5 h-4 w-4" /> Get best reply</>
              )}
            </Button>
          </CropCard>

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Best reply — highlighted */}
              <CropCard className="p-4 border-gold/40 bg-gold/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-gold" />
                    <span className="text-[11px] font-bold text-gold uppercase tracking-wider">AI Best Reply</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold/40 text-gold hover:bg-gold/10"
                    onClick={async () => { await copyText(result.bestReply); toast.success("Copied"); }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground/95 mb-3">{result.bestReply}</p>
                {result.bestReplyReason && (
                  <p className="text-[11px] text-muted-foreground border-t border-line/40 pt-2 mt-2 italic">
                    {result.bestReplyReason}
                  </p>
                )}
              </CropCard>

              {/* Alternatives */}
              <Eyebrow className="px-1">Alternative angles</Eyebrow>
              {result.alternatives.map((alt, i) => (
                <CropCard key={i} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("font-mono text-[10px] font-semibold", modeColors[alt.mode] ?? "text-muted-foreground")}>
                      {alt.mode}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-white"
                      onClick={async () => { await copyText(alt.reply); toast.success("Copied"); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/80">{alt.reply}</p>
                </CropCard>
              ))}
            </div>
          )}
        </div>

        {/* Right: history */}
        <div>
          <Eyebrow className="mb-4">History</Eyebrow>
          {history.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No conversion messages yet"
              description="Generate a reply above and it'll be saved here."
            />
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const isOpen = expanded === row.id;
                const outputs = Array.isArray(row.outputs) ? row.outputs : [];
                return (
                  <CropCard key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(isOpen ? null : row.id)}>
                        <p className="truncate text-sm font-medium text-white">
                          {row.input.slice(0, 80)}{row.input.length > 80 ? "…" : ""}
                        </p>
                        <p className="annotation mt-0.5 !text-muted-foreground">
                          {outputs.length} replies · {new Date(row.created_at).toLocaleDateString()}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white"
                          onClick={() => setExpanded(isOpen ? null : row.id)}>
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(row.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {isOpen && outputs.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-line/60 pt-3">
                        {outputs.map((opt, j) => (
                          <div key={j} className="group relative rounded-lg bg-sidebar/60 p-3">
                            <p className="pr-8 text-xs leading-relaxed text-muted-foreground">{opt}</p>
                            <button className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async () => { await copyText(opt); toast.success("Copied"); }}>
                              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CropCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
