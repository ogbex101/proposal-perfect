import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessagesSquare, Loader2, Copy, Trash2, Zap, Plus,
  ChevronRight, Send, RotateCcw, Check, Pencil, X,
  BookOpen, ChevronDown, ChevronUp, Brain, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CropCard, Eyebrow, PageHeader, EmptyState } from "@/components/blueprint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { generateConversionResponses } from "@/lib/ai.functions";
import {
  listThreads, createThread, deleteThread, updateThread,
  listMessages, addMessage, deleteMessage,
} from "@/lib/conversion.functions";
import { listProposals } from "@/lib/proposals.functions";
import { copyText } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/conversion")({
  component: ConversionPage,
});

type Thread = {
  id: string;
  title: string;
  job_description: string;
  sent_proposal: string;
  stage: number;
  context_dump: string;
  extracted: {
    deliverables?: string[];
    painPoints?: string[];
    scopeOfWork?: string;
    timeline?: string;
  };
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  thread_id: string;
  role: "client" | "you";
  content: string;
  created_at: string;
};

type ConversionResult = {
  bestReply: string;
  bestReplyReason: string;
  alternatives: Array<{ mode: string; reply: string }>;
  stageAssessment?: {
    canAdvance: boolean;
    reason: string;
    extracted: {
      deliverables?: string[];
      painPoints?: string[];
      scopeOfWork?: string;
      timeline?: string;
    };
  };
};

const STAGE_LABELS = [
  "Understand the problem",
  "Build relationship",
  "Gradually convert",
  "Close the deal",
];

const STAGE_DESCRIPTIONS = [
  "Identify the core client problem clearly",
  "Establish genuine rapport and trust",
  "Discuss scope, timeline, and approach",
  "Guide client toward hire or contract",
];

const modeColors: Record<string, string> = {
  "Founder-to-Founder": "text-gold",
  "As a Friend": "text-teal",
  "Show Knowledge": "text-blue-400",
  "Strong Understanding": "text-purple-400",
  "Sharp & Brief": "text-red-400",
};

// ── Stage indicator ──────────────────────────────────────────────────────────

