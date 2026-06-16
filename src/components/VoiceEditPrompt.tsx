import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Loader2, Sparkles, Send, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceEditPromptProps {
  onApply: (instruction: string) => void;
  isPending: boolean;
}

const HINT_COMMANDS = [
  "make the opening more confident",
  "shorten the proposal by 30%",
  "add urgency at the end",
  "rewrite the hook using curiosity",
  "make it sound more human and less salesy",
  "change the tone to be more direct",
  "add a specific question about their timeline",
  "remove all bullet points",
  "start fresh with a warning hook",
];

export function VoiceEditPrompt({ onApply, isPending }: VoiceEditPromptProps) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldRestartRef = useRef(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setAutoSubmitCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    clearTimers();
    setAutoSubmitCountdown(3);
    countdownRef.current = setInterval(() => {
      setAutoSubmitCountdown((n) => {
        if (n === null || n <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return null;
        }
        return n - 1;
      });
    }, 1000);
  }, [clearTimers]);

  const applyTranscript = useCallback((text: string) => {
    if (text.trim().length >= 3 && !isPending) {
      onApply(text.trim());
      setTranscript("");
      setTextInput("");
    }
  }, [isPending, onApply]);

  const stopListening = useCallback((andApply = false) => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimText("");
    clearTimers();
    if (andApply) {
      setTranscript((t) => {
        if (t.trim().length >= 3) applyTranscript(t);
        return t;
      });
    }
  }, [clearTimers, applyTranscript]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setTextMode(true);
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      clearTimers();
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text + " ";
        } else {
          interim += text;
        }
      }
      if (final) {
        setTranscript((prev) => (prev + " " + final).trim());
        setInterimText("");
        silenceTimerRef.current = setTimeout(() => {
          startCountdown();
          silenceTimerRef.current = setTimeout(() => {
            stopListening(true);
          }, 3200);
        }, 2000);
      } else {
        setInterimText(interim);
      }
    };

    rec.onend = () => {
      setInterimText("");
      // Auto-restart if user hasn't explicitly stopped — browser cuts off after ~60s
      if (shouldRestartRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // Can't restart — fall through to stopped state
        }
      }
      setListening(false);
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech" && shouldRestartRef.current) return; // will auto-restart via onend
      setListening(false);
      setInterimText("");
      clearTimers();
    };

    rec.start();
    recognitionRef.current = rec;
    shouldRestartRef.current = true;
    setListening(true);
    setTranscript("");
    setInterimText("");
    clearTimers();
  }, [clearTimers, startCountdown, stopListening]);

  // Rotate hint command every 4 seconds
  useEffect(() => {
    if (!open || listening || isPending) return;
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % HINT_COMMANDS.length), 4000);
    return () => clearInterval(timer);
  }, [open, listening, isPending]);

  // When listening stops and we have a transcript but user didn't manually apply
  useEffect(() => {
    if (!listening && transcript.trim().length >= 3 && !isPending && !shouldRestartRef.current) {
      clearTimers();
      applyTranscript(transcript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  function close() {
    stopListening();
    setOpen(false);
    setTranscript("");
    setTextInput("");
    setTextMode(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Voice edit prompt"
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-teal to-teal/70 shadow-lg shadow-teal/30",
          "transition-all duration-200 hover:scale-110 hover:shadow-teal/50 hover:shadow-xl",
          "ring-2 ring-teal/30",
        )}
      >
        <Mic className="h-6 w-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      <div className={cn(
        "w-80 rounded-2xl border border-teal/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-teal/20 p-5",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal" />
            <span className="text-sm font-semibold text-white">AI Edit</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setTextMode((v) => !v); setTimeout(() => textInputRef.current?.focus(), 50); }}
              title={textMode ? "Switch to voice" : "Switch to text"}
              className={cn("text-muted-foreground hover:text-white transition-colors", textMode && "text-teal")}
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <button onClick={close} className="text-muted-foreground hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Text input mode */}
        {textMode ? (
          <div className="space-y-3">
            <textarea
              ref={textInputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (textInput.trim().length >= 3) applyTranscript(textInput);
                }
              }}
              rows={3}
              placeholder='e.g. "make the opening more confident"'
              className="w-full resize-none rounded-xl border border-teal/20 bg-background/60 px-3 py-2.5 text-sm text-white placeholder-muted-foreground outline-none focus:border-teal/50"
            />
            <button
              onClick={() => applyTranscript(textInput)}
              disabled={isPending || textInput.trim().length < 3}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all",
                isPending || textInput.trim().length < 3
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-teal text-white hover:bg-teal/80",
              )}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isPending ? "Applying…" : "Apply edit (↵)"}
            </button>
          </div>
        ) : (
          <>
            {/* Voice status */}
            <div className={cn(
              "rounded-xl p-4 mb-4 min-h-[80px] flex flex-col justify-center",
              listening ? "bg-teal/10 border border-teal/30" : "bg-background/60 border border-line/40",
            )}>
              {isPending ? (
                <div className="flex items-center gap-2 text-teal">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Applying changes…</span>
                </div>
              ) : listening ? (
                <div>
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="rounded-full bg-teal"
                        style={{
                          width: "3px",
                          animation: `voice-wave 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                          height: `${8 + (i % 3) * 6}px`,
                        }}
                      />
                    ))}
                    <span className="ml-2 text-xs text-teal font-medium">Listening…</span>
                  </div>
                  {transcript && (
                    <p className="text-sm text-white leading-relaxed">{transcript}</p>
                  )}
                  {interimText && (
                    <p className="text-sm text-muted-foreground italic">{interimText}</p>
                  )}
                  {autoSubmitCountdown !== null && (
                    <p className="mt-2 text-[11px] text-teal/70">
                      Applying in {autoSubmitCountdown}s…
                    </p>
                  )}
                </div>
              ) : transcript ? (
                <p className="text-sm text-white leading-relaxed">"{transcript}"</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center transition-opacity duration-500">
                  e.g. "{HINT_COMMANDS[hintIndex]}"
                </p>
              )}
            </div>

            {/* Voice controls */}
            <div className="flex gap-2">
              {listening ? (
                <button
                  onClick={() => stopListening(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 py-3 text-sm font-medium hover:bg-red-500/30 transition-colors"
                >
                  <MicOff className="h-4 w-4" /> Stop & apply
                </button>
              ) : (
                <button
                  onClick={startListening}
                  disabled={isPending}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all",
                    isPending
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-teal text-white hover:bg-teal/80 shadow-lg shadow-teal/20 hover:shadow-teal/40",
                  )}
                >
                  <Mic className="h-4 w-4" />
                  {transcript ? "Speak again" : "Start speaking"}
                </button>
              )}
              {transcript && !listening && !isPending && (
                <button
                  onClick={() => { clearTimers(); applyTranscript(transcript); }}
                  className="px-3 rounded-xl bg-teal/10 border border-teal/30 text-teal hover:bg-teal/20 transition-colors"
                  title="Apply now"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Tap <span className="text-white">⌨</span> above to type instead
            </p>
          </>
        )}
      </div>

      {/* Orb trigger */}
      <button
        onClick={() => { if (listening) { stopListening(true); } else { startListening(); } }}
        disabled={isPending}
        className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200",
          listening
            ? "bg-red-500/90 ring-4 ring-red-500/40 shadow-xl shadow-red-500/30 scale-110"
            : "bg-gradient-to-br from-teal to-teal/70 ring-2 ring-teal/30 shadow-lg shadow-teal/30 hover:scale-110 hover:shadow-teal/50",
        )}
      >
        {listening
          ? <MicOff className="h-6 w-6 text-white" />
          : <Mic className="h-6 w-6 text-white" />}
        {listening && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-400 animate-pulse" />
        )}
      </button>

      <style>{`
        @keyframes voice-wave {
          from { transform: scaleY(0.4); opacity: 0.6; }
          to   { transform: scaleY(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
