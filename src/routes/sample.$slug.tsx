import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { getPublicPortfolioSamples, type PortfolioSamplesDoc, type SampleItem } from "@/lib/portfolio-samples.functions";

// @ts-expect-error — route registered at runtime via TanStack Router file-based routing
export const Route = createFileRoute("/sample/$slug")({
  component: SamplesPage,
});

function SamplesPage() {
  const { slug } = Route.useParams();
  const query = useQuery({
    queryKey: ["portfolio-samples", slug],
    queryFn: () => getPublicPortfolioSamples({ data: { slug } }),
    retry: 1,
  });

  if (query.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
          <p className="text-sm text-white/60">Loading portfolio samples…</p>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A] px-4">
        <div className="max-w-md text-center">
          <p className="text-4xl font-bold text-white">404</p>
          <p className="mt-3 text-white/60">These portfolio samples were not found or may have been removed.</p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-[#C9A84C] px-6 py-2.5 text-sm font-medium text-black">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return <SamplesView doc={query.data} slug={slug} />;
}

function SamplesView({ doc, slug }: { doc: PortfolioSamplesDoc; slug: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.href : `/sample/${slug}`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-[#0A0F1A]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0C1322]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <Link to="/" className="text-lg font-bold text-white hover:text-[#C9A84C] transition-colors">
              Xperience Props
            </Link>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink ? "Copied!" : "Copy link"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-5 pt-12 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-3 py-1 text-xs font-medium text-[#C9A84C] uppercase tracking-wider">
            {doc.category}
          </span>
          <span className="text-xs text-white/40">Portfolio Samples</span>
        </div>

        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          {doc.category} Portfolio
        </h1>
        <p className="mt-2 text-white/60">
          By <span className="text-white font-medium">{doc.freelancerName}</span>
          {" · "}
          {fmtDate(doc.generatedAt)}
        </p>

        {doc.jobExcerpt && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60 leading-relaxed max-w-2xl">
            <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
              Tailored for:
            </span>{" "}
            {doc.jobExcerpt.slice(0, 150)}{doc.jobExcerpt.length > 150 ? "…" : ""}
          </div>
        )}

        {/* Share strip */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 rounded-full bg-[#C9A84C] px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#E4C76B]"
          >
            {copiedLink ? <Check className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            {copiedLink ? "Link copied!" : "Share this portfolio"}
          </button>
          <span className="font-mono text-xs text-white/30 break-all">{shareUrl}</span>
        </div>
      </div>

      {/* Samples */}
      <div className="mx-auto max-w-4xl px-5 pb-16 space-y-8">
        {doc.samples.map((sample, i) => (
          <SampleCard key={i} sample={sample} index={i} />
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center">
        <p className="text-xs text-white/30">
          Generated by{" "}
          <a href="/" className="text-[#C9A84C] hover:underline">Xperience Props</a>
          {" · "}AI-powered freelance proposal engine
        </p>
      </footer>
    </div>
  );
}

function SampleCard({ sample, index }: { sample: SampleItem; index: number }) {
  const [copied, setCopied] = useState(false);

  function copyContent() {
    navigator.clipboard.writeText(sample.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/50">
              {index + 1}
            </span>
            <span className="text-xs font-mono text-[#36C2D6] uppercase tracking-wider">{sample.format}</span>
            {sample.brandRef && (
              <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                {sample.brandRef}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-white">{sample.title}</h2>
          {sample.subtitle && <p className="text-sm text-white/50 mt-0.5">{sample.subtitle}</p>}
        </div>
        <button
          onClick={copyContent}
          className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        <div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed whitespace-pre-wrap">
          {sample.content}
        </div>
      </div>
    </div>
  );
}
