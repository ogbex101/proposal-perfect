import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { StrategyDocumentView } from "@/components/StrategyDocument";
import type { StrategyDocument } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadElementAsPdf } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/strategy")({
  validateSearch: (search: Record<string, unknown>) => ({
    d: (search.d as string) ?? "",
  }),
  component: StrategyPage,
});

function StrategyPage() {
  const { d } = Route.useSearch();
  const strategyRef = useRef<HTMLDivElement>(null);

  const doc = useMemo<StrategyDocument | null>(() => {
    if (!d) return null;
    try {
      return JSON.parse(atob(d));
    } catch {
      return null;
    }
  }, [d]);

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Invalid or missing strategy link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-gold uppercase tracking-widest mb-1">Xperience Props · Strategy Document</p>
            <h1 className="text-2xl font-bold text-white">{doc.projectTitle}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!strategyRef.current) return;
              toast.loading("Generating PDF…", { id: "s-pdf" });
              downloadElementAsPdf(strategyRef.current, doc.projectTitle)
                .then(() => toast.success("Downloaded", { id: "s-pdf" }))
                .catch(() => toast.error("Failed", { id: "s-pdf" }));
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
        </div>
        <div ref={strategyRef}>
          <StrategyDocumentView doc={doc} />
        </div>
      </div>
    </div>
  );
}
