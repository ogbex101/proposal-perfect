import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceEditPromptProps {
  onApply: (instruction: string) => void;
  isPending: boolean;
}

export function VoiceEditPrompt({ onApply, isPending }: VoiceEditPromptProps) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimText("");
    clearTimers();
  }, [clearTimers]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input requires Chrome or Edge browser.");
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
        // Start auto-submit countdown after 2s of silence
        silenceTimerRef.current = setTimeout(() => {
          startCountdown();
          silenceTimerRef.current = setTimeout(() => {
            stopListening();
          }, 3200);
        }, 2000);
      } else {
        setInterimText(interim);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterimText("");
    };

    rec.onerror = () => {
      setListening(false);
      setInterimText("");
    };

    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setTranscript("");
    setInterimText("");
    clearTimers();
  }, [clearTimers, startCountdown, stopListening]);

  // Auto-apply when listening stops and we have a transcript
  useEffect(() => {
    if (!listening && transcript.trim().length >= 3 && !isPending) {
      clearTimers();
      onApply(transcript.trim());
      setTranscript("");
    }
  }, [listening]);  // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    stopListening();
    setOpen(false);
    setTranscript("");
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
            <span className="text-sm font-semibold text-white">Voice edit</span>
          </div>
          <button onClick={close} className="text-muted-foreground hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status */}
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
              {/* Waveform animation */}
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
            <p className="text-sm text-muted-foreground text-center">
              Tap the mic and speak your edit instruction
            </p>
          )}
        </div>

        {/* Hint */}
        {!listening && !isPending && (
          <p className="text-[10px] text-muted-foreground mb-3 text-center">
            e.g. "make the opening more confident" · "shorten the proposal by half" · "add urgency at the end"
          </p>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {listening ? (
            <button
              onClick={stopListening}
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
              onClick={() => setTranscript("")}
              className="px-3 rounded-xl border border-line/40 text-muted-foreground hover:text-white hover:border-line/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Orb trigger */}
      <button
        onClick={() => { if (listening) { stopListening(); } else { startListening(); } }}
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
