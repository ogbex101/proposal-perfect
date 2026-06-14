import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeech } from "@/hooks/use-speech";

export function MicButton({
  onTranscript,
  className,
}: {
  onTranscript: (text: string) => void;
  className?: string;
}) {
  const { isListening, toggle } = useSpeech(onTranscript);

  return (
    <button
      type="button"
      onClick={toggle}
      title={isListening ? "Stop recording (click to stop)" : "Voice input (click to speak)"}
      className={cn(
        "flex items-center justify-center rounded-full p-1.5 transition-all",
        isListening
          ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/40 animate-pulse"
          : "bg-background/60 text-muted-foreground hover:text-white hover:bg-white/10 border border-line/40",
        className,
      )}
    >
      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
}
