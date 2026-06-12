import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ScanLine,
  Layers,
  FileText,
  Quote,
  Check,
  Sparkles,
  Target,
  PenLine,
  Send,
  Clipboard,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CropCard, Eyebrow, Logo } from "@/components/blueprint";
import { HOOKS, STRATEGIES } from "@/lib/proposal-constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Xperience Props — Proposals That Convert. Not Generic. Just Human." },
      {
        name: "description",
        content:
          "Paste a freelance job post. Get a strategist's read and a human, conversion-tuned proposal — no templates, no 'Dear Hiring Manager'.",
      },
    ],
  }),
  component: Landing,
});

const SAMPLE_JOB = `Need a developer to fix our Shopify store. Pages load slow, checkout drops customers, and our last dev disappeared mid-project. Looking for someone reliable who can actually finish. Budget around $1500. Please start your reply with the word "blueprint" so I know you read this.`;

const IMG = {
  hero: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1200&q=80",
  analytics:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80",
  writing:
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80",
  success:
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1000&q=80",
};

/* Toggle `.is-revealed` on `.reveal` elements as they scroll into view. */
function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Landing() {
  useScrollReveal();
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <Hero />
      <TrustedBy />
      <Features />
      <HowItWorks />
      <Stats />
      <Arsenal />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  );
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#arsenal", label: "Why it works" },
];

