import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, ScanLine, Layers, FileText, Quote, Check,
  Sparkles, Target, PenLine, Send, Clipboard, Star,
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
        content: "Paste a freelance job post. Get a strategist's read and a human, conversion-tuned proposal — no templates, no 'Dear Hiring Manager'.",
      },
    ],
  }),
  component: Landing,
});

const SAMPLE_JOB = `Need a developer to fix our Shopify store. Pages load slow, checkout drops customers, and our last dev disappeared mid-project. Looking for someone reliable who can actually finish. Budget around $1500. Please start your reply with the word "blueprint" so I know you read this.`;

// ─── FadingVideo ──────────────────────────────────────────────────────────────

const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55;

function FadingVideo({
  src, className, style,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function fadeTo(target: number, duration: number) {
      cancelAnimationFrame(rafRef.current);
      const startTime = performance.now();
      const from = parseFloat(video!.style.opacity) || 0;
      function step(now: number) {
        const t = Math.min((now - startTime) / duration, 1);
        video!.style.opacity = String(from + (target - from) * t);
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function onLoadedData() {
      video!.style.opacity = "0";
      video!.play().catch(() => {});
      fadeTo(1, FADE_MS);
    }

    function onTimeUpdate() {
      const remaining = video!.duration - video!.currentTime;
      if (!fadingOutRef.current && remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadingOutRef.current = true;
        fadeTo(0, FADE_MS);
      }
    }

    function onEnded() {
      video!.style.opacity = "0";
      setTimeout(() => {
        video!.currentTime = 0;
        video!.play().catch(() => {});
        fadingOutRef.current = false;
        fadeTo(1, FADE_MS);
      }, 100);
    }

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      style={{ ...style, opacity: 0 }}
      className={className}
    />
  );
}

// ─── BlurText ─────────────────────────────────────────────────────────────────

function BlurText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const words = text.split(" ");

  return (
    <p
      ref={ref}
      className={className}
      style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", rowGap: "0.1em" }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          animate={isInView ? {
            filter: ["blur(10px)", "blur(5px)", "blur(0px)"],
            opacity: [0, 0.5, 1],
            y: [50, -5, 0],
          } : {}}
          transition={{
            duration: 0.7,
            times: [0, 0.5, 1],
            ease: "easeOut",
            delay: (i * 100) / 1000,
          }}
          style={{ display: "inline-block", marginRight: "0.28em" }}
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────

function useScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─── Entrance animation variant ───────────────────────────────────────────────

const fadeUp = {
  initial: { filter: "blur(10px)", opacity: 0, y: 20 },
  animate: { filter: "blur(0px)", opacity: 1, y: 0 },
};

// ─── Landing ──────────────────────────────────────────────────────────────────

function Landing() {
  useScrollReveal();
  return (
    <div className="bg-black">
      <HeroSection />
      <CapabilitiesSection />
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

// ─── Hero Section ─────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#arsenal", label: "The Arsenal" },
];

function HeroSection() {
  return (
    <section className="relative h-screen overflow-hidden bg-black">
      {/* Background video — 120% width, top-anchored */}
      <FadingVideo
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4"
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
        style={{ width: "120%", height: "120%" }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex h-full flex-col">
        <Navbar />

        {/* Hero content */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-16 text-center">

          {/* Badge */}
          <motion.div
            {...fadeUp}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }}
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-1.5 py-1.5"
          >
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">New</span>
            <span className="pr-3 text-sm text-white/90 font-body">
              Xperience Props 2.0 — AI Proposal Engine, Now Live
            </span>
          </motion.div>

          {/* Headline */}
          <div className="mt-6">
            <BlurText
              text="Write Proposals That Win. Stand Out. Get Hired."
              className="text-6xl md:text-7xl lg:text-[5.5rem] font-heading italic text-white leading-[0.9] max-w-3xl tracking-[-4px]"
            />
          </div>

          {/* Subheading */}
          <motion.p
            {...fadeUp}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.8 }}
            className="mt-6 max-w-xl text-sm md:text-base text-white font-body font-light leading-tight"
          >
            Paste a job post. Xperience Props reads the real pain, maps the unspoken need, and
            crafts a human, conversion-tuned proposal — in under 10 seconds.
          </motion.p>

          {/* CTAs */}
          <motion.div
            {...fadeUp}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 1.1 }}
            className="mt-6 flex items-center gap-6"
          >
            <Link to="/auth" search={{ mode: "signup" }}>
              <button className="liquid-glass-strong flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white font-body">
                Start Writing Free <ArrowUpRightIcon className="h-5 w-5" />
              </button>
            </Link>
            <a href="#how" className="flex items-center gap-2 text-sm font-medium text-white font-body">
              <PlayIcon className="h-4 w-4" />
              See How It Works
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            {...fadeUp}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 1.3 }}
            className="mt-8 flex items-stretch gap-4"
          >
            <StatCard
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
              value="42%"
              label="Avg. Reply Rate on Proposals"
            />
            <StatCard
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              }
              value="10x"
              label="Faster Than Writing From Scratch"
            />
          </motion.div>
        </div>

        {/* Partners row */}
        <motion.div
          {...fadeUp}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 1.4 }}
          className="flex flex-col items-center gap-4 pb-8"
        >
          <div className="liquid-glass rounded-full px-3.5 py-1 text-xs font-medium text-white font-body">
            Trusted by freelancers across every major marketplace
          </div>
          <div className="flex items-center gap-12 md:gap-16">
            {["Upwork", "Fiverr", "Toptal", "Contra", "Guru"].map((name) => (
              <span
                key={name}
                className="font-heading italic text-white text-2xl md:text-3xl tracking-tight"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({
  icon, value, label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="liquid-glass flex w-[220px] flex-col rounded-[1.25rem] p-5">
      <div className="mb-3">{icon}</div>
      <p className="font-heading italic text-white text-4xl tracking-[-1px] leading-none">{value}</p>
      <p className="mt-2 text-xs text-white font-body font-light">{label}</p>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <nav className="fixed left-0 right-0 top-4 z-50 flex items-center justify-between px-8 lg:px-16">
      {/* Logo */}
      <div className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full">
        <span className="font-heading italic text-white text-xl leading-none">x</span>
      </div>

      {/* Center pill — desktop only */}
      <div className="hidden md:flex liquid-glass items-center rounded-full px-1.5 py-1.5 gap-1">
        {NAV_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="px-3 py-2 text-sm font-medium text-white/90 font-body rounded-full hover:bg-white/10 transition-colors"
          >
            {l.label}
          </a>
        ))}
        <Link to="/auth" search={{ mode: "signup" }}>
          <button className="ml-1 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-black font-body whitespace-nowrap">
            Get Started <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>

      {/* Spacer to balance logo */}
      <div className="h-12 w-12" aria-hidden />
    </nav>
  );
}

// ─── Capabilities Section ─────────────────────────────────────────────────────

const CAPABILITY_CARDS = [
  {
    title: "Job Decoder",
    body: "AI reads your brief like a senior freelancer — surfacing the real pain, the hidden requirement, and the technical traps that kill bids before you write a word.",
    tags: ["Pain Mapping", "Hidden Needs", "Tech Traps", "Bid Intel"],
    iconPath: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  },
  {
    title: "Smart Proposals",
    body: "No 'Dear Hiring Manager'. A sharp hook, your relevant work, one real question, and a CTA that earns a reply — written to sound like you, not a template.",
    tags: ["14 Hooks", "8 Strategies", "Your Voice", "Zero Clichés"],
    iconPath: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  },
  {
    title: "Portfolio Match",
    body: "Pull the work that matters for this client, shaped around their problem — not a generic gallery. Each proposal arrives with perfectly matched, AI-curated proof.",
    tags: ["Auto-Curate", "Job-Aligned", "AI Generated", "Proof First"],
    iconPath: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
  },
];

function CapabilitiesSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      {/* Background video — full bleed */}
      <FadingVideo
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col px-8 md:px-16 lg:px-20 pt-24 pb-10">
        {/* Header */}
        <div className="mb-auto">
          <p className="text-sm font-body text-white/80 mb-6">// Features</p>
          <h2
            className="font-heading italic text-white text-6xl md:text-7xl lg:text-[6rem] leading-[0.9] tracking-[-3px]"
          >
            Proposals<br />evolved
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {CAPABILITY_CARDS.map((card) => (
            <div
              key={card.title}
              className="liquid-glass flex min-h-[360px] flex-col rounded-[1.25rem] p-6"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                {/* Icon box */}
                <div className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.75rem]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor">
                    <path d={card.iconPath} />
                  </svg>
                </div>
                {/* Tags */}
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="liquid-glass rounded-full px-3 py-1 text-[11px] text-white/90 font-body whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Bottom */}
              <div className="mt-6">
                <h3 className="font-heading italic text-white text-3xl md:text-4xl tracking-[-1px] leading-none">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm text-white/90 font-body font-light leading-snug max-w-[32ch]">
                  {card.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TrustedBy ────────────────────────────────────────────────────────────────

const TRUST_MARKS = [
  "Upwork", "Fiverr", "Toptal", "Contra", "Freelancer", "PeoplePerHour", "Workana", "Guru",
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

// ─── Features ─────────────────────────────────────────────────────────────────

const IMG = {
  analytics: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80",
  writing: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80",
  team: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80",
  success: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1000&q=80",
};

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
    <section id="features" className="border-b border-border/60 py-24 bg-background">
      <div className="mx-auto max-w-6xl px-5">
        <div className="reveal mx-auto max-w-2xl text-center">
          <Eyebrow index="01">What it does</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
            Every job post hides a brief.{" "}
            <span className="text-gradient-gold">We draft it before you bid.</span>
          </h2>
        </div>

        <div className="mt-16 space-y-20">
          {FEATURES.map((f, i) => {
            const reversed = i % 2 === 1;
            return (
              <div key={f.title} className="reveal grid items-center gap-10 lg:grid-cols-2">
                <div className={reversed ? "lg:order-2" : ""}>
                  <Eyebrow index={`0${i + 1}`}>{f.eyebrow}</Eyebrow>
                  <h3 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">{f.title}</h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{f.body}</p>
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
                    className={`bp-orb pointer-events-none absolute -inset-6 -z-10 rounded-3xl blur-3xl ${reversed ? "bg-gold/10" : "bg-teal/10"}`}
                  />
                  <div className="img-frame lift transition-transform duration-300 group-hover:-translate-y-1">
                    <img src={f.img} alt={f.alt} width={1000} height={667} loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
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

// ─── Live Demo ────────────────────────────────────────────────────────────────

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
          <Textarea value={job} onChange={(e) => setJob(e.target.value)} rows={4}
            className="resize-none border-border bg-background/60 text-sm leading-relaxed" />
        </div>
        <Button onClick={run} disabled={busy || job.trim().length < 10}
          className="w-full bg-teal/15 text-teal hover:bg-teal/25">
          {stage === "analyzing" ? (
            <><ScanLine className="mr-1 h-4 w-4 animate-pulse" /> Reading the brief…</>
          ) : stage === "drafting" ? (
            <><FileText className="mr-1 h-4 w-4 animate-pulse" /> Drafting proposal…</>
          ) : (
            <><ScanLine className="mr-1 h-4 w-4" /> Analyze &amp; draft</>
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
            <p>Blueprint — and the reason your last dev vanished is the same reason your checkout leaks: nobody scoped the slow queries before touching the theme.</p>
            <p className="mt-2">I'd profile the store first, fix what's actually dropping carts, then harden the checkout so it stops costing you sales. You'd approve each step before I move on.</p>
            <p className="mt-2 text-muted-foreground">What's the one thing the last developer left half-finished that's hurting most right now?</p>
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

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  { icon: Clipboard, title: "Paste the job post", body: "Drop in any brief from any marketplace. No formatting needed." },
  { icon: Target, title: "Get the strategist's read", body: "See the real pain, hidden need, and the recommended angle — with the why." },
  { icon: PenLine, title: "Generate a human draft", body: "A conversion-tuned proposal in your voice, sized for the job." },
  { icon: Send, title: "Send and get a reply", body: "Tweak, copy, and pitch. Then watch your response rate climb." },
];

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden border-b border-border/60 py-24 bg-background">
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

        {/* Live demo below how-it-works */}
        <div className="reveal mt-16 max-w-3xl mx-auto">
          <LiveDemo />
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

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
            <p className="font-display text-4xl font-extrabold tracking-tight text-gradient-gold sm:text-5xl">{s.value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Arsenal ──────────────────────────────────────────────────────────────────

function Arsenal() {
  return (
    <section id="arsenal" className="relative overflow-hidden border-b border-border/60 py-24 bg-background">
      <div className="bp-grid-lg bp-fade pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-6xl px-5">
        <div className="reveal">
          <Eyebrow index="03">The arsenal</Eyebrow>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">
            Fourteen hooks. Eight strategies. One picked for{" "}
            <em className="text-gold not-italic">this</em> client.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            The analyzer recommends the angle most likely to land — and tells you why. Override it any time.
          </p>
        </div>
        <div className="reveal mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="annotation mb-3">Hooks</p>
            <div className="flex flex-wrap gap-2">
              {HOOKS.map((h) => (
                <span key={h.id}
                  className="rounded-md border border-border bg-card/60 px-3 py-1.5 font-mono text-xs text-foreground/80 transition-colors hover:border-teal/50 hover:text-teal">
                  {h.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="annotation mb-3">Strategies</p>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.map((s) => (
                <span key={s.id}
                  className="rounded-md border border-border bg-card/60 px-3 py-1.5 font-mono text-xs text-foreground/80 transition-colors hover:border-gold/50 hover:text-gold">
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

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { quote: "First proposal I sent with this got a reply in twenty minutes. The hidden-need read was the difference.", name: "Marcus D.", role: "Freelance developer", initials: "MD" },
  { quote: "It stopped me writing the same 'I'm passionate about' opener I'd used for two years. Replies went up.", name: "Priya K.", role: "Web designer", initials: "PK" },
  { quote: "The technical-traps section makes me sound like I've already started the job before I'm hired.", name: "Sam R.", role: "Full-stack contractor", initials: "SR" },
];

function Testimonials() {
  return (
    <section className="border-b border-border/60 py-24 bg-background">
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
              <img src={IMG.success} alt="A successful handshake closing a deal" width={1000} height={667}
                loading="lazy" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="grid gap-4">
            {TESTIMONIALS.map((t) => (
              <CropCard key={t.name} className="lift glow-gold flex flex-col p-6">
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
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

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  const points = ["Paste a job post", "Get the strategist's read", "Send a proposal that gets a reply"];
  return (
    <section className="relative overflow-hidden py-28 bg-background">
      <div className="bp-grid bp-fade pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl bp-orb" />
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
          <Button asChild size="lg"
            className="bg-gold text-primary-foreground shadow-lg shadow-gold/25 transition-transform hover:bg-gold-bright hover:-translate-y-0.5">
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline"
            className="border-border bg-card/40 text-white transition-transform hover:-translate-y-0.5 hover:bg-card/70">
            <Link to="/auth" search={{ mode: "login" }}>Sign in</Link>
          </Button>
        </div>
        <p className="annotation mt-5 !text-muted-foreground">No card required · Free to start</p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

const FOOTER_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#arsenal", label: "Why it works" },
];

function Footer() {
  return (
    <footer className="border-t border-border/60 py-12 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center gap-6">
          {FOOTER_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-white">
              {l.label}
            </a>
          ))}
          <Link to="/auth" search={{ mode: "login" }}
            className="text-sm text-muted-foreground transition-colors hover:text-white">
            Sign in
          </Link>
        </nav>
        <p className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} Xperience Props</p>
      </div>
    </footer>
  );
}
