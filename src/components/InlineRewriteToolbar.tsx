import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { rewriteText } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

type Action = "rewrite" | "expand" | "shorten" | "formalize" | "soften";

const ACTIONS: { id: Action; label: string }[] = [
  { id: "rewrite", label: "Rewrite" },
  { id: "expand", label: "Expand" },
  { id: "shorten", label: "Shorten" },
  { id: "formalize", label: "More formal" },
  { id: "soften", label: "Softer" },
];

interface Props {
  /** Full proposal text (for surrounding context). */
  fullText: string;
  /** Called with the rewritten selection so the parent can splice it in. */
  onReplace: (selected: string, replacement: string) => void;
  /** When false, the toolbar is hidden. */
  enabled: boolean;
}

/**
 * Floating toolbar that appears on text selection inside an element with
 * data-rewrite-target="proposal". Clicking an action calls the AI rewrite
 * server fn and replaces the selected text via onReplace.
 */
export function InlineRewriteToolbar({ fullText, onReplace, enabled }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const justActioned = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    function onUp() {
      if (justActioned.current) { justActioned.current = false; return; }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPos(null); setSelected(""); return; }
      const text = sel.toString().trim();
      if (text.length < 8) { setPos(null); setSelected(""); return; }
      const node = sel.anchorNode;
      const target = (node?.nodeType === 1 ? (node as Element) : node?.parentElement)?.closest('[data-rewrite-target="proposal"]');
      if (!target) { setPos(null); setSelected(""); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelected(text);
      setPos({
        top: window.scrollY + rect.top - 44,
        left: window.scrollX + rect.left + rect.width / 2,
      });
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onUp);
    };
  }, [enabled]);

  async function run(action: Action) {
    if (!selected) return;
    setBusy(action);
    justActioned.current = true;
    try {
      const res = await rewriteText({ data: { text: selected, action, context: fullText } });
      if (res?.text) {
        onReplace(selected, res.text);
        toast.success(`${ACTIONS.find((a) => a.id === action)?.label} applied`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rewrite failed");
    } finally {
      setBusy(null);
      setPos(null);
      setSelected("");
      window.getSelection()?.removeAllRanges();
    }
  }

  if (!enabled || !pos) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 rounded-full border border-border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()} // don't blur selection
    >
      <div className="flex items-center gap-0.5">
        <span className="flex items-center gap-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-gold">
          <Sparkles className="h-2.5 w-2.5" /> AI
        </span>
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => run(a.id)}
            disabled={busy !== null}
            className={cn(
              "rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
              busy === a.id
                ? "bg-teal/20 text-teal"
                : "text-muted-foreground hover:bg-muted hover:text-white",
            )}
          >
            {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