function NavBar() {
  const scrolled = useScrolled();
  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-white">
            <Link to="/auth" search={{ mode: "login" }}>
              Sign in
            </Link>
          </Button>
          <Button
            asChild
            className="bg-gold text-primary-foreground shadow-lg shadow-gold/20 transition-transform hover:bg-gold-bright hover:-translate-y-0.5"
          >
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/* Soft blurred accent orb */
function Orb({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bp-orb pointer-events-none absolute rounded-full blur-3xl ${className ?? ""}`}
    />
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-70" />
      <Orb className="-left-24 -top-20 h-[26rem] w-[26rem] bg-teal/15" />
      <Orb className="-right-16 top-24 h-[30rem] w-[30rem] bg-gold/10" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24">
        <div className="bp-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal/25 bg-teal/5 px-3 py-1 text-xs font-medium text-teal">
            <Sparkles className="h-3.5 w-3.5" />
            AI proposals tuned for replies
          </span>
          <h1 className="mt-5 font-display text-[2.7rem] font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl">
            Proposals that convert.
            <br />
            <span className="text-gradient-gold">Not generic. Just human.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Paste a job post. Xperience Props reads it like a senior freelancer would — the real
            pain, the unspoken need, the technical traps — then drafts a pitch built to get a reply.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gold text-primary-foreground shadow-lg shadow-gold/20 transition-transform hover:bg-gold-bright hover:-translate-y-0.5"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Start free
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border bg-card/40 text-white transition-transform hover:-translate-y-0.5 hover:bg-card/70"
            >
              <a href="#how">See how it works</a>
            </Button>
            <span className="annotation">No card. Free to start.</span>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs text-muted-foreground">
            <span>
              <span className="text-gold">14</span> psychological hooks
            </span>
            <span>
              <span className="text-gold">8</span> proposal strategies
            </span>
            <span>
              <span className="text-gold">0</span> forbidden clichés
            </span>
          </div>
        </div>

        <div className="relative bp-rise" style={{ animationDelay: "120ms" }}>
          {/* Hero mockup image with glow */}
          <div className="img-frame">
            <img
              src={IMG.hero}
              alt="A freelancer's focused workspace at dusk"
              width={1200}
              height={800}
              loading="eager"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Floating accent cards */}
          <div className="bp-float absolute -left-5 top-8 hidden sm:block">
            <CropCard glow="teal" className="px-4 py-3">
              <p className="annotation !text-teal">Response rate</p>
              <p className="mt-1 font-display text-2xl font-bold text-white">42%</p>
            </CropCard>
          </div>
          <div className="bp-float-slow absolute -bottom-6 -right-4 hidden sm:block">
            <CropCard glow="gold" className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-gold/40 bg-gold/10">
                <Sparkles className="h-4 w-4 text-gold" />
              </span>
              <div>
                <p className="annotation !text-gold">Generated in</p>
                <p className="font-display text-lg font-bold text-white">8 seconds</p>
              </div>
            </CropCard>
          </div>
        </div>
      </div>

      {/* Inline live demo below the fold of the hero grid */}
      <div className="relative mx-auto max-w-3xl px-5 pb-24">
        <div className="reveal">
          <LiveDemo />
        </div>
      </div>
    </section>
  );
}

type DemoStage = "idle" | "analyzing" | "analyzed" | "drafting" | "drafted";

function LiveDemo() {
  const [job, setJob] = useState(SAMPLE_JOB);
  const [stage, setStage] = useState<DemoStage>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function run() {
    timers.current.forEach(clearTimeout);
    setStage("analyzing");
    timers.current = [
      setTimeout(() => setStage("analyzed"), 1100),
      setTimeout(() => setStage("drafting"), 2100),
      setTimeout(() => setStage("drafted"), 3300),
    ];
  }

  const busy = stage === "analyzing" || stage === "drafting";

  return (
    <CropCard glow="gold" className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <span className="annotation">Live demo · draft preview</span>
        <span className="font-mono text-[10px] text-muted-foreground">{job.length} chars</span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <label className="annotation mb-1.5 block !text-muted-foreground">Job post</label>
          <Textarea
            value={job}
            onChange={(e) => setJob(e.target.value)}
            rows={4}
            className="resize-none border-border bg-background/60 text-sm leading-relaxed"
          />
        </div>

        <Button
          onClick={run}
          disabled={busy || job.trim().length < 10}
          className="w-full bg-teal/15 text-teal hover:bg-teal/25"
        >
          {stage === "analyzing" ? (
            <>
              <ScanLine className="mr-1 h-4 w-4 animate-pulse" /> Reading the brief…
            </>
          ) : stage === "drafting" ? (
            <>
              <FileText className="mr-1 h-4 w-4 animate-pulse" /> Drafting proposal…
            </>
          ) : (
            <>
              <ScanLine className="mr-1 h-4 w-4" /> Analyze &amp; draft
            </>
          )}
        </Button>

        {(stage === "analyzed" || stage === "drafting" || stage === "drafted") && (
          <div className="space-y-2 rounded-md border border-teal/20 bg-teal/5 p-3 bp-rise">
            <DemoRow label="Real pain" value="A burned client who got ghosted mid-build." />
            <DemoRow label="Hidden need" value="Proof you'll actually finish — not just skill." />
            <DemoRow label="Hook" value="Shared Frustration → Problem-Solution" />
            <DemoRow label="Tell" value='Says "blueprint" — they screen for readers.' />
          </div>
        )}

        {stage === "drafted" && (
          <div className="rounded-md border border-gold/30 bg-gold/[0.06] p-3 text-sm leading-relaxed text-foreground/90 bp-rise">
            <p className="annotation mb-2 !text-gold">Blueprint · generated draft</p>
            <p>
              Blueprint — and the reason your last dev vanished is the same reason your checkout
              leaks: nobody scoped the slow queries before touching the theme.
            </p>
            <p className="mt-2">
              I'd profile the store first, fix what's actually dropping carts, then harden the
              checkout so it stops costing you sales. You'd approve each step before I move on.
            </p>
            <p className="mt-2 text-muted-foreground">
              What's the one thing the last developer left half-finished that's hurting most right
              now?
            </p>
          </div>
        )}
      </div>
    </CropCard>
  );
}

function DemoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="annotation mt-0.5 w-24 shrink-0 !text-teal">{label}</span>
      <span className="text-foreground/85">{value}</span>
    </div>
  );
}

const TRUST_MARKS = [
  "Upwork",
  "Fiverr",
  "Toptal",
  "Contra",
  "Freelancer",
  "PeoplePerHour",
  "Workana",
  "Guru",
];

function TrustedBy() {
  return (
    <section className="border-y border-border/60 bg-surface/40 py-10">
      <div className="mx-auto max-w-6xl px-5">
        <p className="annotation text-center !text-muted-foreground">
          Built for proposals across every freelance marketplace
        </p>
        <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="bp-marquee flex w-max gap-4">
            {[...TRUST_MARKS, ...TRUST_MARKS].map((m, i) => (
              <span
                key={`${m}-${i}`}
                className="whitespace-nowrap rounded-md border border-border bg-card/50 px-5 py-2 font-display text-sm font-semibold tracking-tight text-foreground/70"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: ScanLine,
    eyebrow: "Analyze",
    title: "Read any job post like a strategist",
    body: "Xperience Props interprets the brief — the real pain, the unspoken requirement, and the technical traps hiding between the lines. You bid knowing what actually wins the gig.",
    points: ["Surfaces the hidden need that decides the hire", "Maps technical traps before you quote"],
    img: IMG.analytics,
    alt: "Analytics dashboard showing performance metrics",
  },
  {
    icon: PenLine,
    eyebrow: "Generate",
    title: "Human proposals, zero AI filler",
    body: "No 'Dear Hiring Manager'. No 'I'm passionate about'. Just a sharp hook, your relevant work, one real question, and a CTA that earns a reply — written in your voice.",
    points: ["14 psychological hooks, 8 proven strategies", "Picks the angle most likely to land"],
    img: IMG.writing,
    alt: "Person writing a proposal in a notebook",
  },
  {
    icon: Layers,
    eyebrow: "Tailor",
    title: "A portfolio shaped to the job in seconds",
    body: "Pull the work that matters for this client, framed around their problem — not a generic gallery. Each proposal arrives sized for the job, never padded for length.",
    points: ["Brief, robust, or explanatory formats", "Relevant proof, automatically matched"],
    img: IMG.team,
    alt: "A team collaborating around a laptop",
  },
];

function Features() {
  return (
    <section id="features" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal mx-auto max-w-2xl text-center">
          <Eyebrow index="01">What it does</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            Every job post hides a brief. <span className="text-gradient-gold">We draft it before you bid.</span>
          </h2>
        </div>

        <div className="mt-16 space-y-20">
          {FEATURES.map((f, i) => {
            const reversed = i % 2 === 1;
            return (
              <div
                key={f.title}
                className="reveal grid items-center gap-10 lg:grid-cols-2"
              >
                <div className={reversed ? "lg:order-2" : ""}>
                  <Eyebrow index={`0${i + 1}`}>{f.eyebrow}</Eyebrow>
                  <h3 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
                    {f.title}
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-sm text-foreground/90">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-teal/40 bg-teal/10">
                          <Check className="h-3 w-3 text-teal" />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={`group relative ${reversed ? "lg:order-1" : ""}`}>
                  <div
                    aria-hidden
                    className={`bp-orb pointer-events-none absolute -inset-6 -z-10 rounded-3xl blur-3xl ${
                      reversed ? "bg-gold/10" : "bg-teal/10"
                    }`}
                  />
                  <div className="img-frame lift transition-transform duration-300 group-hover:-translate-y-1">
                    <img
                      src={f.img}
                      alt={f.alt}
                      width={1000}
                      height={667}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Clipboard, title: "Paste the job post", body: "Drop in any brief from any marketplace. No formatting needed." },
  { icon: Target, title: "Get the strategist's read", body: "See the real pain, hidden need, and the recommended angle — with the why." },
  { icon: PenLine, title: "Generate a human draft", body: "A conversion-tuned proposal in your voice, sized for the job." },
  { icon: Send, title: "Send and get a reply", body: "Tweak, copy, and pitch. Then watch your response rate climb." },
];

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden border-b border-border/60 py-24">
      <div className="bp-grid-lg bp-fade pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5">
        <div className="reveal mx-auto max-w-2xl text-center">
          <Eyebrow index="02">How it works</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            From job post to reply in four steps
          </h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <CropCard className="lift glow-teal h-full p-6">
                <span className="font-mono text-xs text-gold/80">{`0${i + 1}`}</span>
                <span className="mt-3 grid h-10 w-10 place-items-center rounded-lg border border-teal/30 bg-teal/5">
                  <s.icon className="h-5 w-5 text-teal" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CropCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: "10x", label: "faster than writing from scratch" },
  { value: "42%", label: "average response rate" },
  { value: "5min", label: "to a tailored portfolio" },
  { value: "0", label: "forbidden clichés, ever" },
];

function Stats() {
  return (
    <section className="border-b border-border/60 bg-surface/40 py-16">
      <div className="reveal mx-auto grid max-w-5xl grid-cols-2 gap-8 px-5 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-4xl font-extrabold tracking-tight text-gradient-gold sm:text-5xl">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Arsenal() {
  return (
    <section id="arsenal" className="relative overflow-hidden border-b border-border/60 py-24">
      <div className="bp-grid-lg bp-fade pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5">
        <div className="reveal">
          <Eyebrow index="03">The arsenal</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">
            Fourteen hooks. Eight strategies. One picked for{" "}
            <em className="text-gold not-italic">this</em> client.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            The analyzer recommends the angle most likely to land — and tells you why. Override it
            any time.
          </p>
        </div>

        <div className="reveal mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="annotation mb-3">Hooks</p>
            <div className="flex flex-wrap gap-2">
              {HOOKS.map((h) => (
                <span
                  key={h.id}
                  className="rounded-md border border-border bg-card/60 px-3 py-1.5 font-mono text-xs text-foreground/80 transition-colors hover:border-teal/50 hover:text-teal"
                >
                  {h.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="annotation mb-3">Strategies</p>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.map((s) => (
                <span
                  key={s.id}
                  className="rounded-md border border-border bg-card/60 px-3 py-1.5 font-mono text-xs text-foreground/80 transition-colors hover:border-gold/50 hover:text-gold"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    quote:
      "First proposal I sent with this got a reply in twenty minutes. The hidden-need read was the difference.",
    name: "Marcus D.",
    role: "Freelance developer",
    initials: "MD",
  },
  {
    quote:
      "It stopped me writing the same 'I'm passionate about' opener I'd used for two years. Replies went up.",
    name: "Priya K.",
    role: "Web designer",
    initials: "PK",
  },
  {
    quote:
      "The technical-traps section makes me sound like I've already started the job before I'm hired.",
    name: "Sam R.",
    role: "Full-stack contractor",
    initials: "SR",
  },
];

function Testimonials() {
  return (
    <section className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow index="04">From the field</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              Freelancers who stopped sounding like everyone else
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Real read, real voice, real replies. The difference shows up in your inbox.
            </p>
            <div className="img-frame lift mt-8 max-w-sm">
              <img
                src={IMG.success}
                alt="A successful handshake closing a deal"
                width={1000}
                height={667}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {TESTIMONIALS.map((t) => (
              <CropCard key={t.name} className="lift glow-gold flex flex-col p-6">
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <Quote className="mt-3 h-5 w-5 text-gold/50" />
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{t.quote}</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-teal/30 bg-teal/10 font-mono text-xs font-semibold text-teal">
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CropCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const points = [
    "Paste a job post",
    "Get the strategist's read",
    "Send a proposal that gets a reply",
  ];
  return (
    <section className="relative overflow-hidden py-28">
      <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-60" />
      <Orb className="left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 bg-gold/10" />
      <div className="reveal relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Stop sending proposals that{" "}
          <span className="text-gradient-gold">sound like everyone</span>.
        </h2>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-teal" /> {p}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-gold text-primary-foreground shadow-lg shadow-gold/25 transition-transform hover:bg-gold-bright hover:-translate-y-0.5"
          >
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-border bg-card/40 text-white transition-transform hover:-translate-y-0.5 hover:bg-card/70"
          >
            <Link to="/auth" search={{ mode: "login" }}>
              Sign in
            </Link>
          </Button>
        </div>
        <p className="annotation mt-5 !text-muted-foreground">No card required · Free to start</p>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#arsenal", label: "Why it works" },
];

function Footer() {
  return (
    <footer className="border-t border-border/60 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center gap-6">
          {FOOTER_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="text-sm text-muted-foreground transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </nav>
        <p className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} Xperience Props
        </p>
      </div>
    </footer>
  );
}
