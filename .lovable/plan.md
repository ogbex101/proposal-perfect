## 1. Admin: grant role + fix stats

- Add a migration that ensures `ogbeifundaniel0@gmail.com` has the `admin` role in `user_roles` (idempotent INSERT using `auth.users` lookup). The handle_new_user trigger only fires on signup, so existing accounts need this backfill — that's why the Users tab returns "Forbidden: admin only".
- Audit `getDashboardStats` / page-view stats in `src/lib/admin.functions.ts`: confirm queries read from the correct tables with `supabaseAdmin` (page_views is service-role-only after the recent RLS lockdown), and that empty buckets render `0` instead of breaking the chart. Fix any miscounts (e.g. counting all-time vs. today, joining the wrong table).

## 2. Portfolio reference templates

Edit `src/lib/portfolio-reference-templates.ts`:

- `video` family: pin reference to `https://caleb-ai-vision.lovable.app/faith` (owner-specific samples) as the primary, with `https://caleb-ai-vision.lovable.app/` as secondary. Boost matching so any "video / video editing / AI video" job picks this template.
- Add the missing reference URLs the user listed to the right families:
  - developer: `bubblejoshproj.lovable.app`, `multi-persona-portfolio.lovable.app/niche/fullstack-developer`, `pixel-pushr-panel.lovable.app`
  - marketing: `content-saver-pro.lovable.app`, `happy-campaign-hub-97.lovable.app`
- Verify `matchPortfolioReference()` keyword weights so "video editing" no longer falls back to design.

## 3. New Proposal page — profile + image gallery

- New table `profile_images` (id, user_id, storage_path, label, created_at) with RLS scoped to `auth.uid()` and grants. Bucket reuse: `avatars` (already exists, private).
- New server fns in `src/lib/profile.functions.ts`:
  - `listProfileImages`, `saveProfileImage(path,label)`, `deleteProfileImage(id)`, plus reuse existing `enhanceAvatar`.
- New `ProfileImageGallery` component on the New Proposal page:
  - Grid of saved headshots, click to apply to the current proposal.
  - "Upload new" + "Enhance with AI" buttons (reuses `AvatarUploader` logic). Enhanced result is saved back to the gallery automatically.
- Sub-profile picker on the proposal page already fills name/tags — wire the chosen image independently so swapping a profile doesn't overwrite the active headshot, and vice versa.

## 4. New Proposal page — productivity features

- **Saved snippets/templates**: new `proposal_snippets` table (title, body, category, user_id). UI: side panel listing snippets with one-click insert into the active section. Seed a few defaults (intro, pricing, CTA).
- **Tone & length controls**: dropdowns (Formal / Friendly / Confident) and (Short / Medium / Long) sent into the generation prompt.
- **Auto-save drafts**: persist the in-progress proposal to `proposal_drafts` (debounced every 2s); restore on page load. Toast when restored.
- **Inline AI rewrite**: select any paragraph → floating toolbar with Rewrite / Expand / Shorten / Make more formal. Backed by a new `rewriteText` server fn using the existing Lovable AI gateway.
- **Variants**: "Generate 3 versions" button produces side-by-side cards; pick one to load into the editor.
- **Export**: Copy as plain text, copy as Markdown, download as PDF (client-side via existing `src/lib/export.ts` if present, else add `jspdf`).
- **Extra UX polish**: word/char count, "since-last-saved" indicator, keyboard shortcuts (⌘S save, ⌘K snippets), and a "recent proposals" quick-switcher.

## Technical notes

- Migrations: one for admin-role backfill, one for `profile_images` + `proposal_snippets` + `proposal_drafts` (with GRANTs + RLS scoped to `auth.uid()`).
- All new server functions use `requireSupabaseAuth`. No service role in client-reachable handlers except the existing admin checks.
- Image enhancement reuses `enhanceAvatar` already in `src/lib/profile.functions.ts`; saving an enhanced image inserts a new `profile_images` row pointing at the new storage path.
- Inline rewrite & variants go through the same gateway pattern already used by `src/lib/ai.functions.ts`.

## Out of scope (this turn)

- Building a full collaborative editor or sharing proposals across users.
- Migrating existing inline avatars on old proposals into the new gallery (one-off cleanup, do later if needed).