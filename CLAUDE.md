# Vossie Market Place — Project Brief (read every session)

Team entry for the **Eduvos Hack Jam 2026** (Incubation Hub Marketplace brief, with Suitable Focus).
Judged on: Innovative, User-focused, Practical, Scalable (multi-campus), Accessible, Sustainable.
Demo Day: 2–6 November 2026. Tagline: "Student hustles. Campus customers."

## Working rules
- One phase per session, in order (Phase 0 → 9). Do not jump ahead.
- Decisions go through AskUserQuestion with 2–4 options, recommended first.
- Start each phase with a short plan; end with lint + typecheck + build green, CHANGELOG.md and
  AI_USAGE.md updated, conventional-commit, push to origin main.
- Git auth is via Git Credential Manager. Never put a token in a remote URL or file.

## Secrets
- Config lives in `.env.local` (git-ignored). `.env.example` has placeholders only.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only: never `NEXT_PUBLIC_`, never logged, never committed.
  Use it only in server actions, route handlers and Edge Functions.

## Stack
Next.js App Router + TypeScript strict + Tailwind v4 (tokens in `src/app/globals.css` `@theme`, not a
tailwind.config file). Supabase: Auth (email OTP), Postgres with RLS on every table, Storage, Realtime,
Edge Functions, `@supabase/ssr`. Migrations in `supabase/migrations`; types via
`supabase gen types typescript` into `src/types/database.ts`. PWA, mobile-first, deploy on Vercel.
Payments later via Paystack (ZAR) behind a feature flag.

## Brand
Deep navy #16305E, royal blue #2352C4, sand #CFAE7E, white, light grey. Serif display headings
(Playfair Display), sans body (Inter). Sand is background-only (fails AA as text on white).
Eduvos logo: `public/brand/eduvos-logo.png`.

## Roles (enforced in RLS, not only UI)
buyer, seller (needs approval), mentor (read-only analytics), admin (full moderation).

## Scope (22 features, built across phases)
1 seller registration/profiles · 2 listings · 3 discovery · 4 enquiry messaging + WhatsApp handoff ·
5 enquiry management · 6 safety/accessibility/onboarding · 7 barter · 8 mentor view · 9 Featured Hustle
rotation · 10 trust score · 11 admin panel · 12 analytics · 13 reviews (flagged) · 14 Paystack (flagged) ·
15 Looking For board · 16 saved/follow · 17 campus pickup points · 18 low-data mode · 19 share cards ·
20 Hub Growth corner · 21 POPIA · 22 multi-campus from day one.

## Quality bar
360px width, tap targets ≥ 44px, keyboard navigable, alt text, loading/empty/error states,
realistic South African seed data, no lorem ipsum.

## Architecture decisions
- **Phase 0:** Tailwind v4 CSS-first tokens. Service worker (`public/sw.js`) is registered only in
  production; navigation is network-first with `/offline` fallback. Health route `/api/health` pings
  Supabase Auth `/auth/v1/health` with the anon key only.
- Project lives in `vossie-market-place/` subfolder of the Desktop workspace.
- npm 11 requires `allowScripts` policy for install scripts; `unrs-resolver` (ESLint resolver) is
  currently not approved, and lint/build work without it.

## Status
Phases 0-5 complete. Next: Phase 6 (accessibility, onboarding and polish; email provider).

## Phase 1-2 decisions
- Sign-up allow-list in DB tables (`vossie.net`, `eduvos.com`, named test emails); roles by promotion only.
- Helper functions live in the un-exposed `private` schema; guard triggers enforce column-level rules.
- WhatsApp numbers live in `seller_private` (owner-only); `/go/whatsapp/[slug]` redirects signed-in users.
- Client uploads images straight to Storage under `{user_id}/`; server actions validate paths and write rows.
- Tailwind v4 tokens; `proxy.ts` (Next 16) only refreshes auth cookies; pages call `requireUser`.

## Phase 3-4 decisions
- Discovery: `browse_listings` is a `security_invoker` view (visibility rule lives there); search is `search_listings()` (FTS + trigram).
- Messaging: writes go through server actions with the user's client (RLS + guard triggers), never the service role. Send is idempotent on a
  client-generated message id. Realtime on `messages`, `notifications`, `conversations`, `enquiries`; UI uses the browser client for live state.
- Trust: tier rules in `trust_tiers` (editable by admin), scores in `seller_trust` (definer-function writes only). Only buyer-confirmed sales count
  (auto-confirm after 7 days). WhatsApp leads are logged as `whatsapp_handoff` events and excluded from response-rate maths.
- Email skipped for now (`email_queue` has no sender); web push is a flag + table only. Notifications are in-app.
- Tests: `test:messaging` (rules), `test:flow` and `test:ui` (real browser, need `npx next start -p 3111`). Seed is rerunnable.
- Gotchas: never put an inline `onClose` in a Modal effect dependency list; low-data mode still prefetches links (Phase 5 polish).

## Phase 5 decisions
- Auto-hide at 3 unique reporters (`site_settings`). Information Officer is an editable setting (placeholder until named). Data export is a route handler.
- Roles are gated three times: `proxy.ts` (404 for other roles), `requireRole`/`actionAuth` on the server, RLS in the database. Admin writes go through
  SECURITY INVOKER SQL functions in `public` that write the audit row atomically; the audit log is append-only for everyone.
- Admins do not have blanket message access: they read `report_context` snapshots only. Mentors read activity aggregates in `seller_trust`, never content.
- Blocked (suspended, banned, deleted) owners disappear from public views automatically; use `private.is_blocked()`.
- Deleting an account scrubs personal data at once and keeps others' history as "Deleted user" (FKs set null); hard delete after 30 days via cron.
- Tests: `test:moderation` (rules), `test:phase5` (browser). Test-created audit rows are permanent and tagged "[automated test]".
- Gotchas: migrations are applied through the Supabase MCP and kept in `supabase/migrations`; `src/types/database.ts` is regenerated after each. Email still
  needs custom SMTP before user testing (see `docs/EMAIL_SETUP.md`).

## Theme
- Light/dark is `<html data-theme>` set before paint by `THEME_INIT_SCRIPT` (saved cookie `vossie_theme`, else the device). React never renders that attribute, so it is never overwritten.
- Dark overrides live at the end of `globals.css` and target the Tailwind utilities that assume a light surface (`bg-white`, `text-navy`, `text-royal`, `border-navy/*`, pastel alert colours). `bg-navy`, `bg-royal` and `bg-sand` keep their brand colours; navy text on sand stays navy. New components should use these existing classes so dark mode works automatically; run `npm run test:theme` after UI changes.

