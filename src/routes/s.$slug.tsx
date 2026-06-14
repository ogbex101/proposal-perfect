import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { StrategyDocumentView } from "@/components/StrategyDocument";
import type { StrategyDocument } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadElementAsPdf } from "@/lib/export";
import { toast } from "sonner";
import { getPublicStrategy } from "@/lib/strategy.functions";

export const Route = createFileRoute("/s/$slug")({
  component: StrategyShortPage,
});

function StrategyShortPage() {
  const { slug } = Route.useParams();
  const strategyRef = useRef<HTMLDivElement>(null);

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ["strategy", slug],
    queryFn: () => getPublicStrategy({ data: { slug } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Strategy not found or link has expired.</p>
      </div>
    );
  }

  const strategy = doc as StrategyDocument;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-gold uppercase tracking-widest mb-1">Xperience Props · Strategy Document</p>
            <h1 className="text-2xl font-bold text-white">{strategy.projectTitle}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!strategyRef.current) return;
              toast.loading("Generating PDF…", { id: "s-pdf" });
              downloadElementAsPdf(strategyRef.current, strategy.projectTitle)
                .then(() => toast.success("Downloaded", { id: "s-pdf" }))
                .catch(() => toast.error("Failed", { id: "s-pdf" }));
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
        </div>
        <div ref={strategyRef}>
          <StrategyDocumentView doc={strategy} />
        </div>
      </div>
    </div>
  );
}
