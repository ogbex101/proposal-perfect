import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ScanLine,
  Crosshair,
  Layers,
  FileText,
  Quote,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CropCard, Eyebrow, Logo } from "@/components/blueprint";
import { HOOKS, STRATEGIES, LENGTHS } from "@/lib/proposal-constants";

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

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <Hero />
      <Pillars />
      <Arsenal />
      <Lengths />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-muted-foreground hover:text-white">
            <Link to="/auth" search={{ mode: "login" }}>
              Log in
            </Link>
          </Button>
          <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div className="bp-rise">
          <Eyebrow index="01">The proposal blueprint</Eyebrow>
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
              className="bg-gold text-primary-foreground hover:bg-gold-bright"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Draft my first proposal
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
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

        <div className="bp-rise" style={{ animationDelay: "120ms" }}>
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

const PILLARS = [
  {
    icon: ScanLine,
    title: "It interprets, never repeats",
    body: "A 2–3 sentence read of what the client actually wants — plus the frustration they're not saying out loud.",
  },
  {
    icon: Crosshair,
    title: "It surfaces hidden needs",
    body: "The unwritten requirement that decides who gets hired. Usually trust, speed, or someone who'll just finish.",
  },
  {
    icon: Layers,
    title: "It maps the technical traps",
    body: "Rate limits, scaling, integrations, responsive gaps — named before you bid, so your pitch sounds senior.",
  },
  {
    icon: FileText,
    title: "It drafts like a human",
    body: "No greeting, no clichés, no 'Dear Hiring Manager'. A hook, your work, one sharp question, one real CTA.",
  },
];

function Pillars() {
  return (
    <section className="border-t border-border/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Eyebrow index="02">What it reads</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">
          Every job post hides a brief. We draft it before you bid.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <CropCard key={p.title} className="p-5">
              <p.icon className="h-5 w-5 text-teal" />
              <h3 className="mt-4 text-base font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </CropCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function Arsenal() {
  return (
    <section className="relative overflow-hidden border-t border-border/60 py-20">
      <div className="bp-grid-lg bp-fade pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5">
        <Eyebrow index="03">The arsenal</Eyebrow>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">
          Fourteen hooks. Eight strategies. One picked for{" "}
          <em className="text-gold not-italic">this</em> client.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          The analyzer recommends the angle most likely to land — and tells you why. Override it any
          time.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
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

function Lengths() {
  return (
    <section className="border-t border-border/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Eyebrow index="04">Pick the format</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
          Sized for the job, not padded for length.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {LENGTHS.map((l, i) => (
            <CropCard key={l.id} glow={i === 1 ? "gold" : "teal"} className="p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold text-white">{l.name}</h3>
                {i === 1 && <span className="annotation !text-gold">Most jobs</span>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l.description}</p>
            </CropCard>
          ))}
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    quote:
      "First proposal I sent with this got a reply in twenty minutes. The hidden-need read was the difference.",
    name: "Freelance developer",
    detail: "Placeholder — early access",
  },
  {
    quote:
      "It stopped me writing the same 'I'm passionate about' opener I'd used for two years. Replies went up.",
    name: "Web designer",
    detail: "Placeholder — early access",
  },
  {
    quote:
      "The technical-traps section makes me sound like I've already started the job before I'm hired.",
    name: "Full-stack contractor",
    detail: "Placeholder — early access",
  },
];

function Testimonials() {
  return (
    <section className="border-t border-border/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Eyebrow index="05">From the field</Eyebrow>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <CropCard key={t.quote} className="flex flex-col p-6">
              <Quote className="h-5 w-5 text-gold/70" />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">{t.quote}</p>
              <div className="mt-5">
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="annotation mt-0.5 !text-muted-foreground">{t.detail}</p>
              </div>
            </CropCard>
          ))}
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
    <section className="relative overflow-hidden border-t border-border/60 py-24">
      <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
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
        <div className="mt-9">
          <Button
            asChild
            size="lg"
            className="bg-gold text-primary-foreground hover:bg-gold-bright"
          >
            <Link to="/auth" search={{ mode: "signup" }}>
              Draft my first proposal
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
        <Logo />
        <p className="font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} Xperience Props · Proposals that convert.
        </p>
      </div>
    </footer>
  );
}
