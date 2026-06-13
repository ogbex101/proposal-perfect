import type { StrategyDocument } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export function StrategyDocumentView({ doc }: { doc: StrategyDocument }) {
  return (
    <div className="strategy-doc rounded-2xl overflow-hidden border border-white/10 bg-[#060d12] shadow-2xl">
      {/* ── Section 1: Header ── */}
      <header className="relative overflow-hidden px-8 py-8 bg-gradient-to-br from-[#0d1f2d] via-[#091520] to-[#060d12] border-b border-white/10">
        {/* decorative grid lines */}
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: "linear-gradient(#0E7C8622 1px,transparent 1px),linear-gradient(90deg,#0E7C8622 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0E7C86] mb-2">Strategy Document</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white leading-tight mb-3">{doc.projectTitle}</h2>
            <p className="text-sm text-white/60 max-w-2xl leading-relaxed">{doc.overview}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#B98A2E]/40 bg-[#B98A2E]/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#B98A2E] animate-pulse" />
              <span className="font-mono text-xs text-[#B98A2E] font-semibold">{doc.totalDays} days</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-mono text-white/40 cursor-default select-none">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                <path d="M1 7.5V9h1.5l4.4-4.4-1.5-1.5L1 7.5zm7.1-4.1c.2-.2.2-.5 0-.7L7.3 1.9c-.2-.2-.5-.2-.7 0l-.9.9 1.5 1.5.9-.9z" fill="currentColor"/>
              </svg>
              Export
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-10">

        {/* ── Section 2: Phase Flow Diagram ── */}
        <section>
          <SectionHeader num="01" title="Phase Flow Diagram" />
          <div className="rounded-xl border border-white/10 bg-[#0a1820] p-4 overflow-x-auto">
            <svg viewBox="0 0 800 120" preserveAspectRatio="xMidYMid meet" className="w-full min-w-[480px]">
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#0E7C86" />
                </marker>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {doc.phases.map((p, i) => {
                const totalPhases = doc.phases.length;
                const boxW = 140;
                const gap = (800 - totalPhases * boxW) / (totalPhases + 1);
                const x = gap + i * (boxW + gap);
                const y = 10;
                return (
                  <g key={i}>
                    {i > 0 && (
                      <line
                        x1={gap + (i - 1) * (boxW + gap) + boxW}
                        y1={60}
                        x2={x}
                        y2={60}
                        stroke="#0E7C86"
                        strokeWidth="2"
                        markerEnd="url(#arrow)"
                      />
                    )}
                    <rect x={x} y={y} width={boxW} height={100} rx="8" fill="#0d1a21" stroke="#0E7C86" strokeWidth="1.5" />
                    <rect x={x} y={y} width={boxW} height={32} rx="8" fill="#0E7C8618" />
                    <text x={x + boxW / 2} y={y + 26} textAnchor="middle" fill="#B98A2E" fontFamily="monospace" fontSize="22" fontWeight="bold" filter="url(#glow)">
                      {String(p.phase).padStart(2, "0")}
                    </text>
                    <text x={x + boxW / 2} y={y + 52} textAnchor="middle" fill="white" fontFamily="sans-serif" fontSize="11" fontWeight="600">
                      {p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}
                    </text>
                    <text x={x + boxW / 2} y={y + 70} textAnchor="middle" fill="#0E7C86" fontFamily="monospace" fontSize="9">
                      {p.days}
                    </text>
                    <text x={x + boxW / 2} y={y + 90} textAnchor="middle" fill="#ffffff44" fontFamily="monospace" fontSize="8">
                      {p.deliverables.length} deliverable{p.deliverables.length !== 1 ? "s" : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* ── Section 3: Gantt Chart ── */}
        <section>
          <SectionHeader num="02" title="Timeline Gantt" />
          <div className="rounded-xl border border-white/10 bg-[#0a1820] p-5 space-y-3">
            {doc.phases.map((p, i) => {
              const match = p.days.match(/(\d+)/g);
              const start = match ? parseInt(match[0]) : 1;
              const end = match && match.length > 1 ? parseInt(match[match.length - 1]) : start + 2;
              const daysCount = end - start + 1;
              const pct = Math.max(8, Math.min(100, (daysCount / doc.totalDays) * 100));
              const offset = Math.min(80, ((start - 1) / doc.totalDays) * 100);
              const phaseColors = ["#0E7C86", "#B98A2E", "#6c3fc5", "#1a7a4a", "#c53f3f", "#c57a3f"];
              const color = phaseColors[i % phaseColors.length];
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-right font-mono text-[10px] text-white/40 truncate" title={p.name}>{p.name}</span>
                  <div className="flex-1 h-7 rounded bg-white/5 overflow-hidden relative">
                    <div
                      className="absolute top-0 h-full rounded flex items-center px-2 text-[10px] font-mono text-white/90 transition-all duration-500"
                      style={{
                        left: `${offset}%`,
                        width: `${pct}%`,
                        backgroundColor: color + "28",
                        border: `1px solid ${color}55`,
                        boxShadow: `inset 0 0 8px ${color}22`,
                      }}
                    >
                      <span style={{ color }}>{daysCount}d</span>
                    </div>
                  </div>
                  <span className="w-20 shrink-0 font-mono text-[10px] text-[#0E7C86]">{p.days}</span>
                </div>
              );
            })}
            {/* ruler */}
            <div className="flex items-center gap-3 mt-1">
              <span className="w-24 shrink-0" />
              <div className="flex-1 flex justify-between px-0">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="font-mono text-[8px] text-white/20">
                    {Math.round((doc.totalDays / 5) * i) + 1}d
                  </span>
                ))}
              </div>
              <span className="w-20 shrink-0" />
            </div>
          </div>
        </section>

        {/* ── Section 4: Phase Detail Cards ── */}
        <section>
          <SectionHeader num="03" title="Phase Details" />
          <div className="space-y-3">
            {doc.phases.map((p, i) => {
              const accentColors = ["#0E7C86", "#B98A2E", "#6c3fc5", "#1a7a4a", "#c53f3f", "#c57a3f"];
              const accent = accentColors[i % accentColors.length];
              return (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-[#0a1820] overflow-hidden"
                  style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-2xl font-bold" style={{ color: "#B98A2E" }}>
                        {String(p.phase).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-semibold text-white text-sm">{p.name}</p>
                        <p className="font-mono text-[10px]" style={{ color: accent }}>{p.days}</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">Deliverables</p>
                        <ul className="space-y-1.5">
                          {p.deliverables.map((d, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-white/60">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E7C86]" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {p.risks.length > 0 && (
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">Risk Factors</p>
                          <ul className="space-y-1.5">
                            {p.risks.map((r, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-white/60">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/70" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section 5: Feature Priority Matrix ── */}
        {doc.featureBreakdown.length > 0 && (
          <section>
            <SectionHeader num="04" title="Feature Priority Matrix" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {doc.featureBreakdown.map((f, i) => {
                const isMust = f.priority === "Must Have";
                const isShould = f.priority === "Should Have";
                const borderColor = isMust ? "#ef444466" : isShould ? "#B98A2E66" : "#0E7C8666";
                const bgColor = isMust ? "#ef444408" : isShould ? "#B98A2E08" : "#0E7C8608";
                const badgeColor = isMust ? "#ef4444" : isShould ? "#B98A2E" : "#0E7C86";
                return (
                  <div
                    key={i}
                    className="rounded-xl p-4 border flex flex-col gap-2"
                    style={{ borderColor, backgroundColor: bgColor }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-white text-sm leading-snug flex-1">{f.feature}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: badgeColor, backgroundColor: badgeColor + "22", border: `1px solid ${badgeColor}44` }}
                      >
                        {f.estimatedDays}d
                      </span>
                    </div>
                    <span
                      className="self-start rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest"
                      style={{ color: badgeColor, backgroundColor: badgeColor + "18", border: `1px solid ${badgeColor}33` }}
                    >
                      {f.priority}
                    </span>
                    {f.notes && <p className="text-[11px] text-white/40 leading-relaxed">{f.notes}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Section 6: Critical Path Stepper ── */}
        {doc.criticalPath.length > 0 && (
          <section>
            <SectionHeader num="05" title="Critical Path" />
            <div className="rounded-xl border border-white/10 bg-[#0a1820] p-5">
              <div className="relative">
                {/* vertical connector line */}
                <div className="absolute left-4 top-5 bottom-5 w-px bg-gradient-to-b from-[#0E7C86] via-[#0E7C8660] to-transparent" />
                <ol className="space-y-4 relative">
                  {doc.criticalPath.map((item, i) => (
                    <li key={i} className="flex items-start gap-4 pl-0">
                      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0E7C86]/60 bg-[#0d1a21] font-mono text-xs font-bold text-[#0E7C86] shadow-lg">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="text-sm text-white/70 leading-relaxed">{item}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}

        {/* ── Section 7: Success Metrics ── */}
        {doc.successMetrics.length > 0 && (
          <section>
            <SectionHeader num="06" title="Success Metrics" />
            <div className="grid sm:grid-cols-2 gap-2">
              {doc.successMetrics.map((m, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0a1820] px-4 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0E7C86]/20 border border-[#0E7C86]/40">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="#0E7C86" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="text-sm text-white/60 leading-snug">{m}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Section 8: Recommendation ── */}
        {doc.recommendation && (
          <section>
            <SectionHeader num="07" title="Strategic Recommendation" />
            <div className="relative rounded-xl border border-[#B98A2E]/20 bg-gradient-to-br from-[#B98A2E0a] to-[#B98A2E05] overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#B98A2E] via-[#B98A2E99] to-[#B98A2E33]" />
              <div className="px-7 py-6">
                <svg width="24" height="20" viewBox="0 0 24 20" fill="none" className="mb-3 opacity-40">
                  <path d="M0 20V12.5C0 9.167 .833 6.333 2.5 4 4.167 1.667 6.5.333 9.5 0l1.5 2C9 2.5 7.667 3.583 6.5 5S5 8 5 10h4v10H0zm14 0V12.5c0-3.333.833-6.167 2.5-8.5C18.167 1.667 20.5.333 23.5 0L25 2c-2 .5-3.333 1.583-4.5 3S19 8 19 10h4v10h-9z" fill="#B98A2E"/>
                </svg>
                <p className="text-base text-white/80 leading-relaxed italic font-light">{doc.recommendation}</p>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[10px] font-bold text-[#B98A2E] opacity-70">{num}</span>
      <div className="h-px w-6 bg-[#0E7C86]/50" />
      <h3 className="font-display text-xs font-semibold text-white/80 uppercase tracking-[0.14em]">{title}</h3>
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  );
}
