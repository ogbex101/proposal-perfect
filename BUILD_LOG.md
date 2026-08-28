# Build Log & System Continuity

> This file is the **first thing a new Claude Code session should read** before touching
> this codebase. It explains how the system works today, what has been fixed and why, and
> what is still open — written for someone with zero prior context. The "Current
> Architecture Overview" is kept rewritten-to-accurate (not just appended). The
> chronological log below it records each meaningful change.

---

## Current Architecture Overview

**What this app is:** a freelance proposal-generation system (TanStack Start + React +
Supabase). A user pastes a job post; the app analyzes it, then generates a tailored
proposal (and conversion-chat replies, scout outreach, strategy docs, portfolios).

**The intelligence pipeline (the "brain")** — `src/lib/proposal-intelligence.ts`:
four sequential AI engines, each consuming only the prior engine's structured output
(no engine re-reads the raw job post after Engine 1):
1. **Engine 1 — Client Intelligence** (analyzer/Gemini): WHO wrote the post — personality,
   communication style, hiring maturity, emotional state, budget sensitivity, risk
   tolerance. Also chooses `recommendedRegisterId` (the voice to speak AS) and extracts
   all factual data downstream engines need.
2. **Engine 2 — Business Intelligence** (analyzer/Gemini): the business behind the project
   — model, audience, core problem/opportunity/risk/insight.
3. **Engine 3 — Client Psychology** (writer/Claude): WHY they're really hiring — primary
   fear/desire, urgency, real reason, what makes them reply/ignore/hire/reject.
4. **Engine 4 — Proposal Blueprint** (writer/Claude): the persuasion architecture —
   `primaryStrategy`, ready-to-use `openingLine` + `ctaLine`, mandates, forbidden
   approaches, `alternativeHooks` (3 options), `mappedHookId/StrategyId/CtaId` (for UI),
   and the **Golden Key decision** (whether/which/where to use a framing sentence).

The pipeline returns a `ProposalIntelligenceObject` with per-engine confidence and an
`overallConfidence`; `requiresHumanReview` is true under 75.

**Provider routing** — `src/lib/ai-gateway.server.ts`: role→provider map with a
full-waterfall fallback. `writer`→Claude Sonnet (client-facing prose), `analyzer`→Gemini
Flash (extraction), `verifier`→Gemini Flash (scoring/gating/translation),
`challenger`→Mistral (utility gen). The comment block lists the real functions per role.

**Proposal generation** — `src/lib/ai.functions.ts` `generateProposal`: builds a big
system prompt from the intelligence object (register, tone dials, hook/strategy/CTA,
Golden Key), calls the writer, then runs guards: specificity gate (retry once), CTA
enforcer (last paragraph must end with "?"), and the **fabrication guard** (see Fix 7).
Returns `{ content, explanation, factCheck }` and auto-saves to proposal memory.

**Shared prompt vocabularies** — `src/lib/proposal-constants.ts` (HOOKS, STRATEGIES, CTAS,
LENGTHS) is the single source of truth; Engine 4's mapping IDs mirror it exactly.
`src/lib/prompts/shared/registers.ts` (4 voices) and `.../golden-keys.ts` (20 framing
sentences) are client-safe shared libraries.

**Key frontend:** `src/routes/_authenticated/new.tsx` is the main proposal workspace
(analysis panel, config, output panel). `portfolio.tsx` manages portfolio entries + tags.
`PortfolioPicker.tsx` attaches a portfolio (paste / saved / curate-real / generate-AI).

**Round 1 (prior session), summary:** unified the strategy/CTA ID vocabularies so Engine
4's choices stop silently falling back to index 0; fixed the 3-hook-suggestions feature
(`alternativeHooks`); upgraded the writer model; added register selection end-to-end.

---

## Chronological Log

## 2026-06-26 — Round 2: Fixes 7–12 + this Build Log page

**Problem:** Five gaps surfaced after Round 1, one of them serious. (1) A live test
proved the generator would **fabricate case studies and metrics** — it invented three
Klaviyo rebuilds with made-up percentages that had no source in the input. A client could
ask to see them and there'd be nothing real. (2) No way to cancel an in-flight job
analysis. (3) No system to tag portfolio pieces by niche and auto-match them to a job.
(4) The "AI portfolio" feature risked the same fabrication problem one layer earlier.
(5) No English preview for non-English proposals. (6) The user's signature "framing
sentence" patterns weren't systematized. Plus: a second Claude Code account needs to be
able to pick this project up cold — hence this file.

