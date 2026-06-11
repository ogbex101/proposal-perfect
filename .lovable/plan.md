## Stack
- TanStack Start + React + Tailwind v4 + shadcn/ui + Lucide
- Lovable Cloud (Supabase) for auth, DB, RLS
- Lovable AI Gateway (`google/gemini-3-flash-preview`) via `createServerFn` for analysis, generation, and conversion messages
- `jspdf` for client-side PDF export

## Design
Build verbatim from the selected "Strategic Blueprint" direction: white surface, slate-900 text, indigo brand (#6366f1) accent, Outfit display + Inter body, sticky landing header, split hero with live dark preview card, 3-column dashboard (sidebar / input / output) with a right-side "Why this strategy" panel. Tokens dropped verbatim into `src/styles.css` `@theme`.

## Routes
```
/                        Landing (hero + mini live preview + testimonial slot + footer)
/auth                    Sign in + sign up tabs
/_authenticated/app                Redirect → /app/new
/_authenticated/app/new            New Proposal workspace (core)
/_authenticated/app/history        Proposal History
/_authenticated/app/analyzer       Standalone Job Analyzer
/_authenticated/app/portfolio      Portfolio Manager
/_authenticated/app/saved          Saved Items
/_authenticated/app/messages       Conversion Message Generator
/_authenticated/app/settings       Profile + defaults
/_authenticated/app/admin          Admin panel (gated by has_role)
```

## Lovable Cloud — schema
Migration creates:
- `profiles` (id → auth.users, name, default_length, default_plan, default_portfolio_ids[])
- `app_role` enum (`admin`, `user`) + `user_roles` table + `has_role(uuid, app_role)` security-definer fn
- `portfolio_items` (user_id, title, url, description, is_primary, is_favorite)
- `proposals` (user_id, job_description, job_analysis jsonb, hook, strategy, length, include_plan, milestones jsonb, content, explanation jsonb, created_at)
- `saved_items` (user_id, kind: hook|strategy|portfolio|proposal, ref_id, snapshot jsonb)
- `conversion_messages` (user_id, input, output, created_at)
- Triggers: auto-create profile on signup; `updated_at` triggers
- RLS: each table scoped to `auth.uid()`; admin can read all via `has_role(uid,'admin')`
- GRANTs to `authenticated` + `service_role` on every table

Admin seeding: migration inserts `('admin')` into `user_roles` for the auth user whose email matches `ogbeifundaniel0@gmail.com` (idempotent; uses `auth.users` lookup). User signs up normally with that email; role is granted automatically.

## Server functions (`src/lib/*.functions.ts`)
All use `requireSupabaseAuth`. AI calls use the Lovable AI Gateway helper (`src/lib/ai-gateway.server.ts`) with `Output.object` Zod schemas.

- `analyzeJob({ jobDescription })` → `{ summary, painPoint, hiddenNeeds, technicalDifficulties[], recommendedApproach, suggestedHook, suggestedStrategy, hookReason, strategyReason }`
- `generateProposal({ jobDescription, analysis, hook, strategy, length, includePlan, portfolioItems, milestones, budget })` → `{ content, explanation: { hook, strategy, question } }` — system prompt encodes forbidden phrases, hook+strategy guidance, length char targets, structure
- `generateMilestones({ jobDescription, budget })` → `[{ title, description, amount }]`
- `generateConversionResponses({ clientMessage })` → `{ options: string[] }` (3 variants)
- `saveProposal`, `listProposals`, `getProposal`
- Portfolio CRUD; Saved items CRUD
- `adminListUsers` (checks `has_role(uid,'admin')`, then `supabaseAdmin` to list users + counts)

## Frontend features
- **Landing** (`/`): hero copy reuses brief's "Proposals That Convert. Not Generic. Just Human."; live mini preview shows a 3-step shimmer animation; testimonial placeholder card; CTA → `/auth`.
- **Auth** (`/auth`): email/password sign-up + sign-in (email confirmation off — note: user must disable in Cloud auth settings, or we ship `configure_auth` call); name field optional; forgot-password link is a placeholder toast.
- **Dashboard shell**: shadcn `Sidebar` with nav + top bar (avatar dropdown w/ logout). Admin nav item visible only when `has_role` returns true.
- **New Proposal**: paste-job tab + guided-form tab; "Analyze Job" → streams analysis cards in; user can override suggested hook/strategy via dropdowns (14 hooks, 8 strategies as constants); length segmented control (Brief/Robust/Explanatory); plan toggle; portfolio selector (multi-select, max 3); optional budget + milestone generator with editable list; Generate → renders proposal with typewriter reveal + "Why this" panel; Copy / Download .txt / Download PDF buttons; Save to history (auto on generate).
- **History**: list w/ date + length badge + first 80 chars; click → load into New Proposal editor (prefilled).
- **Portfolio**: CRUD cards, primary star, favorite heart.
- **Saved Items**: tabs for Hooks / Strategies / Portfolio / Proposals; one-click load.
- **Conversion Messages**: paste client message → 3 response options as cards; copy + edit + regenerate.
- **Settings**: name, default length, default plan toggle, default portfolio picks. Password change shows "coming soon" toast.
- **Admin**: table of users (email, name, joined, proposal count); click row → drawer with their proposals and saved items (read-only).

## Constants (`src/lib/proposal-constants.ts`)
- `HOOKS` array (14 entries with name + description)
- `STRATEGIES` array (8 entries)
- `FORBIDDEN_PHRASES` array used in system prompt
- `LENGTH_TARGETS` ({ brief: 1500, robust: 3000, explanatory: 5000 })

## Out of scope for Phase 1
- Real password reset email flow
- Mobile-optimized variants beyond responsive collapse of sidebar
- Streaming proposal generation (use one-shot `generateText` with `Output`; typewriter is client-side reveal)
- Stripe / billing

## Build order
1. Enable Lovable Cloud, run schema migration with admin seed
2. Drop design tokens into `src/styles.css`, install fonts via `<link>` in `__root.tsx`
3. Auth route + `_authenticated` layout already managed by integration
4. Dashboard shell + sidebar + landing
5. Constants + server fns (analyze, generate, milestones, conversion)
6. New Proposal page wiring all controls + output + explanation panel
7. Portfolio, History, Saved, Messages, Settings
8. Admin panel
9. PDF / TXT / Copy export
10. QA pass: signup → generate → save → history → export → admin login