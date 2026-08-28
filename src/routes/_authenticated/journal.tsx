import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bug, Sparkles, Wrench, FileText, GitCommit } from "lucide-react";
import { PageHeader, CropCard } from "@/components/blueprint";
import { cn } from "@/lib/utils";
// BUILD_LOG.md is bundled at build time. Rebuild picks up new entries.
import buildLog from "../../../BUILD_LOG.md?raw";

export const Route = createFileRoute("/_authenticated/journal")({
  component: JournalPage,
});

type Entry = { date: string; title: string; category: "Bug Fixes" | "New Features" | "Refactors"; body: string };

// Split the chronological log (everything after "## Chronological Log") into entries.
function parseEntries(md: string): { overview: string; entries: Entry[] } {
  const logMarker = "## Chronological Log";
  const idx = md.indexOf(logMarker);
  const overview = idx >= 0 ? md.slice(0, idx) : md;
  const logPart = idx >= 0 ? md.slice(idx + logMarker.length) : "";

  const entries: Entry[] = [];
  // Entries start with "## <date> — <title>"
  const re = /^##\s+(.+)$/gm;
  const heads: { title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(logPart)) !== null) {
    heads.push({ title: m[1].trim(), start: m.index, end: logPart.length });
  }
  heads.forEach((h, i) => { if (i + 1 < heads.length) h.end = heads[i + 1].start; });

  for (const h of heads) {
    const body = logPart.slice(h.start, h.end).replace(/^##\s+.+$/m, "").trim();
    const dateMatch = h.title.match(/^([\d]{4}-[\d]{2}-[\d]{2})/);
    const date = dateMatch ? dateMatch[1] : "";
    const lower = (h.title + " " + body).toLowerCase();
    // Classify by dominant content.
    let category: Entry["category"] = "New Features";
    if (/refactor|rewrote|unify|cleanup|dead code|removed/.test(lower)) category = "Refactors";
    if (/fix|bug|guard|fabricat|broken|repair/.test(lower)) category = "Bug Fixes";
    entries.push({ date, title: h.title, category, body });
  }
  return { overview, entries };
}

const CATEGORY_META = {
  "Bug Fixes": { icon: Bug, color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" },
  "New Features": { icon: Sparkles, color: "text-teal", bg: "bg-teal/10 border-teal/30" },
  "Refactors": { icon: Wrench, color: "text-gold", bg: "bg-gold/10 border-gold/30" },
} as const;

// Minimal markdown → JSX for the entry bodies (headings, bold, lists, blockquotes).
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 ml-4 list-disc space-y-1 text-sm text-foreground/80">
          {list.map((li, i) => <li key={i}>{inline(li)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  function inline(s: string): React.ReactNode {
    // bold **x** and inline `code`
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
      if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-teal">{p.slice(1, -1)}</code>;
      return <span key={i}>{p}</span>;
    });
  }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*[-*]\s+/.test(line)) { list.push(line.replace(/^\s*[-*]\s+/, "")); continue; }
    flush();
    if (!line.trim()) continue;
    if (/^###\s+/.test(line)) out.push(<h4 key={out.length} className="mt-3 mb-1 text-sm font-semibold text-white">{inline(line.replace(/^###\s+/, ""))}</h4>);
    else if (/^>\s?/.test(line)) out.push(<blockquote key={out.length} className="my-2 border-l-2 border-teal/40 pl-3 text-sm italic text-muted-foreground">{inline(line.replace(/^>\s?/, ""))}</blockquote>);
    else out.push(<p key={out.length} className="my-1.5 text-sm leading-relaxed text-foreground/80">{inline(line)}</p>);
  }
  flush();
  return out;
}

function JournalPage() {
  const { overview, entries } = useMemo(() => parseEntries(buildLog), []);
  const counts = useMemo(() => {
    const c = { "Bug Fixes": 0, "New Features": 0, "Refactors": 0 } as Record<Entry["category"], number>;
    entries.forEach((e) => { c[e.category]++; });
    return c;
  }, [entries]);

  return (
    <div>
      <PageHeader
        eyebrow="Continuity"
        title="System Journal"
        description="The living build log for this project — architecture overview first, then every fix and feature. Read this first if you're picking the project up cold."
      />

      {/* Metrics header */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(Object.keys(CATEGORY_META) as Entry["category"][]).map((cat) => {
          const Meta = CATEGORY_META[cat];
          const Icon = Meta.icon;
          return (
            <CropCard key={cat} className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", Meta.color)} />
                <span className="text-xs text-muted-foreground">{cat}</span>
              </div>
              <p className={cn("mt-1 font-mono text-2xl font-bold", Meta.color)}>{counts[cat]}</p>
            </CropCard>
          );
        })}
        <CropCard className="p-4">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-white/70" />
            <span className="text-xs text-muted-foreground">Total entries</span>
          </div>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{entries.length}</p>
        </CropCard>
      </div>

      {/* Timeline (dot per entry) */}
      {entries.length > 0 && (
        <CropCard className="mb-6 p-4">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Timeline</p>
          <div className="flex flex-wrap items-center gap-2">
            {entries.slice().reverse().map((e, i) => {
              const Meta = CATEGORY_META[e.category];
              return (
                <div key={i} className="group relative flex items-center gap-1.5">
                  <span className={cn("h-3 w-3 rounded-full border", Meta.bg)} />
                  <span className="text-[11px] text-muted-foreground">{e.date || "—"}</span>
                  {i < entries.length - 1 && <span className="mx-1 h-px w-4 bg-white/10" />}
                </div>
              );
            })}
          </div>
        </CropCard>
      )}

      {/* Architecture overview */}
      <CropCard className="mb-6 p-6">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal" />
          <h2 className="text-sm font-semibold text-white">Architecture &amp; Overview</h2>
        </div>
        <div className="prose-none">{renderMarkdown(overview.replace(/^#\s+.+$/m, ""))}</div>
      </CropCard>

      {/* Entries */}
      <div className="space-y-4">
        {entries.map((e, i) => {
          const Meta = CATEGORY_META[e.category];
          const Icon = Meta.icon;
          return (
            <CropCard key={i} className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", Meta.bg, Meta.color)}>
                  <Icon className="h-3 w-3" /> {e.category}
                </span>
                <h3 className="text-sm font-semibold text-white">{e.title}</h3>
              </div>
              <div>{renderMarkdown(e.body)}</div>
            </CropCard>
          );
        })}
      </div>
    </div>
  );
}