function StageBar({ stage, canAdvance, onAdvance }: {
  stage: number;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  return (
    <div className="mb-4 shrink-0">
      <div className="flex items-center gap-1 mb-2">
        {STAGE_LABELS.map((label, i) => {
          const s = i + 1;
          const done = stage > s;
          const active = stage === s;
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={cn(
                "flex flex-col items-center flex-1",
              )}>
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all",
                  done ? "bg-teal border-teal text-primary-foreground" :
                  active ? "bg-gold/20 border-gold text-gold" :
                  "bg-background/40 border-line/40 text-muted-foreground/50",
                )}>
                  {done ? <Check className="h-3 w-3" /> : s}
                </div>
                <span className={cn(
                  "text-[9px] text-center mt-0.5 leading-tight max-w-[60px]",
                  active ? "text-gold font-medium" : done ? "text-teal" : "text-muted-foreground/40",
                )}>
                  {label}
                </span>
              </div>
              {s < 4 && (
                <div className={cn(
                  "h-px flex-1 mx-1 transition-colors",
                  done ? "bg-teal" : "bg-line/40",
                )} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">{STAGE_DESCRIPTIONS[stage - 1]}</p>
      {canAdvance && stage < 4 && (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-teal/30 bg-teal/8 px-3 py-1.5">
          <Check className="h-3 w-3 text-teal" />
          <span className="text-[11px] text-teal">Stage {stage} complete!</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-teal hover:bg-teal/10 ml-1" onClick={onAdvance}>
            Advance to Stage {stage + 1} →
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Deep learning panel ──────────────────────────────────────────────────────

function DeepLearningPanel({
  contextDump,
  onSave,
}: {
  contextDump: string;
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(contextDump);

  useEffect(() => { setDraft(contextDump); }, [contextDump]);

  return (
    <div className="shrink-0 mb-3">
      <button
        className="flex w-full items-center justify-between rounded-lg border border-line/40 bg-background/40 px-3 py-2 text-left transition-colors hover:border-teal/30"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-teal" />
          <span className="text-xs font-medium text-white">Deep Learning</span>
          {contextDump && <span className="text-[9px] bg-teal/20 text-teal px-1.5 py-0.5 rounded-full">Active</span>}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-teal/20 bg-background/60 p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground">
            Paste a prior conversation with this client (or similar clients). The AI will study your writing style, their communication patterns, and prior agreements — making replies sound genuinely human and context-aware.
          </p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="Paste any prior conversation, messages, or notes about this client…"
            className="resize-y bg-background/60 text-xs"
          />
          <Button
            size="sm"
            className="w-full bg-teal/20 text-teal hover:bg-teal/30 border border-teal/30"
            onClick={() => { onSave(draft); setOpen(false); toast.success("Deep learning context saved"); }}
          >
            <Brain className="h-3.5 w-3.5 mr-1.5" /> Save context
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Extracted intel panel ────────────────────────────────────────────────────

function ExtractedPanel({ extracted }: {
  extracted: Thread["extracted"];
}) {
  const hasData = (extracted.deliverables?.length ?? 0) > 0 ||
    (extracted.painPoints?.length ?? 0) > 0 ||
    extracted.scopeOfWork || extracted.timeline;

  if (!hasData) return null;

  return (
    <div className="shrink-0 mb-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Extracted intel</span>
      </div>
      <div className="grid gap-2 text-[10px]">
        {extracted.timeline && (
          <div>
            <span className="text-muted-foreground font-mono">TIMELINE</span>
            <p className="text-white mt-0.5">{extracted.timeline}</p>
          </div>
        )}
        {extracted.scopeOfWork && (
          <div>
            <span className="text-muted-foreground font-mono">SCOPE</span>
            <p className="text-white mt-0.5">{extracted.scopeOfWork}</p>
          </div>
        )}
        {extracted.painPoints && extracted.painPoints.length > 0 && (
          <div>
            <span className="text-muted-foreground font-mono">PAIN POINTS</span>
            <ul className="mt-0.5 space-y-0.5">
              {extracted.painPoints.map((p, i) => <li key={i} className="text-white">· {p}</li>)}
            </ul>
          </div>
        )}
        {extracted.deliverables && extracted.deliverables.length > 0 && (
          <div>
            <span className="text-muted-foreground font-mono">DELIVERABLES</span>
            <ul className="mt-0.5 space-y-0.5">
              {extracted.deliverables.map((d, i) => <li key={i} className="text-white">· {d}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New-thread dialog ────────────────────────────────────────────────────────

function NewThreadPanel({
  proposals,
  onClose,
  onCreate,
}: {
  proposals: Array<{ id: string; title?: string | null; job_description: string; content: string; created_at: string }>;
  onClose: () => void;
  onCreate: (t: Thread) => void;
}) {
  const [title, setTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [proposal, setProposal] = useState("");
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: () =>
      createThread({
        data: {
          title: title.trim() || "Untitled conversation",
          job_description: jobDesc,
          sent_proposal: proposal,
        },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      onCreate(row as Thread);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <CropCard className="w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Eyebrow>New conversation</Eyebrow>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <Label className="annotation !text-muted-foreground">Conversation name</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. React dashboard client"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Load from proposal */}
        {proposals.length > 0 && (
          <div>
            <Label className="annotation !text-muted-foreground">Load from proposal history <span className="text-[10px] text-muted-foreground/60">(auto-fills below)</span></Label>
            <select
              defaultValue=""
              onChange={(e) => {
                const p = proposals.find((x) => x.id === e.target.value);
                if (!p) return;
                if (p.job_description) setJobDesc(p.job_description);
                if (p.content) setProposal(p.content);
                if (!title && p.title) setTitle(p.title);
                e.target.value = "";
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>Select a saved proposal…</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || "Untitled"} — {new Date(p.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label className="annotation !text-muted-foreground">Job description <span className="text-[10px] text-muted-foreground/60">(optional)</span></Label>
          <Textarea
            value={jobDesc}
            onChange={(e) => setJobDesc(e.target.value)}
            rows={3}
            placeholder="Paste the original job post…"
            className="mt-1.5 resize-y bg-background/60 text-sm"
          />
        </div>

        <div>
          <Label className="annotation !text-muted-foreground">Your sent proposal <span className="text-[10px] text-muted-foreground/60">(optional)</span></Label>
          <Textarea
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            rows={3}
            placeholder="Paste the proposal you already sent…"
            className="mt-1.5 resize-y bg-background/60 text-sm"
          />
        </div>

        <Button
          className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
          disabled={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Start conversation"}
        </Button>
      </CropCard>
    </div>
  );
}

// ── Chat thread view ─────────────────────────────────────────────────────────

function ThreadView({ thread, onThreadUpdate }: { thread: Thread; onThreadUpdate: (t: Thread) => void }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [clientInput, setClientInput] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [replyLanguage, setReplyLanguage] = useState("English");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(thread.title);
  const [pendingAdvance, setPendingAdvance] = useState(false);

  const messagesQ = useQuery({
    queryKey: ["messages", thread.id],
    queryFn: () => listMessages({ data: { threadId: thread.id } }),
  });
  const messages = (messagesQ.data ?? []) as Message[];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, result]);

  const saveContextDump = useMutation({
    mutationFn: (contextDump: string) =>
      updateThread({ data: { id: thread.id, context_dump: contextDump } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      onThreadUpdate({ ...thread, context_dump: (row as any)?.context_dump ?? thread.context_dump });
    },
  });

  const advanceStage = useMutation({
    mutationFn: () =>
      updateThread({ data: { id: thread.id, stage: Math.min(thread.stage + 1, 4) } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      const updated = { ...thread, stage: Math.min(thread.stage + 1, 4), ...((row as any) ?? {}) };
      onThreadUpdate(updated);
      setPendingAdvance(false);
      toast.success(`Advanced to Stage ${updated.stage}: ${STAGE_LABELS[updated.stage - 1]}`);
    },
  });

  const generate = useMutation({
    mutationFn: () =>
      generateConversionResponses({
        data: {
          clientMessage: clientInput,
          jobDescription: thread.job_description || undefined,
          sentProposal: thread.sent_proposal || undefined,
          replyLanguage: replyLanguage !== "English" ? replyLanguage : undefined,
          chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          stage: thread.stage,
          contextDump: thread.context_dump || undefined,
          currentExtracted: thread.extracted ?? undefined,
        },
      }),
    onSuccess: async (data) => {
      if (!data) return;
      await addMessage({ data: { threadId: thread.id, role: "client", content: clientInput } });
      qc.invalidateQueries({ queryKey: ["messages", thread.id] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      setResult(data);
      // Merge extracted intel
      if (data.stageAssessment?.extracted) {
        const merged = mergeExtracted(thread.extracted, data.stageAssessment.extracted);
        await updateThread({ data: { id: thread.id, extracted: merged } });
        qc.invalidateQueries({ queryKey: ["threads"] });
        onThreadUpdate({ ...thread, extracted: merged });
      }
      if (data.stageAssessment?.canAdvance && thread.stage < 4) {
        setPendingAdvance(true);
      }
    },
    onError: (e: Error) => toast.error(e.message || "Could not generate"),
  });

  const sendReply = useMutation({
    mutationFn: (content: string) =>
      addMessage({ data: { threadId: thread.id, role: "you", content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", thread.id] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      setResult(null);
      setClientInput("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMsg = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", thread.id] });
      if (result) { setResult(null); setClientInput(""); }
    },
  });

  const saveTitle = useMutation({
    mutationFn: () => updateThread({ data: { id: thread.id, title: titleDraft.trim() || thread.title } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setEditingTitle(false);
    },
  });

  const LANGUAGES = ["English","French","Spanish","Portuguese","Arabic","German","Italian","Dutch","Russian","Chinese","Japanese","Korean"];

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        {editingTitle ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle.mutate(); if (e.key === "Escape") setEditingTitle(false); }}
              className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveTitle.mutate()}>
              <Check className="h-3.5 w-3.5 text-gold" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingTitle(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            className="flex-1 text-left text-sm font-semibold text-white hover:text-gold transition-colors truncate"
            onClick={() => { setTitleDraft(thread.title); setEditingTitle(true); }}
          >
            {thread.title}
            <Pencil className="ml-2 inline h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <select
          value={replyLanguage}
          onChange={(e) => setReplyLanguage(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
        >
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Stage bar */}
      <StageBar
        stage={thread.stage ?? 1}
        canAdvance={pendingAdvance}
        onAdvance={() => advanceStage.mutate()}
      />

      {/* Deep learning panel */}
      <DeepLearningPanel
        contextDump={thread.context_dump ?? ""}
        onSave={(v) => saveContextDump.mutate(v)}
      />

      {/* Extracted intel */}
      <ExtractedPanel extracted={thread.extracted ?? {}} />

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {messagesQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No messages yet. Paste the client's first message below.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "group relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "client"
                  ? "bg-sidebar/80 text-foreground/90 mr-auto rounded-tl-sm"
                  : "bg-gold/15 border border-gold/30 text-foreground ml-auto rounded-tr-sm",
              )}
            >
              <p className={cn("text-[10px] font-mono mb-1.5", msg.role === "client" ? "text-muted-foreground" : "text-gold")}>
                {msg.role === "client" ? "CLIENT" : "YOU"}
              </p>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <button
                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center"
                onClick={() => removeMsg.mutate(msg.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}

        {/* AI result panel */}
        {result && (
          <div className="space-y-3 mt-2">
            {/* Stage assessment badge */}
            {result.stageAssessment && (
              <div className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px]",
                result.stageAssessment.canAdvance
                  ? "border-teal/30 bg-teal/8 text-teal"
                  : "border-line/30 bg-background/40 text-muted-foreground",
              )}>
                {result.stageAssessment.canAdvance
                  ? <Check className="h-3 w-3 shrink-0" />
                  : <AlertCircle className="h-3 w-3 shrink-0" />}
                <span>{result.stageAssessment.reason}</span>
              </div>
            )}

            {/* Best reply */}
            <div className="ml-auto max-w-[90%]">
              <CropCard className="p-4 border-gold/40 bg-gold/8">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-gold" />
                    <span className="text-[10px] font-bold text-gold uppercase tracking-wider">Best reply</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground hover:text-white text-[10px]"
                      onClick={async () => { await copyText(result.bestReply); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button size="sm" className="h-6 px-2 bg-gold text-primary-foreground hover:bg-gold-bright text-[10px]"
                      disabled={sendReply.isPending}
                      onClick={() => sendReply.mutate(result.bestReply)}>
                      {sendReply.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Use this</>}
                    </Button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">{result.bestReply}</p>
                {result.bestReplyReason && (
                  <p className="text-[10px] text-muted-foreground border-t border-line/40 pt-2 mt-2 italic">
                    {result.bestReplyReason}
                  </p>
                )}
              </CropCard>
            </div>

            {/* Alternatives */}
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground px-1 uppercase font-mono tracking-wider">Alternative angles</p>
              {result.alternatives.map((alt, i) => (
                <div key={i} className="ml-auto max-w-[90%]">
                  <CropCard className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("font-mono text-[10px] font-semibold", modeColors[alt.mode] ?? "text-muted-foreground")}>
                        {alt.mode}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground hover:text-white text-[10px]"
                          onClick={async () => { await copyText(alt.reply); toast.success("Copied"); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground hover:text-gold text-[10px]"
                          disabled={sendReply.isPending}
                          onClick={() => sendReply.mutate(alt.reply)}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{alt.reply}</p>
                  </CropCard>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                onClick={() => { setResult(null); setClientInput(""); setPendingAdvance(false); }}>
                <RotateCcw className="h-3 w-3 mr-1" /> Discard & retype
              </Button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!result && (
        <div className="mt-4 shrink-0 space-y-2">
          <Label className="annotation !text-muted-foreground">
            Paste client's message <span className="text-destructive text-[10px]">*</span>
          </Label>
          <Textarea
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            rows={3}
            placeholder="Paste exactly what the client sent you…"
            className="resize-y bg-background/60 leading-relaxed"
          />
          <Button
            className="w-full bg-gold text-primary-foreground hover:bg-gold-bright"
            disabled={generate.isPending || clientInput.trim().length < 5}
            onClick={() => generate.mutate()}
          >
            {generate.isPending
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating reply…</>
              : <><Zap className="mr-1.5 h-4 w-4" /> Generate reply — Stage {thread.stage}: {STAGE_LABELS[(thread.stage ?? 1) - 1]}</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function ConversionPage() {
  const qc = useQueryClient();
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [showNew, setShowNew] = useState(false);

  const threadsQ = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
  });
  const threads = (threadsQ.data ?? []) as Thread[];

  const proposalsQ = useQuery({
    queryKey: ["proposals"],
    queryFn: () => listProposals(),
  });
  const proposals = (proposalsQ.data ?? []) as Array<{ id: string; title?: string | null; job_description: string; content: string; created_at: string }>;

  const removeThread = useMutation({
    mutationFn: (id: string) => deleteThread({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (activeThread?.id === id) setActiveThread(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync active thread when list refreshes
  useEffect(() => {
    if (!activeThread) return;
    const refreshed = threads.find((t) => t.id === activeThread.id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(activeThread)) {
      setActiveThread(refreshed);
    }
  }, [threads]);

  return (
    <div>
      <PageHeader
        eyebrow="Follow-up"
        title="Conversion Messages"
        description="Maintain ongoing conversations with clients. 4-step system: understand → relate → convert → close."
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left: thread list */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <Eyebrow>Conversations</Eyebrow>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-gold/40 text-gold hover:bg-gold/10"
              onClick={() => setShowNew(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {threadsQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : threads.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No conversations yet"
                description="Click New to start your first thread."
              />
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
                    activeThread?.id === t.id
                      ? "bg-gold/15 border border-gold/30"
                      : "hover:bg-sidebar/60 border border-transparent",
                  )}
                  onClick={() => setActiveThread(t)}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", activeThread?.id === t.id ? "text-gold" : "text-white")}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1,2,3,4].map((s) => (
                          <div key={s} className={cn(
                            "h-1 w-3 rounded-full",
                            s <= (t.stage ?? 1) ? "bg-gold" : "bg-line/40",
                          )} />
                        ))}
                      </div>
                      <span className="text-[9px] text-muted-foreground">Stage {t.stage ?? 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={(e) => { e.stopPropagation(); removeThread.mutate(t.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-colors", activeThread?.id === t.id ? "text-gold" : "text-muted-foreground/40")} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: active thread */}
        <CropCard className="p-5 flex flex-col min-h-0 overflow-hidden">
          {activeThread ? (
            <ThreadView
              key={activeThread.id}
              thread={activeThread}
              onThreadUpdate={setActiveThread}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <MessagesSquare className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-white mb-1">Select a conversation</p>
                <p className="text-xs text-muted-foreground">or create a new one to start replying</p>
              </div>
              <Button
                variant="outline"
                className="border-gold/40 text-gold hover:bg-gold/10"
                onClick={() => setShowNew(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" /> New conversation
              </Button>
            </div>
          )}
        </CropCard>
      </div>

      {showNew && (
        <NewThreadPanel
          proposals={proposals}
          onClose={() => setShowNew(false)}
          onCreate={(t) => setActiveThread(t)}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mergeExtracted(
  current: Thread["extracted"],
  fresh: { deliverables?: string[]; painPoints?: string[]; scopeOfWork?: string; timeline?: string },
): Thread["extracted"] {
  const merged = { ...current };
  if (fresh.deliverables?.length) {
    merged.deliverables = [...new Set([...(merged.deliverables ?? []), ...fresh.deliverables])];
  }
  if (fresh.painPoints?.length) {
    merged.painPoints = [...new Set([...(merged.painPoints ?? []), ...fresh.painPoints])];
  }
  if (fresh.scopeOfWork) merged.scopeOfWork = fresh.scopeOfWork;
  if (fresh.timeline) merged.timeline = fresh.timeline;
  return merged;
}
