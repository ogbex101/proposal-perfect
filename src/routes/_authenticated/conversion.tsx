import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessagesSquare,
  Sparkles,
  Loader2,
  Copy,
  Trash2,
  CornerDownRight,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateConversionResponses } from "@/lib/ai.functions";
import {
  listConversions,
  saveConversion,
  deleteConversion,
} from "@/lib/conversion.functions";
import { copyText } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/conversion")({
  component: ConversionPage,
});

type Conversation = {
  id: string;
  input: string;
  outputs: string[];
  created_at: string;
};

function ConversionPage() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [outputs, setOutputs] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["conversions"],
    queryFn: () => listConversions(),
  });
  const history = (data ?? []) as Conversation[];

  const persist = useMutation({
    mutationFn: (v: { input: string; outputs: string[] }) =>
      saveConversion({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversions"] }),
  });

  const generate = useMutation({
    mutationFn: (clientMessage: string) =>
      generateConversionResponses({ data: { clientMessage } }),
    onSuccess: (res) => {
      const opts = (res ?? []) as string[];
      setOutputs(opts);
      if (opts.length) persist.mutate({ input, outputs: opts });
      toast.success("Replies ready");
    },
    onError: (e: Error) => toast.error(e.message || "Generation failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversion({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversions"] }),
  });

  const setOutputAt = (i: number, val: string) =>
    setOutputs((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  return (
    <div>
      <PageHeader
        eyebrow="Reply engine"
        title="Conversion Messages"
        description="Paste a client's message — a question, a negotiation, a change request, even a rejection — and get human replies that move toward a close."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Input */}
        <div>
          <Eyebrow index="01">client message</Eyebrow>
          <CropCard className="mt-3 p-4">
            <Textarea
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste what the client wrote to you…"
              className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
            />
          </CropCard>
          <Button
            className="mt-4 w-full bg-gold text-primary-foreground hover:bg-gold-bright sm:w-auto"
            disabled={generate.isPending || input.trim().length < 5}
            onClick={() => generate.mutate(input.trim())}
          >
            {generate.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            Generate replies
          </Button>
        </div>

        {/* Outputs */}
        <div>
          <Eyebrow index="02">reply options</Eyebrow>
          <div className="mt-3 space-y-3">
            {generate.isPending ? (
              <CropCard className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Drafting three angles…
              </CropCard>
            ) : outputs.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="Replies appear here"
                description="You'll get three distinct options. Edit any of them, then copy the one that fits."
              />
            ) : (
              outputs.map((out, i) => (
                <CropCard key={i} glow={i === 0 ? "gold" : "teal"} className="p-4">
                  <div className="flex items-center justify-between">
                    <Eyebrow>option {String.fromCharCode(65 + i)}</Eyebrow>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-muted-foreground hover:text-white"
                      onClick={async () => {
                        await copyText(out);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={out}
                    onChange={(e) => setOutputAt(i, e.target.value)}
                    className="mt-2 resize-none border-0 bg-transparent p-0 text-sm leading-relaxed focus-visible:ring-0"
                  />
                </CropCard>
              ))
            )}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="mt-10">
        <Eyebrow>
          <History className="mr-1 inline h-3 w-3" /> recent threads
        </Eyebrow>
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Generated threads are saved here automatically.
            </p>
          ) : (
            history.map((h) => (
              <CropCard key={h.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{h.input}</p>
                    <p className="annotation mt-0.5 !text-muted-foreground">
                      {h.outputs.length} replies ·{" "}
                      {new Date(h.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-muted-foreground hover:text-white"
                      onClick={() => {
                        setInput(h.input);
                        setOutputs(h.outputs);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <CornerDownRight className="mr-1.5 h-3.5 w-3.5" /> Load
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(h.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CropCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