**Solution:**
- **Fix 7 (fabrication guard):** hard "NO FABRICATION" rule added to `generateProposal`
  (primary + retry prompts), `craftHookLine`, `craftCtaLine` — any number/stat/case
  study/named-client-result not in the job post, portfolio, or user input is forbidden,
  with a ❌/✅ example pair. Backed by `verifyFactualClaims()` (new, in
  `ai-gateway.server.ts`): a Gemini pass that lists every checkable claim and flags any
  not traceable to the supplied sources. `generateProposal` runs it, attempts one
  automatic remediation rewrite (strip/replace only fabricated claims), re-checks, and
  returns a `factCheck` object. The UI shows an amber warning listing remaining flagged
  claims and **blocks "Mark as submitted"** until the user confirms.
- **Fix 8 (cancel analysis):** `AbortController` + run-token on the analyze mutation; a
  Cancel button aborts and fully clears analysis state; starting a new analysis clears the
  previous result first.
- **Fix 9 (portfolio niche tagging):** migration adds the `niche_tags text[]` column
  (code referenced it but it never existed). Portfolio page gets a freeform tag editor +
  suggested chips. Auto-match scores each portfolio's tags against detected niche +
  entities + job text; a "Auto-matched … based on detected skills …" indicator shows in
  the generation UI, overridable.
- **Fix 10 (curation, NOT fabrication):** `curateRealPortfolio` server fn orders the
  user's REAL tagged entries by relevance and writes an honest framing paragraph with a
  hard no-invention guard; if nothing matches it returns a "add matching content" note.
  New "Curate real" mode in `PortfolioPicker`. It never invents projects, metrics, or
  visuals — that's the deliberate contrast with the older `generatePortfolio`.
- **Fix 11 (English preview):** `translateToEnglish` (verifier role). When
  `analysis.detectedLanguage` isn't English, a "Preview in English" toggle shows a
  clearly-labeled review-only panel; it never replaces the submittable proposal text.
- **Fix 12 (Golden Keys):** `src/lib/prompts/shared/golden-keys.ts` — 20 framing
  sentences (10 `intent_frame`, 10 `contrast_frame`), each tagged by register. Engine 4
  decides whether to use one at all (defaults to no unless justified), which, and
  placement (opening/closing), storing the reason. `generateProposal` weaves the chosen
  key in placement-aware; a "Golden Key" card surfaces the decision + reason in the UI.
- **Build Log page:** this file + a "System Journal" sidebar page that renders it with a
  metrics header (counts by category + a per-entry timeline).

**Files changed:**
- `src/lib/ai.functions.ts` — fabrication rules, `verifyFactualClaims` wiring +
  `factCheck`, `translateToEnglish`, Golden Key injection into the proposal prompt.
- `src/lib/ai-gateway.server.ts` — `verifyFactualClaims()`.
- `src/lib/proposal-intelligence.ts` — `goldenKey` field + Engine 4 Golden Key decision.
- `src/lib/prompts/shared/golden-keys.ts` — new library.
- `src/lib/portfolio.functions.ts` — `curateRealPortfolio`.
- `src/components/PortfolioPicker.tsx` — "Curate real" mode.
- `src/routes/_authenticated/portfolio.tsx` — tag editor + tag display.
- `src/routes/_authenticated/new.tsx` — cancel button, fact-check banner, auto-match
  indicator, English preview, Golden Key card.
- `src/routes/_authenticated/journal.tsx` — new System Journal page. It imports this
  file via Vite `import buildLog from "../../../BUILD_LOG.md?raw"` (bundled at build time
  — a rebuild reflects new entries), parses entries, and renders metrics + timeline +
  a minimal markdown renderer. No server function is used.
- `src/vite-env.d.ts` — `declare module "*?raw"` so the raw import type-checks.
- `src/routeTree.gen.ts` — registered the `/journal` route (mirrors `/reports`).
- `src/components/dashboard-shell.tsx` — "System Journal" nav item.
- `supabase/migrations/20260626000300_portfolio_niche_tags.sql` — `niche_tags` column.

**Depends on / connects to:** Fix 7's fabrication guard reuses the `verifier` (Gemini)
role and is the backstop for the same "no fabricated metrics" rule Fix 10 enforces at the
portfolio layer. Fix 9's tags feed both the generation auto-match and Fix 10's curation.
Fix 12's Golden Keys are chosen by Engine 4 using the register from Engine 1.

**Still open / not yet done:**
- Live end-to-end verification (analyze → hook → CTA → generate) and the injected-
  fabrication test could not run in this environment: **no AI provider API keys are
  configured** (`.env` has only Supabase). `buildProviders()` is empty, so any generation
  call throws "No AI provider configured." A session with keys should run the two Golden
  Key test posts (one that should use one, one that shouldn't) and the injected-metric
  fabrication test to confirm the guard catches it.
- The `niche_tags` migration must be applied to the live Supabase DB for Fix 9 to persist.
- `conversion.tsx` does not yet pass a persisted `registerId` into
  `generateConversionResponses` (the param exists; the page infers fresh for now).
