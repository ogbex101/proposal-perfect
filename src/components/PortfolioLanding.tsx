import { useEffect, useRef } from "react";
import type { PortfolioData } from "@/lib/portfolio-types";

/**
 * Self-contained, responsive portfolio landing page. Styling is scoped to
 * `.pf-root` so it renders identically inside the app preview and on the
 * public /p/<slug> route, independent of the app's dark theme.
 *
 * Visual language is intentionally distinct from the app's dashboard: an
 * editorial, magazine-style dark canvas with a serif display face, glowing
 * accent orbs, grain texture, alternating section depth and a bento layout.
 */
export function PortfolioLanding({ data }: { data: PortfolioData }) {
  const { hero, contact } = data;
  const rootRef = useRef<HTMLDivElement>(null);

  const initials = (hero.name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const waLink = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp.replace(/[^\d]/g, "")}`
    : null;

  // Scroll-triggered staggered reveals
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const els = root.querySelectorAll<HTMLElement>(".pf-animate");
    if (reduce) {
      els.forEach((el) => el.classList.add("pf-visible"));
      return;
    }
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("pf-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Sticky nav solidify + back-to-top visibility + hero parallax
  useEffect(() => {
    const root = rootRef.current;
    const nav = root?.querySelector<HTMLElement>(".pf-nav");
    const top = root?.querySelector<HTMLElement>(".pf-totop");
    const orbs = root?.querySelectorAll<HTMLElement>(".pf-orb");
    const photo = root?.querySelector<HTMLElement>(".pf-photo-outer");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      nav?.classList.toggle("pf-nav-solid", y > 60);
      top?.classList.toggle("pf-totop-on", y > 600);
      if (!reduce) {
        orbs?.forEach((o, i) => {
          const speed = (i + 1) * 0.04;
          o.style.transform = `translate3d(0, ${y * speed}px, 0)`;
        });
        if (photo && y < 900) photo.style.transform = `translate3d(0, ${y * 0.06}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Magnetic hover for buttons + cards
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const targets = root.querySelectorAll<HTMLElement>(".pf-mag");
    const onMove = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      el.style.setProperty("--mx", `${mx * 0.18}px`);
      el.style.setProperty("--my", `${my * 0.18}px`);
    };
    const onLeave = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };
    targets.forEach((t) => {
      t.addEventListener("pointermove", onMove as EventListener);
      t.addEventListener("pointerleave", onLeave as EventListener);
    });
    return () =>
      targets.forEach((t) => {
        t.removeEventListener("pointermove", onMove as EventListener);
        t.removeEventListener("pointerleave", onLeave as EventListener);
      });
  }, []);

  let sectionCount = 0;
  const label = (name: string, light = false) => {
    sectionCount += 1;
    const n = String(sectionCount).padStart(2, "0");
    return (
      <div className={`pf-eyebrow${light ? " pf-eyebrow-light" : ""}`}>
        <span className="pf-eyebrow-num">{n}</span>
        <span className="pf-eyebrow-rule" />
        <span>{name}</span>
      </div>
    );
  };

  const heading = (text: string) => (
    <h2 className="pf-h2">
      {text}
      <span className="pf-h2-line" aria-hidden="true" />
    </h2>
  );

  const avatarColors = [
    "linear-gradient(135deg,#0E7C86,#0a1a1f)",
    "linear-gradient(135deg,#B98A2E,#5c3d00)",
    "linear-gradient(135deg,#6c3fc5,#0f1e2e)",
    "linear-gradient(135deg,#1a7a4a,#0a1a1f)",
  ];

  // Build a marquee string from skills (fallback to brands) for the scrolling strip
  const marqueeItems = (data.skills.length ? data.skills : data.brands).slice(0, 14);
  const featured = data.projects[0];
  const restProjects = data.projects.slice(1);

  return (
    <div className="pf-root" ref={rootRef}>
      <style>{PF_CSS}</style>

      {/* ── Sticky Nav ──────────────────────────────────────── */}
      <nav className="pf-nav">
        <div className="pf-nav-inner">
          <a href="#top" className="pf-nav-name">{hero.name}</a>
          <div className="pf-nav-links">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="pf-hero" id="top">
        {/* Niche-specific hero background */}
        {hero.heroImageUrl && (
          <div
            className="pf-hero-img-bg"
            style={{ backgroundImage: `url(${hero.heroImageUrl})` }}
            aria-hidden="true"
          />
        )}
        {/* Glowing accent orbs + grain */}
        <div className="pf-orb pf-orb-a" aria-hidden="true" />
        <div className="pf-orb pf-orb-b" aria-hidden="true" />
        <div className="pf-orb pf-orb-c" aria-hidden="true" />
        <div className="pf-grain" aria-hidden="true" />
        <div className="pf-hero-bg-code" aria-hidden="true">
          {`{ "available": true, "quality": "premium", "response": "< 24h" }`}
        </div>

        <div className="pf-hero-grid">
          <div className="pf-hero-copy">
            <div className="pf-avail-badge pf-stagger" style={{ "--d": "0.05s" } as React.CSSProperties}>
              <span className="pf-avail-dot" />
              Available for projects
            </div>
            <div className="pf-niche-wrap pf-stagger" style={{ "--d": "0.12s" } as React.CSSProperties}>
              <span className="pf-niche">{hero.niche}</span>
              <span className="pf-cursor" aria-hidden="true" />
            </div>
            <h1 className="pf-name pf-stagger" style={{ "--d": "0.2s" } as React.CSSProperties}>
              <span className="pf-name-grad">{hero.name}</span>
            </h1>
            <p className="pf-tagline pf-stagger" style={{ "--d": "0.3s" } as React.CSSProperties}>
              {hero.tagline}
            </p>

            <div className="pf-stats pf-stagger" style={{ "--d": "0.4s" } as React.CSSProperties}>
              <div className="pf-stat">
                <span className="pf-stat-num">5+</span>
                <span className="pf-stat-label">Years Exp.</span>
              </div>
              <div className="pf-stat-divider" />
              <div className="pf-stat">
                <span className="pf-stat-num">50+</span>
                <span className="pf-stat-label">Projects</span>
              </div>
              <div className="pf-stat-divider" />
              <div className="pf-stat">
                <span className="pf-stat-num">100%</span>
                <span className="pf-stat-label">Satisfaction</span>
              </div>
            </div>

            <div className="pf-hero-cta pf-stagger" style={{ "--d": "0.5s" } as React.CSSProperties}>
              {contact.email && (
                <a className="pf-btn pf-btn-primary pf-mag" href={`mailto:${contact.email}`}>
                  <span className="pf-mag-inner">Start a Conversation</span>
                </a>
              )}
              <a className="pf-btn pf-btn-ghost pf-mag" href="#work">
                <span className="pf-mag-inner">See My Work ↓</span>
              </a>
            </div>
          </div>

          <div className="pf-hero-photo pf-stagger" style={{ "--d": "0.34s" } as React.CSSProperties}>
            <div className="pf-photo-outer">
              <div className="pf-photo-ring" aria-hidden="true" />
              <div className="pf-photo-frame">
                {hero.avatarUrl ? (
                  <img src={hero.avatarUrl} alt={hero.name} loading="eager" />
                ) : (
                  <span className="pf-monogram">{initials}</span>
                )}
              </div>
              <div className="pf-photo-glow" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="pf-scroll-cue" aria-hidden="true">
          <span className="pf-scroll-arrow">↓</span>
        </div>
      </header>

      {/* ── Marquee strip ────────────────────────────────────── */}
      {marqueeItems.length > 0 && (
        <div className="pf-marquee" aria-hidden="true">
          <div className="pf-marquee-track">
            {[0, 1].map((dup) => (
              <div className="pf-marquee-group" key={dup}>
                {marqueeItems.map((m, i) => (
                  <span className="pf-marquee-item" key={`${dup}-${i}`}>
                    <span className="pf-marquee-star">✦</span>
                    {m}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="pf-main">
        {/* ── About the client + My Story (lifted band) ─────── */}
        {(data.aboutClient || data.myStory) && (
          <div className="pf-band">
            <div className="pf-band-inner">
              {data.aboutClient && (
                <section className="pf-section pf-animate" id="about">
                  {label("Where you are")}
                  <p className="pf-lead">{data.aboutClient}</p>
                </section>
              )}
              {data.myStory && (
                <section className="pf-section pf-animate">
                  {label("My story")}
                  {heading("A bit about me")}
                  <p className="pf-body">{data.myStory}</p>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── What I Do — bento layout ──────────────────────── */}
        {data.whatIDo.length > 0 && (
          <section className="pf-section">
            {label("What I do")}
            {heading("How I can help")}
            <div className="pf-do-grid">
              {data.whatIDo.map((d, i) => (
                <div
                  key={i}
                  className={`pf-do-card pf-animate${i === 0 ? " pf-do-feature" : ""}`}
                  style={{ transitionDelay: `${i * 0.08}s` }}
                >
                  <div className="pf-do-num">0{i + 1}</div>
                  <h3>{d.title}</h3>
                  <p>{d.description}</p>
                  <span className="pf-do-arrow" aria-hidden="true">→</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Selected Work — feature + grid ────────────────── */}
        {data.projects.length > 0 && (
          <section className="pf-section" id="work">
            {label("Selected work")}
            {heading("Selected work")}

            {featured && (
              <article className="pf-feature pf-animate">
                <div className="pf-feature-img">
                  <img src={featured.imageUrl} alt={featured.title} loading="lazy" />
                </div>
                <div className="pf-feature-body">
                  <span className="pf-feature-kicker">Featured project</span>
                  <h3>{featured.title}</h3>
                  <p>{featured.description}</p>
                  <div className="pf-feature-tags">
                    {featured.tags.map((t, j) => (
                      <span key={j} className="pf-tag">{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            )}

            {restProjects.length > 0 && (
              <div className="pf-work-grid">
                {restProjects.map((p, i) => (
                  <article
                    key={i}
                    className="pf-work-card pf-animate"
                    style={{ transitionDelay: `${i * 0.08}s` }}
                  >
                    <div className="pf-work-img-wrap">
                      <img src={p.imageUrl} alt={p.title} loading="lazy" className="pf-work-img" />
                      <div className="pf-work-overlay">
                        <div className="pf-overlay-tags">
                          {p.tags.map((t, j) => (
                            <span key={j} className="pf-overlay-tag">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="pf-work-body">
                      <h3>{p.title}</h3>
                      <p>{p.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Skills ────────────────────────────────────────── */}
        {data.skills.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Skills & tools")}
            {heading("Tools of the trade")}
            <div className="pf-chips">
              {data.skills.map((s, i) => (
                <span key={i} className="pf-chip">{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Credentials ───────────────────────────────────── */}
        {data.credentials.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Credentials")}
            {heading("Background")}
            <ul className="pf-creds">
              {data.credentials.map((c, i) => (
                <li key={i}>
                  <span className="pf-cred-title">{c.title}</span>
                  <span className="pf-cred-meta">
                    {[c.institution, c.year].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Client Feedback (lifted band) ─────────────────── */}
        {data.testimonials.length > 0 && (
          <div className="pf-band">
            <div className="pf-band-inner">
              <section className="pf-section">
                {label("Client feedback")}
                {heading("Kind words")}
                <div className="pf-quotes">
                  {data.testimonials.map((t, i) => {
                    const bg = avatarColors[i % avatarColors.length];
                    const tInitials = t.author
                      .split(" ")
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <figure
                        key={i}
                        className="pf-quote pf-animate"
                        style={{ transitionDelay: `${i * 0.1}s` }}
                      >
                        <div className="pf-quote-bg-mark" aria-hidden="true">"</div>
                        <div className="pf-stars" aria-label="5 stars">
                          {"★★★★★".split("").map((s, j) => <span key={j}>{s}</span>)}
                        </div>
                        <blockquote>"{t.quote}"</blockquote>
                        <figcaption>
                          <div className="pf-avatar" style={{ background: bg }}>{tInitials}</div>
                          <div className="pf-author-info">
                            <strong>{t.author}</strong>
                            <span>{t.role}</span>
                            <span className="pf-verified">✓ Verified client</span>
                          </div>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── FAQ ───────────────────────────────────────────── */}
        {data.faqs.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Questions, answered")}
            {heading("Frequently asked")}
            <div className="pf-faqs">
              {data.faqs.map((f, i) => (
                <details key={i} className="pf-faq">
                  <summary>
                    <span>{f.question}</span>
                    <span className="pf-faq-icon" aria-hidden="true">+</span>
                  </summary>
                  <div className="pf-faq-body">
                    <p>{f.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ── Brands ────────────────────────────────────────── */}
        {data.brands.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Brands I've worked with")}
            {heading("Trusted by")}
            <div className="pf-brands">
              {data.brands.map((b, i) => (
                <div key={i} className="pf-brand" style={{ "--brand-idx": i } as React.CSSProperties}>
                  {b}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer CTA ───────────────────────────────────────── */}
      <footer className="pf-footer" id="contact">
        <div className="pf-orb pf-orb-foot" aria-hidden="true" />
        <div className="pf-grain" aria-hidden="true" />
        <div className="pf-footer-inner pf-animate">
          <div className="pf-footer-eyebrow">
            <span className="pf-eyebrow pf-eyebrow-light">
              <span className="pf-eyebrow-rule" />
              <span>Get in touch</span>
            </span>
          </div>
          <h2 className="pf-footer-headline">
            Let's build something <span className="pf-name-grad">great</span>
          </h2>
          <p className="pf-footer-sub">
            I typically respond within 24 hours. Let's discuss your project and make it happen.
          </p>
          <div className="pf-footer-ctas">
            {contact.email && (
              <a className="pf-btn pf-btn-gold pf-mag" href={`mailto:${contact.email}`}>
                <span className="pf-mag-inner">✉ {contact.email}</span>
              </a>
            )}
            {waLink && (
              <a className="pf-btn pf-btn-wa pf-mag" href={waLink} target="_blank" rel="noreferrer">
                <span className="pf-mag-inner">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </span>
              </a>
            )}
            {contact.phone && (
              <a className="pf-btn pf-btn-ghost-light pf-mag" href={`tel:${contact.phone}`}>
                <span className="pf-mag-inner">📞 {contact.phone}</span>
              </a>
            )}
          </div>
          <div className="pf-footer-divider" />
          <p className="pf-credit">{hero.name} · {hero.niche}</p>
        </div>
      </footer>

      {/* ── Back to top ──────────────────────────────────────── */}
      <a href="#top" className="pf-totop" aria-label="Back to top">↑</a>
    </div>
  );
}

const PF_CSS = `
/* ── Reset & Tokens ──────────────────────────────────────────────────── */
.pf-root {
  --bg:        #050810;
  --bg-deep:   #03060d;
  --bg-lift:   #0a1020;
  --ink:       #F4F2EC;
  --ink-soft:  rgba(244,242,236,0.62);
  --ink-faint: rgba(244,242,236,0.38);
  --teal:      #2BD6C6;
  --teal-dim:  #15A99B;
  --gold:      #E0B24C;
  --gold-dim:  #C9962E;
  --violet:    #8B6CF0;
  --line:      rgba(244,242,236,0.10);
  --line-soft: rgba(244,242,236,0.06);
  --card:      rgba(255,255,255,0.035);
  --card-hi:   rgba(255,255,255,0.06);
  --shadow-lg: 0 40px 90px -40px rgba(0,0,0,0.8);
  --serif: "Fraunces", "Playfair Display", Georgia, "Times New Roman", serif;
  --sans:  "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --mono:  "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;
  scroll-behavior: smooth;
  font-family: var(--sans);
  color: var(--ink);
  background: var(--bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "kern" 1, "liga" 1;
  position: relative;
  overflow-x: hidden;
}
.pf-root *, .pf-root *::before, .pf-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pf-root a { color: inherit; text-decoration: none; }
.pf-root img { display: block; max-width: 100%; }
.pf-root ul { list-style: none; }

/* Subtle reusable grain overlay */
.pf-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
}

/* ── Keyframes ───────────────────────────────────────────────────────── */
@keyframes pf-pulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes pf-blink   { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes pf-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes pf-spin    { to { transform: rotate(360deg); } }
@keyframes pf-scrollBounce { 0%,100%{transform:translateY(0);opacity:1} 60%{transform:translateY(6px);opacity:.4} }
@keyframes pf-staggerIn { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
@keyframes pf-grad     { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes pf-orbDrift { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(24px,-20px) scale(1.08)} }
@keyframes pf-marquee  { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes pf-lineGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }

/* Scroll reveal (staggered via inline transition-delay) */
.pf-animate { opacity: 0; transform: translateY(28px); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.pf-animate.pf-visible { opacity: 1; transform: translateY(0); }

/* Hero on-load stagger */
.pf-stagger { opacity: 0; animation: pf-staggerIn .85s cubic-bezier(.22,1,.36,1) forwards; animation-delay: var(--d, 0s); }

/* Animated gradient text */
.pf-name-grad {
  background: linear-gradient(100deg, var(--ink) 0%, var(--gold) 45%, var(--teal) 70%, var(--ink) 100%);
  background-size: 280% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: pf-grad 9s ease infinite;
}

/* ── Sticky Nav ──────────────────────────────────────────────────────── */
.pf-nav {
  position: sticky; top: 0; z-index: 100; padding: 0 24px;
  background: transparent;
  transition: background .35s ease, backdrop-filter .35s ease, border-color .35s ease;
  border-bottom: 1px solid transparent;
}
.pf-nav.pf-nav-solid {
  background: rgba(5,8,16,0.72);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border-bottom: 1px solid var(--line);
}
.pf-nav-inner { max-width: 1140px; margin: 0 auto; height: 60px; display: flex; align-items: center; justify-content: space-between; }
.pf-nav-name { font-family: var(--serif); font-weight: 600; font-size: 18px; letter-spacing: -0.01em; color: var(--ink); }
.pf-nav-links { display: flex; gap: 30px; }
.pf-nav-links a { font-size: 13px; font-weight: 500; color: var(--ink-soft); letter-spacing: .04em; transition: color .15s ease; position: relative; }
.pf-nav-links a::after { content:""; position:absolute; left:0; bottom:-4px; width:0; height:1px; background: var(--gold); transition: width .25s ease; }
.pf-nav-links a:hover { color: var(--ink); }
.pf-nav-links a:hover::after { width: 100%; }

/* ── Eyebrow Labels ──────────────────────────────────────────────────── */
.pf-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 11px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--ink-faint); margin-bottom: 14px;
}
.pf-eyebrow-num { color: var(--gold); font-weight: 600; }
.pf-eyebrow-rule { width: 34px; height: 1px; background: var(--teal); opacity: .7; flex-shrink: 0; }
.pf-eyebrow-light { color: var(--ink-soft); }
.pf-eyebrow-light .pf-eyebrow-rule { background: var(--gold); opacity: .9; }

/* Section headings (serif display) with animated accent line */
.pf-h2 {
  font-family: var(--serif);
  font-weight: 500;
  font-size: clamp(28px, 4.4vw, 46px);
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 28px;
  position: relative;
  display: inline-block;
}
.pf-h2-line {
  display: block;
  width: 64px; height: 2px;
  margin-top: 16px;
  background: linear-gradient(to right, var(--gold), var(--teal));
  transform-origin: left;
  border-radius: 2px;
}
.pf-visible .pf-h2-line,
.pf-section .pf-h2-line { animation: pf-lineGrow .8s cubic-bezier(.22,1,.36,1) .15s both; }

/* ── Glowing orbs ────────────────────────────────────────────────────── */
.pf-orb {
  position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
  filter: blur(70px); will-change: transform;
}
.pf-orb-a { top: -120px; left: -80px; width: 460px; height: 460px;
  background: radial-gradient(circle, rgba(43,214,198,0.30), transparent 65%); animation: pf-orbDrift 18s ease-in-out infinite; }
.pf-orb-b { top: 120px; right: -120px; width: 520px; height: 520px;
  background: radial-gradient(circle, rgba(224,178,76,0.24), transparent 65%); animation: pf-orbDrift 22s ease-in-out infinite reverse; }
.pf-orb-c { bottom: -160px; left: 30%; width: 420px; height: 420px;
  background: radial-gradient(circle, rgba(139,108,240,0.22), transparent 65%); animation: pf-orbDrift 26s ease-in-out infinite; }
.pf-orb-foot { bottom: -160px; left: 50%; transform: translateX(-50%); width: 560px; height: 360px;
  background: radial-gradient(circle, rgba(224,178,76,0.18), transparent 68%); }

/* ── Hero ────────────────────────────────────────────────────────────── */
.pf-hero {
  position: relative;
  padding: 0 24px clamp(56px,6vw,96px);
  background:
    radial-gradient(1200px 600px at 70% -10%, rgba(43,214,198,0.10), transparent 60%),
    linear-gradient(160deg, #060b16 0%, #081325 45%, #050810 100%);
  overflow: hidden;
}
.pf-hero-img-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.18;
  z-index: 0;
  filter: saturate(0.6) brightness(0.7);
}
.pf-hero-bg-code {
  position: absolute; top: 50%; right: -20px; transform: translateY(-50%);
  font-family: var(--mono); font-size: clamp(10px,1.2vw,14px);
  color: rgba(43,214,198,0.05); white-space: nowrap; pointer-events: none;
  user-select: none; letter-spacing: .05em; z-index: 0;
}
.pf-hero-grid {
  position: relative; z-index: 2;
  max-width: 1140px; margin: 0 auto;
  padding-top: clamp(56px,9vw,120px);
  display: grid; grid-template-columns: 1.45fr 0.85fr;
  gap: clamp(32px,5vw,80px); align-items: center;
}

.pf-avail-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 999px;
  border: 1px solid rgba(43,214,198,0.30); background: rgba(43,214,198,0.07);
  color: var(--teal); font-size: 12px; font-weight: 600; letter-spacing: .04em; margin-bottom: 22px;
}
.pf-avail-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--teal); animation: pf-pulse 2s ease infinite; flex-shrink: 0; box-shadow: 0 0 10px var(--teal); }

.pf-niche-wrap { display: flex; align-items: center; gap: 3px; margin-bottom: 14px; }
.pf-niche { font-family: var(--mono); font-size: clamp(12px,1.5vw,14px); letter-spacing: .26em; text-transform: uppercase; color: var(--teal); }
.pf-cursor { display: inline-block; width: 2px; height: 1.1em; background: var(--teal); border-radius: 1px; animation: pf-blink 1s step-end infinite; vertical-align: middle; }

.pf-name {
  font-family: var(--serif);
  font-size: clamp(48px, 9.5vw, 96px);
  font-weight: 600;
  line-height: 0.95;
  letter-spacing: -0.028em;
}

.pf-tagline { margin-top: 24px; font-size: clamp(17px,2.2vw,22px); color: var(--ink-soft); max-width: 38ch; line-height: 1.55; font-weight: 300; }

.pf-stats { display: flex; align-items: center; gap: 28px; margin-top: 38px; }
.pf-stat { display: flex; flex-direction: column; gap: 3px; }
.pf-stat-num { font-family: var(--serif); font-size: clamp(26px,3.4vw,38px); font-weight: 600; color: var(--gold); line-height: 1; letter-spacing: -0.01em; }
.pf-stat-label { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-faint); }
.pf-stat-divider { width: 1px; height: 40px; background: var(--line); }

/* CTA buttons + magnetic */
.pf-hero-cta { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 14px; }
.pf-btn {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; font-weight: 600; font-size: 14px; letter-spacing: .02em;
  cursor: pointer; white-space: nowrap; position: relative;
  transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s ease, background .2s ease, border-color .2s ease;
  transform: translate3d(var(--mx,0), var(--my,0), 0);
}
.pf-mag-inner { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; transition: transform .25s ease; }
.pf-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.pf-btn-primary { background: linear-gradient(135deg, var(--gold), #d9a433); color: #0a0f1a; box-shadow: 0 10px 30px -12px rgba(224,178,76,0.5); }
.pf-btn-primary:hover { transform: translate3d(var(--mx,0), calc(var(--my,0) - 3px), 0); box-shadow: 0 18px 40px -12px rgba(224,178,76,0.6); }
.pf-btn-ghost { border: 1.5px solid var(--line); color: var(--ink); background: rgba(255,255,255,0.02); }
.pf-btn-ghost:hover { border-color: rgba(244,242,236,0.5); background: rgba(255,255,255,0.06); transform: translate3d(var(--mx,0), calc(var(--my,0) - 2px), 0); }
.pf-btn-gold .pf-mag-inner, .pf-btn-gold { font-size: 15px; }
.pf-btn-gold { background: linear-gradient(135deg, var(--gold), #d9a433); color: #0a0f1a; box-shadow: 0 10px 30px -12px rgba(224,178,76,0.5); }
.pf-btn-gold:hover { transform: translate3d(var(--mx,0), calc(var(--my,0) - 3px), 0); box-shadow: 0 18px 42px -12px rgba(224,178,76,0.65); }
.pf-btn-wa { background: #25d366; color: #fff; }
.pf-btn-wa:hover { transform: translate3d(var(--mx,0), calc(var(--my,0) - 2px), 0); box-shadow: 0 14px 30px -10px rgba(37,211,102,0.55); background: #22c05e; }
.pf-btn-ghost-light { border: 1.5px solid var(--line); color: var(--ink-soft); background: transparent; }
.pf-btn-ghost-light:hover { border-color: rgba(244,242,236,0.45); background: rgba(255,255,255,0.05); transform: translate3d(var(--mx,0), calc(var(--my,0) - 2px), 0); }

/* Photo */
.pf-hero-photo { display: flex; justify-content: center; align-items: center; }
.pf-photo-outer { position: relative; display: inline-block; will-change: transform; }
.pf-photo-ring {
  position: absolute; inset: -18px; border-radius: 50%;
  background: conic-gradient(from 0deg, var(--gold), var(--teal), var(--violet), var(--gold));
  filter: blur(2px); opacity: 0.55; z-index: 0;
  animation: pf-spin 14s linear infinite;
}
.pf-photo-frame {
  position: relative; width: clamp(210px,36vw,300px); aspect-ratio: 1;
  border-radius: 50%; overflow: hidden; z-index: 1;
  border: 4px solid var(--bg);
  box-shadow: 0 0 0 1px rgba(224,178,76,0.4), 0 30px 60px -20px rgba(0,0,0,0.7);
  animation: pf-float 6s ease-in-out infinite;
}
.pf-photo-frame img { width: 100%; height: 100%; object-fit: cover; }
.pf-monogram { display: grid; place-items: center; width: 100%; height: 100%; background: linear-gradient(135deg,#13344a,#0a1424); color: var(--gold); font-family: var(--serif); font-size: 76px; font-weight: 600; }
.pf-photo-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 150%; height: 150%; border-radius: 50%; background: radial-gradient(circle, rgba(224,178,76,0.20) 0%, transparent 68%); pointer-events: none; z-index: 0; }

.pf-scroll-cue { position: relative; z-index: 2; display: flex; justify-content: center; padding-top: 48px; }
.pf-scroll-arrow { font-size: 20px; color: var(--ink-faint); animation: pf-scrollBounce 2s ease-in-out infinite; display: inline-block; }

/* ── Marquee ─────────────────────────────────────────────────────────── */
.pf-marquee {
  position: relative; z-index: 2; overflow: hidden;
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  background: var(--bg-deep); padding: 18px 0;
  mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
}
.pf-marquee-track { display: flex; width: max-content; animation: pf-marquee 32s linear infinite; }
.pf-marquee-group { display: flex; }
.pf-marquee-item { display: inline-flex; align-items: center; gap: 14px; padding: 0 28px; font-family: var(--serif); font-size: 20px; font-style: italic; color: var(--ink-soft); white-space: nowrap; }
.pf-marquee-star { color: var(--teal); font-size: 12px; font-style: normal; }

/* ── Main / sections ─────────────────────────────────────────────────── */
.pf-main { position: relative; z-index: 2; }
.pf-band { background: linear-gradient(180deg, var(--bg-lift), rgba(10,16,32,0.4)); border-top: 1px solid var(--line-soft); border-bottom: 1px solid var(--line-soft); }
.pf-band-inner { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
.pf-main > .pf-section, .pf-band-inner > .pf-section { }
.pf-main > .pf-section { max-width: 1140px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
.pf-section { padding: clamp(56px,8vw,96px) 0; border-bottom: 1px solid var(--line-soft); position: relative; }
.pf-band-inner > .pf-section:last-child, .pf-main > .pf-section:last-child { border-bottom: none; }

.pf-lead { font-family: var(--serif); font-size: clamp(22px,3.2vw,32px); font-weight: 400; max-width: 24ch; color: var(--ink); line-height: 1.35; letter-spacing: -0.01em; }
.pf-body { font-size: 16.5px; color: var(--ink-soft); max-width: 64ch; white-space: pre-line; line-height: 1.8; font-weight: 300; }

/* ── Service cards — bento ───────────────────────────────────────────── */
.pf-do-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.pf-do-card {
  background: var(--card); border: 1px solid var(--line);
  border-radius: 18px; padding: 28px 24px 26px; position: relative; overflow: hidden;
  transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease, border-color .3s ease, background .3s ease;
}
.pf-do-card::before { content:""; position:absolute; inset:0; border-radius:18px; padding:1px; background: linear-gradient(135deg, rgba(43,214,198,0.4), transparent 50%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: 0; transition: opacity .3s ease; }
.pf-do-card:hover { transform: translateY(-6px); background: var(--card-hi); border-color: rgba(43,214,198,0.3); box-shadow: 0 30px 60px -30px rgba(43,214,198,0.35); }
.pf-do-card:hover::before { opacity: 1; }
.pf-do-feature { grid-column: span 3; display: grid; grid-template-columns: auto 1fr; gap: 6px 28px; align-items: start; padding: 34px 32px; }
.pf-do-feature .pf-do-num { grid-row: span 3; font-size: 64px; align-self: center; }
.pf-do-feature h3 { font-size: 24px; }
.pf-do-feature p { max-width: 60ch; }
.pf-do-num { font-family: var(--serif); font-size: 40px; font-weight: 600; color: var(--gold); opacity: .35; line-height: 1; margin-bottom: 12px; letter-spacing: -0.02em; }
.pf-do-card h3 { font-family: var(--serif); font-size: 19px; font-weight: 500; margin-bottom: 10px; color: var(--ink); }
.pf-do-card p { font-size: 14.5px; color: var(--ink-soft); line-height: 1.65; font-weight: 300; }
.pf-do-arrow { position: absolute; top: 24px; right: 24px; color: var(--teal); opacity: 0; transform: translateX(-6px); transition: opacity .3s ease, transform .3s ease; font-size: 18px; }
.pf-do-card:hover .pf-do-arrow { opacity: 1; transform: translateX(0); }

/* ── Skills chips ────────────────────────────────────────────────────── */
.pf-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.pf-chip { font-size: 13px; font-weight: 500; padding: 9px 16px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); color: var(--ink-soft); transition: border-color .2s, background .2s, color .2s, transform .2s; }
.pf-chip:hover { border-color: var(--teal); background: rgba(43,214,198,0.08); color: var(--ink); transform: translateY(-2px); }

/* ── Featured project ────────────────────────────────────────────────── */
.pf-feature { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 0; border: 1px solid var(--line); border-radius: 22px; overflow: hidden; background: var(--card); margin-bottom: 24px; transition: border-color .3s ease, box-shadow .3s ease; }
.pf-feature:hover { border-color: rgba(224,178,76,0.35); box-shadow: 0 40px 80px -40px rgba(0,0,0,0.7); }
.pf-feature-img { position: relative; overflow: hidden; min-height: 320px; background: #0a1424; }
.pf-feature-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .6s cubic-bezier(.22,1,.36,1); }
.pf-feature:hover .pf-feature-img img { transform: scale(1.05); }
.pf-feature-body { padding: clamp(28px,4vw,48px); display: flex; flex-direction: column; justify-content: center; }
.pf-feature-kicker { font-family: var(--mono); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--gold); margin-bottom: 14px; }
.pf-feature-body h3 { font-family: var(--serif); font-size: clamp(24px,3vw,34px); font-weight: 500; color: var(--ink); line-height: 1.1; margin-bottom: 14px; letter-spacing: -0.01em; }
.pf-feature-body p { font-size: 15.5px; color: var(--ink-soft); line-height: 1.7; font-weight: 300; margin-bottom: 22px; }
.pf-feature-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.pf-tag { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; padding: 5px 12px; border-radius: 7px; background: rgba(43,214,198,0.10); border: 1px solid rgba(43,214,198,0.28); color: var(--teal); }

/* ── Work grid ───────────────────────────────────────────────────────── */
.pf-work-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)); gap: 24px; }
.pf-work-card { background: var(--card); border-radius: 20px; overflow: hidden; border: 1px solid var(--line); transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease, border-color .3s ease; }
.pf-work-card:hover { transform: translateY(-6px); border-color: rgba(244,242,236,0.18); box-shadow: 0 40px 80px -40px rgba(0,0,0,0.75); }
.pf-work-img-wrap { aspect-ratio: 16/10; overflow: hidden; position: relative; background: #0a1424; }
.pf-work-img { width: 100%; height: 100%; object-fit: cover; transition: transform .55s cubic-bezier(.22,1,.36,1); }
.pf-work-card:hover .pf-work-img { transform: scale(1.06); }
.pf-work-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(3,6,13,0.9) 0%, rgba(3,6,13,0.2) 55%, transparent 100%); opacity: 0; transition: opacity .3s ease; display: flex; align-items: flex-end; padding: 18px; }
.pf-work-card:hover .pf-work-overlay { opacity: 1; }
.pf-overlay-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.pf-overlay-tag { font-family: var(--mono); font-size: 11px; letter-spacing: .04em; padding: 4px 10px; border-radius: 6px; background: rgba(43,214,198,0.20); border: 1px solid rgba(43,214,198,0.4); color: #b6f4ee; }
.pf-work-body { padding: 22px 22px 24px; }
.pf-work-body h3 { font-family: var(--serif); font-size: 19px; font-weight: 500; color: var(--ink); margin-bottom: 8px; }
.pf-work-body p { font-size: 14.5px; color: var(--ink-soft); line-height: 1.65; font-weight: 300; }

/* ── Credentials ─────────────────────────────────────────────────────── */
.pf-creds { display: grid; gap: 0; }
.pf-creds li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 20px 0; border-top: 1px solid var(--line-soft); transition: padding-left .25s ease; }
.pf-creds li:first-child { border-top: none; }
.pf-creds li:hover { padding-left: 10px; }
.pf-cred-title { font-family: var(--serif); font-weight: 500; font-size: 18px; color: var(--ink); }
.pf-cred-meta { color: var(--ink-faint); font-size: 14px; font-family: var(--mono); letter-spacing: .02em; }

/* ── Testimonials ────────────────────────────────────────────────────── */
.pf-quotes { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)); gap: 22px; }
.pf-quote { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 30px 28px 26px; position: relative; overflow: hidden; transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease; }
.pf-quote:hover { transform: translateY(-5px); border-color: rgba(224,178,76,0.3); box-shadow: 0 36px 70px -36px rgba(0,0,0,0.7); }
.pf-quote-bg-mark { position: absolute; top: -16px; left: 16px; font-size: 130px; font-family: var(--serif); font-weight: 700; color: rgba(43,214,198,0.08); line-height: 1; pointer-events: none; user-select: none; }
.pf-stars { display: flex; gap: 2px; margin-bottom: 14px; color: var(--gold); font-size: 16px; }
.pf-quote blockquote { font-size: 15.5px; color: var(--ink); line-height: 1.7; position: relative; z-index: 1; font-weight: 300; }
.pf-quote figcaption { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
.pf-avatar { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-family: var(--serif); font-size: 14px; font-weight: 600; color: #fff; flex-shrink: 0; }
.pf-author-info { display: flex; flex-direction: column; gap: 2px; }
.pf-author-info strong { font-size: 14px; font-weight: 600; color: var(--ink); }
.pf-author-info span { font-size: 12px; color: var(--ink-faint); }
.pf-verified { color: var(--teal) !important; font-size: 11px !important; font-weight: 600; letter-spacing: .03em; }

/* ── FAQ ─────────────────────────────────────────────────────────────── */
.pf-faqs { display: grid; gap: 0; max-width: 820px; }
.pf-faq { border-top: 1px solid var(--line-soft); transition: border-color .25s ease; }
.pf-faq:last-child { border-bottom: 1px solid var(--line-soft); }
.pf-faq[open] { border-color: rgba(43,214,198,0.4); }
.pf-faq summary { cursor: pointer; list-style: none; padding: 20px 4px; font-family: var(--serif); font-weight: 500; font-size: 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--ink); transition: color .15s ease, padding-left .25s ease; }
.pf-faq summary::-webkit-details-marker { display: none; }
.pf-faq summary:hover { color: var(--teal); padding-left: 8px; }
.pf-faq-icon { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--line); display: grid; place-items: center; font-size: 18px; font-weight: 300; color: var(--teal); transition: transform .35s cubic-bezier(.22,1,.36,1), background .2s ease, border-color .2s ease; line-height: 1; }
.pf-faq[open] .pf-faq-icon { transform: rotate(135deg); background: rgba(43,214,198,0.12); border-color: var(--teal); }
.pf-faq-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.22,1,.36,1); }
.pf-faq[open] .pf-faq-body { grid-template-rows: 1fr; }
.pf-faq-body > p { overflow: hidden; padding-bottom: 20px; padding-left: 4px; color: var(--ink-soft); font-size: 15px; max-width: 66ch; line-height: 1.75; font-weight: 300; }

/* ── Brands ──────────────────────────────────────────────────────────── */
.pf-brands { display: flex; flex-wrap: wrap; gap: 12px; }
.pf-brand { padding: 13px 24px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font-family: var(--serif); font-size: 15px; font-weight: 500; letter-spacing: .01em; transition: border-color .25s, background .25s, transform .25s, color .25s; }
.pf-brand:nth-child(odd) { color: var(--teal); border-color: rgba(43,214,198,0.22); }
.pf-brand:nth-child(even) { color: var(--gold); border-color: rgba(224,178,76,0.22); }
.pf-brand:hover { transform: translateY(-4px); background: var(--card-hi); border-color: currentColor; }

/* ── Footer ──────────────────────────────────────────────────────────── */
.pf-footer { position: relative; background: linear-gradient(180deg, var(--bg-deep), #02040a); color: var(--ink); padding: clamp(72px,11vw,130px) 24px 52px; overflow: hidden; }
.pf-footer::before { content:""; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, var(--gold), transparent); opacity: .6; }
.pf-footer-inner { position: relative; z-index: 2; max-width: 720px; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; }
.pf-footer-eyebrow { margin-bottom: 18px; }
.pf-footer-headline { font-family: var(--serif); font-size: clamp(36px,7vw,68px); font-weight: 500; color: var(--ink); letter-spacing: -0.02em; line-height: 1.04; margin-bottom: 18px; }
.pf-footer-sub { font-size: 16.5px; color: var(--ink-soft); max-width: 46ch; line-height: 1.7; margin-bottom: 40px; font-weight: 300; }
.pf-footer-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
.pf-footer-divider { width: 100%; height: 1px; background: var(--line-soft); margin: 48px 0 22px; }
.pf-credit { font-family: var(--mono); font-size: 12px; color: var(--ink-faint); letter-spacing: .08em; }

/* ── Back to top ─────────────────────────────────────────────────────── */
.pf-totop {
  position: fixed; right: 22px; bottom: 22px; z-index: 200;
  width: 46px; height: 46px; border-radius: 50%;
  display: grid; place-items: center; font-size: 18px; color: #0a0f1a;
  background: linear-gradient(135deg, var(--gold), #d9a433);
  box-shadow: 0 12px 30px -10px rgba(224,178,76,0.6);
  opacity: 0; transform: translateY(16px) scale(0.9); pointer-events: none;
  transition: opacity .3s ease, transform .3s cubic-bezier(.22,1,.36,1);
}
.pf-totop-on { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.pf-totop:hover { transform: translateY(-3px) scale(1.05); }

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 880px) {
  .pf-do-grid { grid-template-columns: repeat(2, 1fr); }
  .pf-do-feature { grid-column: span 2; }
}
@media (max-width: 760px) {
  .pf-hero-grid { grid-template-columns: 1fr; padding-top: clamp(40px,6vw,64px); }
  .pf-hero-photo { order: -1; margin-bottom: 8px; }
  .pf-photo-frame { width: clamp(150px,46vw,210px); }
  .pf-stats { gap: 18px; }
  .pf-nav-links { gap: 18px; }
  .pf-do-grid { grid-template-columns: 1fr; }
  .pf-do-feature { grid-column: span 1; grid-template-columns: 1fr; }
  .pf-do-feature .pf-do-num { grid-row: auto; align-self: start; }
  .pf-feature { grid-template-columns: 1fr; }
  .pf-feature-img { min-height: 220px; }
}
@media (max-width: 480px) {
  .pf-hero-cta { flex-direction: column; align-items: stretch; }
  .pf-hero-cta .pf-btn { justify-content: center; }
  .pf-footer-ctas { flex-direction: column; align-items: stretch; }
  .pf-footer-ctas .pf-btn { justify-content: center; }
  .pf-nav-links { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .pf-root * { transition: none !important; animation: none !important; }
  .pf-animate, .pf-stagger { opacity: 1 !important; transform: none !important; }
  .pf-root { scroll-behavior: auto; }
  .pf-name-grad { -webkit-text-fill-color: var(--gold); color: var(--gold); }
}
`;
