import type { PortfolioData } from "@/lib/portfolio-types";

/**
 * Self-contained, responsive portfolio landing page. Styling is scoped to
 * `.pf-root` so it renders identically inside the app preview and on the
 * public /p/<slug> route, independent of the app's dark theme.
 */
export function PortfolioLanding({ data }: { data: PortfolioData }) {
  const { hero, contact } = data;
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

  let section = 0;
  const label = (name: string) => {
    section += 1;
    const n = String(section).padStart(2, "0");
    return (
      <span className="pf-eyebrow">
        <span className="pf-eyebrow-num">{n}</span>
        <span className="pf-eyebrow-rule" />
        {name}
      </span>
    );
  };

  return (
    <div className="pf-root">
      <style>{PF_CSS}</style>

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="pf-hero">
        <div className="pf-hero-grid">
          <div className="pf-hero-copy">
            <span className="pf-niche">{hero.niche}</span>
            <h1 className="pf-name">{hero.name}</h1>
            <p className="pf-tagline">{hero.tagline}</p>
            <div className="pf-hero-cta">
              {contact.email && (
                <a className="pf-btn pf-btn-primary" href={`mailto:${contact.email}`}>
                  Start a conversation
                </a>
              )}
              <a className="pf-btn pf-btn-ghost" href="#work">
                See selected work
              </a>
            </div>
          </div>
          <div className="pf-hero-photo">
            <div className="pf-photo-frame">
              {hero.avatarUrl ? (
                <img src={hero.avatarUrl} alt={hero.name} loading="eager" />
              ) : (
                <span className="pf-monogram">{initials}</span>
              )}
              <span className="pf-tick pf-tick-tl" />
              <span className="pf-tick pf-tick-br" />
            </div>
          </div>
        </div>
      </header>

      <main className="pf-main">
        {/* ── About the client ───────────────────────────── */}
        {data.aboutClient && (
          <section className="pf-section">
            {label("Where you are")}
            <p className="pf-lead">{data.aboutClient}</p>
          </section>
        )}

        {/* ── My Story ───────────────────────────────────── */}
        {data.myStory && (
          <section className="pf-section">
            {label("My story")}
            <p className="pf-body">{data.myStory}</p>
          </section>
        )}

        {/* ── What I Do ──────────────────────────────────── */}
        {data.whatIDo.length > 0 && (
          <section className="pf-section">
            {label("What I do for this")}
            <div className="pf-do-grid">
              {data.whatIDo.map((d, i) => (
                <div key={i} className="pf-do-card">
                  <h3>{d.title}</h3>
                  <p>{d.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Skills ─────────────────────────────────────── */}
        {data.skills.length > 0 && (
          <section className="pf-section">
            {label("Skills")}
            <div className="pf-chips">
              {data.skills.map((s, i) => (
                <span key={i} className="pf-chip">{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Selected Work ──────────────────────────────── */}
        {data.projects.length > 0 && (
          <section className="pf-section" id="work">
            {label("Selected work")}
            <div className="pf-work-grid">
              {data.projects.map((p, i) => (
                <article key={i} className="pf-work-card">
                  <div className="pf-work-img">
                    <img src={p.imageUrl} alt={p.title} loading="lazy" />
                  </div>
                  <div className="pf-work-body">
                    <h3>{p.title}</h3>
                    <p>{p.description}</p>
                    <div className="pf-tags">
                      {p.tags.map((t, j) => (
                        <span key={j} className="pf-tag">{t}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── Credentials ────────────────────────────────── */}
        {data.credentials.length > 0 && (
          <section className="pf-section">
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

        {/* ── Client Feedback ────────────────────────────── */}
        {data.testimonials.length > 0 && (
          <section className="pf-section">
            {label("Client feedback")}
            <div className="pf-quotes">
              {data.testimonials.map((t, i) => (
                <figure key={i} className="pf-quote">
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption>
                    <strong>{t.author}</strong>
                    <span>{t.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ────────────────────────────────────────── */}
        {data.faqs.length > 0 && (
          <section className="pf-section">
            {label("Questions, answered")}
            <div className="pf-faqs">
              {data.faqs.map((f, i) => (
                <details key={i} className="pf-faq">
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* ── Brands ─────────────────────────────────────── */}
        {data.brands.length > 0 && (
          <section className="pf-section">
            {label("Brands I've worked with")}
            <div className="pf-brands">
              {data.brands.map((b, i) => (
                <span key={i} className="pf-brand">{b}</span>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Get in touch ─────────────────────────────────── */}
      <footer className="pf-contact" id="contact">
        <span className="pf-eyebrow pf-eyebrow-light">
          <span className="pf-eyebrow-rule" />
          Get in touch
        </span>
        <h2>Let's build the thing.</h2>
        <div className="pf-contact-links">
          {contact.email && (
            <a href={`mailto:${contact.email}`}>
              <span className="pf-contact-k">Email</span>
              <span className="pf-contact-v">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`}>
              <span className="pf-contact-k">Phone</span>
              <span className="pf-contact-v">{contact.phone}</span>
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer">
              <span className="pf-contact-k">WhatsApp</span>
              <span className="pf-contact-v">{contact.whatsapp}</span>
            </a>
          )}
        </div>
        <p className="pf-credit">{hero.name} · {hero.niche}</p>
      </footer>
    </div>
  );
}

const PF_CSS = `
.pf-root {
  --paper: #F7F6F2;
  --ink: #11161F;
  --muted: #5A6473;
  --teal: #0E7C86;
  --gold: #B98A2E;
  --line: rgba(17,22,31,0.12);
  --card: #FFFFFF;
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  color: var(--ink);
  background: var(--paper);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.pf-root *, .pf-root *::before, .pf-root *::after { box-sizing: border-box; }
.pf-root h1, .pf-root h2, .pf-root h3 {
  font-family: "Outfit", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.02em; line-height: 1.1; margin: 0; color: var(--ink);
}
.pf-root p { margin: 0; }
.pf-root a { color: inherit; text-decoration: none; }

.pf-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--muted); margin-bottom: 18px;
}
.pf-eyebrow-num { color: var(--gold); font-weight: 600; }
.pf-eyebrow-rule { width: 28px; height: 1px; background: var(--teal); opacity: 0.5; }
.pf-eyebrow-light { color: rgba(255,255,255,0.6); }
.pf-eyebrow-light .pf-eyebrow-rule { background: var(--gold); opacity: 0.8; }

/* Hero */
.pf-hero { padding: clamp(40px, 8vw, 96px) 24px 32px; border-bottom: 1px solid var(--line); }
.pf-hero-grid {
  max-width: 1080px; margin: 0 auto;
  display: grid; grid-template-columns: 1.4fr 0.9fr; gap: clamp(24px, 5vw, 64px);
  align-items: center;
}
.pf-niche {
  display: inline-block;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--teal); margin-bottom: 16px;
}
.pf-name { font-size: clamp(40px, 7vw, 72px); font-weight: 700; }
.pf-tagline { margin-top: 18px; font-size: clamp(17px, 2.4vw, 21px); color: var(--muted); max-width: 30ch; }
.pf-hero-cta { margin-top: 32px; display: flex; flex-wrap: wrap; gap: 12px; }
.pf-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 22px; border-radius: 999px; font-weight: 600; font-size: 14px;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.pf-btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.pf-btn-primary { background: var(--ink); color: #fff; }
.pf-btn-primary:hover { transform: translateY(-2px); background: var(--teal); }
.pf-btn-ghost { border: 1px solid var(--line); color: var(--ink); }
.pf-btn-ghost:hover { border-color: var(--ink); }

.pf-hero-photo { display: flex; justify-content: center; }
.pf-photo-frame {
  position: relative; width: clamp(180px, 40vw, 260px); aspect-ratio: 1;
  border-radius: 18px; overflow: visible;
}
.pf-photo-frame img {
  width: 100%; height: 100%; object-fit: cover; border-radius: 18px;
  border: 1px solid var(--line); box-shadow: 0 24px 60px -28px rgba(17,22,31,0.45);
}
.pf-monogram {
  display: grid; place-items: center; width: 100%; height: 100%;
  border-radius: 18px; background: var(--ink); color: #fff;
  font-family: "Outfit", sans-serif; font-size: 64px; font-weight: 700;
}
.pf-tick { position: absolute; width: 16px; height: 16px; border: 2px solid var(--gold); }
.pf-tick-tl { top: -7px; left: -7px; border-right: none; border-bottom: none; }
.pf-tick-br { bottom: -7px; right: -7px; border-left: none; border-top: none; }

/* Sections */
.pf-main { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.pf-section { padding: clamp(40px, 7vw, 72px) 0; border-bottom: 1px solid var(--line); }
.pf-lead { font-size: clamp(20px, 3vw, 28px); font-weight: 500; max-width: 38ch; color: var(--ink); }
.pf-body { font-size: 16px; color: var(--muted); max-width: 62ch; white-space: pre-line; }

.pf-do-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.pf-do-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px; }
.pf-do-card h3 { font-size: 18px; margin-bottom: 8px; }
.pf-do-card p { font-size: 14px; color: var(--muted); }

.pf-chips, .pf-brands { display: flex; flex-wrap: wrap; gap: 10px; }
.pf-chip {
  font-size: 14px; padding: 8px 14px; border-radius: 999px;
  background: var(--card); border: 1px solid var(--line); color: var(--ink);
}
.pf-brand { font-size: 15px; padding: 8px 16px; border-radius: 8px; background: rgba(14,124,134,0.08); color: var(--teal); font-weight: 600; }

.pf-work-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; }
.pf-work-card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.pf-work-card:hover { transform: translateY(-4px); box-shadow: 0 28px 60px -32px rgba(17,22,31,0.4); }
.pf-work-img { aspect-ratio: 4 / 3; overflow: hidden; background: #ECEAE4; }
.pf-work-img img { width: 100%; height: 100%; object-fit: cover; }
.pf-work-body { padding: 20px; }
.pf-work-body h3 { font-size: 18px; margin-bottom: 8px; }
.pf-work-body p { font-size: 14px; color: var(--muted); }
.pf-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.pf-tag { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.04em; padding: 4px 9px; border-radius: 6px; background: rgba(17,22,31,0.05); color: var(--muted); }

.pf-creds { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.pf-creds li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 16px 0; border-top: 1px solid var(--line); }
.pf-creds li:first-child { border-top: none; }
.pf-cred-title { font-weight: 600; font-size: 16px; }
.pf-cred-meta { color: var(--muted); font-size: 14px; }

.pf-quotes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.pf-quote { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 26px; }
.pf-quote blockquote { margin: 0; font-size: 17px; color: var(--ink); }
.pf-quote figcaption { margin-top: 16px; display: flex; flex-direction: column; }
.pf-quote figcaption strong { font-size: 14px; }
.pf-quote figcaption span { font-size: 13px; color: var(--muted); }

.pf-faqs { display: grid; gap: 0; }
.pf-faq { border-top: 1px solid var(--line); padding: 6px 0; }
.pf-faq summary { cursor: pointer; list-style: none; padding: 16px 0; font-weight: 600; font-size: 16px; display: flex; justify-content: space-between; align-items: center; }
.pf-faq summary::-webkit-details-marker { display: none; }
.pf-faq summary::after { content: "+"; color: var(--teal); font-size: 22px; font-weight: 400; }
.pf-faq[open] summary::after { content: "–"; }
.pf-faq p { padding: 0 0 18px; color: var(--muted); font-size: 15px; max-width: 62ch; }

/* Contact */
.pf-contact { background: var(--ink); color: #fff; padding: clamp(48px, 9vw, 96px) 24px; }
.pf-contact > * { max-width: 1080px; margin-left: auto; margin-right: auto; }
.pf-contact h2 { color: #fff; font-size: clamp(32px, 6vw, 56px); margin-top: 12px; }
.pf-contact-links { margin-top: 36px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.pf-contact-links a {
  display: flex; flex-direction: column; gap: 4px; padding: 20px;
  border: 1px solid rgba(255,255,255,0.16); border-radius: 14px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.pf-contact-links a:hover { border-color: var(--gold); background: rgba(255,255,255,0.04); }
.pf-contact-k { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
.pf-contact-v { font-size: 16px; word-break: break-word; }
.pf-credit { margin-top: 40px; font-family: "JetBrains Mono", monospace; font-size: 12px; color: rgba(255,255,255,0.5); }

@media (max-width: 760px) {
  .pf-hero-grid { grid-template-columns: 1fr; }
  .pf-hero-photo { order: -1; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .pf-root * { transition: none !important; }
}
`;
