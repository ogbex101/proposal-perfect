import type { StrategyDocument } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export function StrategyDocumentView({ doc }: { doc: StrategyDocument }) {
  return (
    <div className="strategy-doc rounded-2xl border border-line/60 bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal/10 to-gold/5 border-b border-line/60 px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-teal mb-1">Strategy Document</p>
        <h2 className="font-display text-xl font-bold text-white">{doc.projectTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{doc.overview}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          <span className="font-mono text-xs text-gold">{doc.totalDays} working days estimated</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Phase Timeline Table */}
        <section>
          <SectionHeader num="01" title="Project Phases & Timeline" />
          <div className="overflow-x-auto rounded-xl border border-line/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 bg-sidebar/50">
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-8">#</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Phase</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Timeline</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Deliverables</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Risk Factors</th>
                </tr>
              </thead>
              <tbody>
                {doc.phases.map((p, i) => (
                  <tr key={i} className="border-b border-line/40 last:border-0 hover:bg-sidebar/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gold">{String(p.phase).padStart(2, "0")}</td>
                    <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-teal whitespace-nowrap">{p.days}</td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {p.deliverables.map((d, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-teal/60" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {p.risks.map((r, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-destructive/60" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Feature Breakdown Table */}
        {doc.featureBreakdown.length > 0 && (
          <section>
            <SectionHeader num="02" title="Feature Breakdown" />
            <div className="overflow-x-auto rounded-xl border border-line/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line/60 bg-sidebar/50">
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Feature</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">Est. Days</th>
                    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.featureBreakdown.map((f, i) => (
                    <tr key={i} className="border-b border-line/40 last:border-0 hover:bg-sidebar/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{f.feature}</td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={f.priority} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-center text-muted-foreground">{f.estimatedDays}d</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{f.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Critical Path + Success Metrics side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          {doc.criticalPath.length > 0 && (
            <section className="rounded-xl border border-line/60 p-4">
              <SectionHeader num="03" title="Critical Path" />
              <ol className="space-y-2">
                {doc.criticalPath.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-mono text-[10px] text-gold">{i + 1}</span>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {doc.successMetrics.length > 0 && (
            <section className="rounded-xl border border-line/60 p-4">
              <SectionHeader num="04" title="Success Metrics" />
              <ul className="space-y-2">
                {doc.successMetrics.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Recommendation */}
        {doc.recommendation && (
          <section className="rounded-xl border border-gold/20 bg-gold/5 p-4">
            <SectionHeader num="05" title="Strategic Recommendation" />
            <p className="text-sm text-foreground/80">{doc.recommendation}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="font-mono text-[10px] text-gold">{num}</span>
      <span className="h-px flex-1 max-w-[24px] bg-teal/40" />
      <h3 className="font-display text-sm font-semibold text-white uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
      priority === "Must Have" && "bg-destructive/10 text-destructive border border-destructive/20",
      priority === "Should Have" && "bg-gold/10 text-gold border border-gold/20",
      priority === "Nice to Have" && "bg-teal/10 text-teal border border-teal/20",
    )}>
      {priority}
    </span>
  );
}
