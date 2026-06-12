import { useEffect, useRef } from "react";
import type { PortfolioData } from "@/lib/portfolio-types";

/**
 * Self-contained, responsive portfolio landing page. Styling is scoped to
 * `.pf-root` so it renders identically inside the app preview and on the
 * public /p/<slug> route, independent of the app's dark theme.
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

  // Scroll-triggered fade-in animations
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>(".pf-animate");
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
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Sticky nav scroll effect
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".pf-nav");
    if (!nav) return;
    const onScroll = () => {
      nav.classList.toggle("pf-nav-solid", window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const avatarColors = [
    "linear-gradient(135deg,#0E7C86,#0a1a1f)",
    "linear-gradient(135deg,#B98A2E,#5c3d00)",
    "linear-gradient(135deg,#6c3fc5,#0f1e2e)",
    "linear-gradient(135deg,#1a7a4a,#0a1a1f)",
  ];

  return (
    <div className="pf-root" ref={rootRef}>
      <style>{PF_CSS}</style>

      {/* ── Sticky Nav ──────────────────────────────────────── */}
      <nav className="pf-nav">
        <div className="pf-nav-inner">
          <span className="pf-nav-name">{hero.name}</span>
          <div className="pf-nav-links">
            <a href="#work">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="pf-hero">
        {/* Decorative code background */}
        <div className="pf-hero-bg-code" aria-hidden="true">
          {`{ "available": true, "quality": "premium", "response": "< 24h" }`}
        </div>

        <div className="pf-hero-grid">
          <div className="pf-hero-copy">
            <div className="pf-avail-badge">
              <span className="pf-avail-dot" />
              Available for projects
            </div>
            <div className="pf-niche-wrap">
              <span className="pf-niche">{hero.niche}</span>
              <span className="pf-cursor" aria-hidden="true" />
            </div>
            <h1 className="pf-name">
              <span className="pf-name-accent">{(hero.name || "")[0]}</span>
              {(hero.name || "").slice(1)}
            </h1>
            <p className="pf-tagline">{hero.tagline}</p>

            <div className="pf-stats">
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

            <div className="pf-hero-cta">
              {contact.email && (
                <a className="pf-btn pf-btn-primary" href={`mailto:${contact.email}`}>
                  Start a Conversation
                </a>
              )}
              <a className="pf-btn pf-btn-ghost" href="#work">
                See My Work ↓
              </a>
            </div>
          </div>

          <div className="pf-hero-photo">
            <div className="pf-photo-outer">
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

      <main className="pf-main">

        {/* ── About the client ──────────────────────────────── */}
        {data.aboutClient && (
          <section className="pf-section pf-animate" id="about">
            {label("Where you are")}
            <p className="pf-lead">{data.aboutClient}</p>
          </section>
        )}

        {/* ── My Story ──────────────────────────────────────── */}
        {data.myStory && (
          <section className="pf-section pf-animate">
            {label("My story")}
            <p className="pf-body">{data.myStory}</p>
          </section>
        )}

        {/* ── What I Do ─────────────────────────────────────── */}
        {data.whatIDo.length > 0 && (
          <section className="pf-section">
            {label("What I do")}
            <div className="pf-do-grid">
              {data.whatIDo.map((d, i) => (
                <div key={i} className="pf-do-card pf-animate" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="pf-do-num">0{i + 1}</div>
                  <h3>{d.title}</h3>
                  <p>{d.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Skills ────────────────────────────────────────── */}
        {data.skills.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Skills & tools")}
            <div className="pf-chips">
              {data.skills.map((s, i) => (
                <span key={i} className="pf-chip">{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Selected Work ─────────────────────────────────── */}
        {data.projects.length > 0 && (
          <section className="pf-section" id="work">
            {label("Selected work")}
            <div className="pf-work-grid">
              {data.projects.map((p, i) => (
                <article key={i} className="pf-work-card pf-animate" style={{ transitionDelay: `${i * 0.08}s` }}>
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
          </section>
        )}

        {/* ── Credentials ───────────────────────────────────── */}
        {data.credentials.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Credentials")}
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

        {/* ── Client Feedback ───────────────────────────────── */}
        {data.testimonials.length > 0 && (
          <section className="pf-section">
            {label("Client feedback")}
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
                  <figure key={i} className="pf-quote pf-animate" style={{ transitionDelay: `${i * 0.1}s` }}>
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
        )}

        {/* ── FAQ ───────────────────────────────────────────── */}
        {data.faqs.length > 0 && (
          <section className="pf-section pf-animate">
            {label("Questions, answered")}
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
        <div className="pf-footer-inner pf-animate">
          <div className="pf-footer-eyebrow">
            <span className="pf-eyebrow pf-eyebrow-light">
              <span className="pf-eyebrow-rule" />
              <span>Get in touch</span>
            </span>
          </div>
          <h2 className="pf-footer-headline">Let's Build Something Great</h2>
          <p className="pf-footer-sub">
            I typically respond within 24 hours. Let's discuss your project and make it happen.
          </p>
          <div className="pf-footer-ctas">
            {contact.email && (
              <a className="pf-btn pf-btn-gold" href={`mailto:${contact.email}`}>
                ✉ {contact.email}
              </a>
            )}
            {waLink && (
              <a className="pf-btn pf-btn-wa" href={waLink} target="_blank" rel="noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            )}
            {contact.phone && (
              <a className="pf-btn pf-btn-ghost-light" href={`tel:${contact.phone}`}>
                📞 {contact.phone}
              </a>
            )}
          </div>
          <div className="pf-footer-divider" />
          <p className="pf-credit">{hero.name} · {hero.niche}</p>
        </div>
      </footer>
    </div>
  );
}

const PF_CSS = `
/* ── Reset & Tokens ──────────────────────────────────────────────────── */
.pf-root {
  --bg:       #0a0f1a;
  --bg2:      #0f1e2e;
  --paper:    #F7F6F2;
  --ink:      #11161F;
  --muted:    #5A6473;
  --teal:     #0E9EA8;
  --teal-dim: #0E7C86;
  --gold:     #C9962E;
  --gold-dim: #B98A2E;
  --line:     rgba(17,22,31,0.12);
  --line-lt:  rgba(255,255,255,0.1);
  --card:     #FFFFFF;
  --shadow-sm: 0 4px 16px -4px rgba(17,22,31,0.12);
  --shadow-md: 0 12px 40px -12px rgba(17,22,31,0.22);
  --shadow-lg: 0 28px 70px -28px rgba(17,22,31,0.45);
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  color: var(--ink);
  background: var(--paper);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "kern" 1, "liga" 1;
}
.pf-root *, .pf-root *::before, .pf-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.pf-root h1, .pf-root h2, .pf-root h3, .pf-root h4 {
  font-family: "Outfit", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.025em;
  line-height: 1.1;
}
.pf-root a { color: inherit; text-decoration: none; }
.pf-root img { display: block; max-width: 100%; }
.pf-root ul { list-style: none; }

/* ── Animations ──────────────────────────────────────────────────────── */
@keyframes pf-fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pf-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
@keyframes pf-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes pf-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
@keyframes pf-scrollBounce {
  0%, 100% { transform: translateY(0); opacity: 1; }
  60%       { transform: translateY(6px); opacity: 0.5; }
}

.pf-animate {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.65s ease, transform 0.65s ease;
}
.pf-animate.pf-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Sticky Nav ──────────────────────────────────────────────────────── */
.pf-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 24px;
  background: transparent;
  transition: background 0.3s ease, backdrop-filter 0.3s ease, border-bottom 0.3s ease;
}
.pf-nav.pf-nav-solid {
  background: rgba(10, 15, 26, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line-lt);
}
.pf-nav-inner {
  max-width: 1080px;
  margin: 0 auto;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pf-nav-name {
  font-family: "Outfit", sans-serif;
  font-weight: 700;
  font-size: 16px;
  color: #fff;
  opacity: 0.9;
}
.pf-nav-links {
  display: flex;
  gap: 28px;
}
.pf-nav-links a {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.04em;
  transition: color 0.15s ease;
}
.pf-nav-links a:hover { color: var(--gold); }

/* ── Eyebrow Labels ──────────────────────────────────────────────────── */
.pf-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 20px;
}
.pf-eyebrow-num  { color: var(--gold); font-weight: 600; }
.pf-eyebrow-rule { width: 30px; height: 1px; background: var(--teal); opacity: 0.6; flex-shrink: 0; }
.pf-eyebrow-light       { color: rgba(255,255,255,0.55); }
.pf-eyebrow-light .pf-eyebrow-rule { background: var(--gold); opacity: 0.9; }

/* ── Hero ────────────────────────────────────────────────────────────── */
.pf-hero {
  position: relative;
  padding: 0 24px clamp(48px,6vw,80px);
  background: linear-gradient(135deg, #0a0f1a 0%, #0f1e2e 40%, #0a1a1f 100%);
  overflow: hidden;
}
.pf-hero-bg-code {
  position: absolute;
  top: 50%;
  right: -20px;
  transform: translateY(-50%);
  font-family: "JetBrains Mono", monospace;
  font-size: clamp(10px, 1.2vw, 14px);
  color: rgba(14,158,168,0.06);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.05em;
}
.pf-hero-grid {
  max-width: 1080px;
  margin: 0 auto;
  padding-top: clamp(48px,8vw,100px);
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

/* Availability badge */
.pf-avail-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(34,197,94,0.35);
  background: rgba(34,197,94,0.08);
  color: #4ade80;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 20px;
}
.pf-avail-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  animation: pf-pulse 2s ease infinite;
  flex-shrink: 0;
}

/* Niche with cursor */
.pf-niche-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 10px;
}
.pf-niche {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: clamp(12px, 1.5vw, 14px);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--teal);
}
.pf-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: var(--teal);
  border-radius: 1px;
  animation: pf-blink 1s step-end infinite;
  vertical-align: middle;
}

/* Name */
.pf-name {
  font-size: clamp(42px, 7.5vw, 82px);
  font-weight: 800;
  color: #fff;
  line-height: 0.95;
  letter-spacing: -0.03em;
}
.pf-name-accent {
  color: var(--gold);
  display: inline;
}

.pf-tagline {
  margin-top: 20px;
  font-size: clamp(16px, 2.2vw, 20px);
  color: rgba(255,255,255,0.6);
  max-width: 36ch;
  line-height: 1.55;
}

/* Stats row */
.pf-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 32px;
}
.pf-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pf-stat-num {
  font-family: "Outfit", sans-serif;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 800;
  color: var(--gold);
  line-height: 1;
}
.pf-stat-label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.pf-stat-divider {
  width: 1px;
  height: 36px;
  background: rgba(255,255,255,0.15);
}

/* CTA buttons */
.pf-hero-cta {
  margin-top: 36px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.pf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 26px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
  cursor: pointer;
  white-space: nowrap;
}
.pf-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.pf-btn-primary {
  background: var(--gold);
  color: #0a0f1a;
}
.pf-btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px -8px rgba(201,150,46,0.55);
  background: #d9a433;
}
.pf-btn-ghost {
  border: 1.5px solid rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.85);
  background: transparent;
}
.pf-btn-ghost:hover {
  border-color: rgba(255,255,255,0.7);
  transform: translateY(-2px);
  background: rgba(255,255,255,0.05);
}
.pf-btn-gold {
  background: var(--gold);
  color: #0a0f1a;
  font-size: 15px;
  padding: 16px 32px;
}
.pf-btn-gold:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 32px -8px rgba(201,150,46,0.6);
  background: #d9a433;
}
.pf-btn-wa {
  background: #25d366;
  color: #fff;
  font-size: 14px;
  padding: 13px 26px;
}
.pf-btn-wa:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px -8px rgba(37,211,102,0.5);
  background: #22c05e;
}
.pf-btn-ghost-light {
  border: 1.5px solid var(--line-lt);
  color: rgba(255,255,255,0.7);
  background: transparent;
  font-size: 14px;
}
.pf-btn-ghost-light:hover {
  border-color: rgba(255,255,255,0.5);
  background: rgba(255,255,255,0.05);
  transform: translateY(-2px);
}

/* Photo frame */
.pf-hero-photo { display: flex; justify-content: center; align-items: center; }
.pf-photo-outer {
  position: relative;
  display: inline-block;
}
.pf-photo-frame {
  position: relative;
  width: clamp(200px, 36vw, 280px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 3px solid var(--gold);
  overflow: hidden;
  box-shadow: 0 0 0 6px rgba(201,150,46,0.12), 0 0 0 14px rgba(201,150,46,0.05);
  z-index: 1;
  animation: pf-float 5s ease-in-out infinite;
}
.pf-photo-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pf-monogram {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a3a4a, #0f1e2e);
  color: var(--gold);
  font-family: "Outfit", sans-serif;
  font-size: 72px;
  font-weight: 800;
}
.pf-photo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120%;
  height: 120%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201,150,46,0.18) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* Scroll cue */
.pf-scroll-cue {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}
.pf-scroll-arrow {
  font-size: 20px;
  color: rgba(255,255,255,0.35);
  animation: pf-scrollBounce 2s ease-in-out infinite;
  display: inline-block;
}

/* ── Main sections ───────────────────────────────────────────────────── */
.pf-main { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.pf-section {
  padding: clamp(48px, 7vw, 80px) 0;
  border-bottom: 1px solid var(--line);
}
.pf-section:last-child { border-bottom: none; }

.pf-lead {
  font-size: clamp(20px, 2.8vw, 26px);
  font-weight: 500;
  max-width: 40ch;
  color: var(--ink);
  line-height: 1.45;
}
.pf-body {
  font-size: 16px;
  color: var(--muted);
  max-width: 62ch;
  white-space: pre-line;
  line-height: 1.75;
}

/* ── Service cards ───────────────────────────────────────────────────── */
.pf-do-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}
.pf-do-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 3px solid var(--teal);
  border-radius: 14px;
  padding: 24px 22px 22px;
  position: relative;
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  overflow: hidden;
}
.pf-do-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 50px -18px rgba(14,158,168,0.25);
}
.pf-do-num {
  font-family: "Outfit", sans-serif;
  font-size: 36px;
  font-weight: 800;
  color: var(--gold);
  opacity: 0.2;
  line-height: 1;
  margin-bottom: 10px;
  letter-spacing: -0.03em;
}
.pf-do-card h3 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--ink);
}
.pf-do-card p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
}

/* ── Skills chips ────────────────────────────────────────────────────── */
.pf-chips { display: flex; flex-wrap: wrap; gap: 9px; }
.pf-chip {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--ink);
  transition: border-color 0.15s, background 0.15s;
}
.pf-chip:hover {
  border-color: var(--teal);
  background: rgba(14,158,168,0.05);
}

/* ── Work / Projects ─────────────────────────────────────────────────── */
.pf-work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.pf-work-card {
  background: var(--card);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--line);
  transition: transform 0.22s ease, box-shadow 0.22s ease;
  box-shadow: var(--shadow-sm);
}
.pf-work-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 32px 72px -32px rgba(17,22,31,0.38);
}
.pf-work-img-wrap {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  position: relative;
  background: #e8e6e0;
}
.pf-work-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
  display: block;
}
.pf-work-card:hover .pf-work-img { transform: scale(1.05); }
.pf-work-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(10,15,26,0.88) 0%, rgba(10,15,26,0.2) 60%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  align-items: flex-end;
  padding: 18px;
}
.pf-work-card:hover .pf-work-overlay { opacity: 1; }
.pf-overlay-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pf-overlay-tag {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(14,158,168,0.25);
  border: 1px solid rgba(14,158,168,0.4);
  color: #a8edf0;
}
.pf-work-body { padding: 20px 22px 22px; }
.pf-work-body h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 7px;
}
.pf-work-body p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
}

/* ── Credentials ─────────────────────────────────────────────────────── */
.pf-creds { display: grid; gap: 0; }
.pf-creds li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 18px 0;
  border-top: 1px solid var(--line);
}
.pf-creds li:first-child { border-top: none; }
.pf-cred-title { font-weight: 600; font-size: 16px; }
.pf-cred-meta { color: var(--muted); font-size: 14px; }

/* ── Testimonials ────────────────────────────────────────────────────── */
.pf-quotes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 22px;
}
.pf-quote {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 28px 26px 24px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.pf-quote:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}
.pf-quote-bg-mark {
  position: absolute;
  top: -10px;
  left: 16px;
  font-size: 120px;
  font-family: "Outfit", sans-serif;
  font-weight: 900;
  color: rgba(14,158,168,0.07);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
.pf-stars {
  display: flex;
  gap: 2px;
  margin-bottom: 14px;
  color: var(--gold);
  font-size: 16px;
}
.pf-quote blockquote {
  font-size: 15px;
  color: var(--ink);
  line-height: 1.7;
  font-style: italic;
  position: relative;
  z-index: 1;
}
.pf-quote figcaption {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.pf-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: "Outfit", sans-serif;
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.pf-author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pf-author-info strong { font-size: 14px; font-weight: 700; }
.pf-author-info span   { font-size: 12px; color: var(--muted); }
.pf-verified {
  color: var(--teal) !important;
  font-size: 11px !important;
  font-weight: 600;
  letter-spacing: 0.03em;
}

/* ── FAQ ─────────────────────────────────────────────────────────────── */
.pf-faqs { display: grid; gap: 0; }
.pf-faq {
  border-top: 1px solid var(--line);
  transition: border-color 0.2s ease;
}
.pf-faq:last-child { border-bottom: 1px solid var(--line); }
.pf-faq[open] { border-color: var(--teal-dim); }
.pf-faq[open] > summary { color: var(--ink); }
.pf-faq summary {
  cursor: pointer;
  list-style: none;
  padding: 18px 4px;
  font-weight: 600;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: var(--ink);
  transition: color 0.15s ease;
}
.pf-faq summary::-webkit-details-marker { display: none; }
.pf-faq summary:hover { color: var(--teal-dim); }
.pf-faq-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--line);
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 300;
  color: var(--teal);
  transition: transform 0.3s ease, background 0.2s ease, border-color 0.2s ease;
  line-height: 1;
}
.pf-faq[open] .pf-faq-icon {
  transform: rotate(45deg);
  background: rgba(14,158,168,0.08);
  border-color: var(--teal);
}
/* CSS grid trick for smooth height transition */
.pf-faq-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s ease;
}
.pf-faq[open] .pf-faq-body {
  grid-template-rows: 1fr;
}
.pf-faq-body > p {
  overflow: hidden;
  padding-bottom: 18px;
  padding-left: 4px;
  color: var(--muted);
  font-size: 15px;
  max-width: 64ch;
  line-height: 1.75;
}

/* ── Brands ──────────────────────────────────────────────────────────── */
.pf-brands {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.pf-brand {
  padding: 12px 22px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--card);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}
.pf-brand:nth-child(odd)  { color: var(--teal-dim); border-color: rgba(14,124,134,0.25); }
.pf-brand:nth-child(even) { color: var(--gold-dim); border-color: rgba(185,138,46,0.25); }
.pf-brand:hover {
  transform: translateY(-3px);
  background: rgba(14,158,168,0.05);
  border-color: var(--teal);
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.pf-footer {
  background: #050810;
  color: #fff;
  padding: clamp(64px, 10vw, 110px) 24px 48px;
  position: relative;
  overflow: hidden;
}
.pf-footer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--gold-dim), transparent);
  opacity: 0.5;
}
.pf-footer-inner {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.pf-footer-eyebrow { margin-bottom: 16px; }
.pf-footer-headline {
  font-size: clamp(32px, 6vw, 58px);
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 16px;
}
.pf-footer-sub {
  font-size: 16px;
  color: rgba(255,255,255,0.5);
  max-width: 44ch;
  line-height: 1.65;
  margin-bottom: 36px;
}
.pf-footer-ctas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
.pf-footer-divider {
  width: 100%;
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 44px 0 20px;
}
.pf-credit {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
}

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 760px) {
  .pf-hero-grid {
    grid-template-columns: 1fr;
    padding-top: clamp(40px, 6vw, 60px);
  }
  .pf-hero-photo { order: -1; margin-bottom: 8px; }
  .pf-photo-frame { width: clamp(140px, 42vw, 200px); }
  .pf-stats { gap: 16px; }
  .pf-nav-links { gap: 16px; }
  .pf-do-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .pf-hero-cta { flex-direction: column; align-items: flex-start; }
  .pf-footer-ctas { flex-direction: column; align-items: stretch; }
  .pf-footer-ctas .pf-btn { justify-content: center; }
  .pf-nav-links { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .pf-root * { transition: none !important; animation: none !important; }
  .pf-animate { opacity: 1; transform: none; }
}
`;
