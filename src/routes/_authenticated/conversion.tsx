import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessagesSquare, Loader2, Copy, Trash2, Zap, Plus,
  ChevronRight, Send, RotateCcw, Check, Pencil, X,
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
};

const modeColors: Record<string, string> = {
  "Founder-to-Founder": "text-gold",
  "As a Friend": "text-teal",
  "Show Knowledge": "text-blue-400",
  "Strong Understanding": "text-purple-400",
  "Sharp & Brief": "text-red-400",
};

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

function ThreadView({ thread }: { thread: Thread }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [clientInput, setClientInput] = useState("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [chosenReply, setChosenReply] = useState<string | null>(null);
  const [replyLanguage, setReplyLanguage] = useState("English");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(thread.title);

  const messagesQ = useQuery({
    queryKey: ["messages", thread.id],
    queryFn: () => listMessages({ data: { threadId: thread.id } }),
  });
  const messages = (messagesQ.data ?? []) as Message[];

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, result]);

  const generate = useMutation({
    mutationFn: () =>
      generateConversionResponses({
        data: {
          clientMessage: clientInput,
          jobDescription: thread.job_description || undefined,
          sentProposal: thread.sent_proposal || undefined,
          replyLanguage: replyLanguage !== "English" ? replyLanguage : undefined,
          chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      }),
    onSuccess: async (data) => {
      if (!data) return;
      // Save the client message first
      await addMessage({ data: { threadId: thread.id, role: "client", content: clientInput } });
      qc.invalidateQueries({ queryKey: ["messages", thread.id] });
      qc.invalidateQueries({ queryKey: ["threads"] });
      setResult(data);
      setChosenReply(null);
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
      setChosenReply(null);
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
      <div className="flex items-center gap-2 mb-4 shrink-0">
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

        {/* AI result panel — shown after generation */}
        {result && (
          <div className="space-y-3 mt-2">
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
                onClick={() => { setResult(null); setClientInput(""); }}>
                <RotateCcw className="h-3 w-3 mr-1" /> Discard & retype
              </Button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area — only shown when no pending result */}
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
              : <><Zap className="mr-1.5 h-4 w-4" /> Generate reply</>}
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

  // Sync active thread when list refreshes (title updates etc.)
  useEffect(() => {
    if (!activeThread) return;
    const refreshed = threads.find((t) => t.id === activeThread.id);
    if (refreshed && refreshed.title !== activeThread.title) setActiveThread(refreshed);
  }, [threads]);

  return (
    <div>
      <PageHeader
        eyebrow="Follow-up"
        title="Conversion Messages"
        description="Maintain ongoing conversations with clients. Each thread keeps full history so every reply is grounded in context — and sounds entirely human."
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(t.updated_at).toLocaleDateString()}
                    </p>
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
            <ThreadView key={activeThread.id} thread={activeThread} />
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

      {/* New thread modal */}
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
