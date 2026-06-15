import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContestBriefView } from "./_authenticated/contest";
import type { ContestBrief } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadElementAsPdf } from "@/lib/export";
import { toast } from "sonner";
import { getPublicContest } from "@/lib/contest.functions";

export const Route = createFileRoute("/ct/$slug")({
  component: ContestPublicPage,
});

function ContestPublicPage() {
  const { slug } = Route.useParams();
  const briefRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => getPublicContest({ data: { slug } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Contest brief not found or link has expired.</p>
      </div>
    );
  }

  const brief = data.brief as ContestBrief;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-teal uppercase tracking-widest mb-1">Xperience Props · Contest Brief</p>
            <h1 className="text-2xl font-bold text-white">{data.title ?? brief.title}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!briefRef.current) return;
              toast.loading("Generating PDF…", { id: "ct-pdf" });
              downloadElementAsPdf(briefRef.current, brief.title)
                .then(() => toast.success("Downloaded", { id: "ct-pdf" }))
                .catch(() => toast.error("Failed", { id: "ct-pdf" }));
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
        </div>
        <div ref={briefRef}>
          <ContestBriefView brief={brief} />
        </div>
      </div>
    </div>
  );
}
