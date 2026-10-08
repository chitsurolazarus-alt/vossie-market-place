# HustleHub — Project Brief (read every session)

Team entry for the **Eduvos Hack Jam 2026** (Incubation Hub Marketplace brief, with Suitable Focus).
Judged on: Innovative, User-focused, Practical, Scalable (multi-campus), Accessible, Sustainable.
Demo Day: 2–6 November 2026. Tagline: "Student hustles. Nationwide."

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
**Design source of truth: `design-system/hustlehub/MASTER.md`** (vibrant & block-based direction, our palette, Unicons, spacing/radius scale, component rules and the pre-delivery checklist). Read it before any UI work.
Deep navy #16305E, royal blue #2352C4, sand #CFAE7E, white, light grey. Serif display headings
(Playfair Display), sans body (Inter). Sand is background-only (fails AA as text on white).
Product name **HustleHub** (renamed from Vossie Market Place; repo, routes and `vossie.net` sign-up domain unchanged). Logo: stall-awning + H mark in
`public/brand/hustlehub-mark.svg` / `hustlehub-wordmark.svg`. The header shows the mark only (aria-label "HustleHub home"); there is no footer. Legal and
about links live in Settings → About & legal. The Eduvos logo file is no longer shown in the UI.

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
Phases 0-5 complete. Rebrand Stages 1-10 done (verified and shipped). Email provider (SMTP) is still outstanding.

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

## Deployment
- Vercel project `vossie-market-place` (team lazarus-71c1), connected to GitHub `main` (auto-deploy), functions in `dub1`, Deployment Protection = all (team only).
- Env vars are set for Production and Preview via `vercel env add` (service role and demo password are sensitive). `.vercel/` and `.env*` are git-ignored.
- The demo login is enabled on Vercel only because the site is protected; turn it off once SMTP works.


## Design system (Stage 2)
- Icons: Unicons line via `src/components/Icon.tsx` only (sizes sm 16 / md 20 / lg 24, decorative = aria-hidden, standalone = `label`). No emoji or text glyphs as icons. `next.config.ts` transpiles the package.
- Shared UI in `src/components/ui.tsx` (Button, EmptyState with icon, StatTile, LinkTabs, Skeleton) and `Toast.tsx` (`useToast()`); listing card is `ListingTile.tsx`.
- Bottom nav until 1024px (`lg`), desktop nav from `lg`; fixed bars respect safe areas (`viewportFit: cover`).
- `npm run test:audit` (responsive audit: 35 routes x 6 widths x light/dark) must stay at 0 issues; results in `docs/UI_AUDIT.md`.

## Loading screens (Stage 3)
- Splash only shows when launched as an installed app (standalone), once per session (`lib/splash.ts` script + `Splash.tsx`); browser visits never see it. `npm run test:splash`.
- Route skeletons: `src/components/skeletons.tsx`; `loading.tsx` lives in route groups `(home)` and `(index)` next to the index page only.
  **Gotcha:** a `loading.tsx` makes Next stream the page, so `notFound()` below it returns HTTP 200 instead of 404. Never put one on a parent of `l/[id]`, `messages/[id]` or other access-controlled detail routes.
- Real photos: `npm run photos:fetch` (needs `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` in `.env.local`) fills `scripts/photos/files` + `public/photos` and `scripts/photos/manifest.json`; `db:seed` uploads them. Credits in `docs/IMAGE_CREDITS.md`.

## Landing (Stage 9)
- `/` renders `components/landing/Landing.tsx` sections for signed-out visitors only (`(home)/page.tsx` branches on `getUser()`); the marketplace sections below are shared. Stats come from `lib/landing.ts`. `npm run test:landing`.

## Payments (Stage 8)
- `payment_requests` + `payment_events`: users only SELECT (RLS); every write is server code with the service role after explicit checks (`lib/payments.ts`, `actions/payments.ts`). Provider = `site_settings.payment_provider` (mockpay default; paystack only if `PAYSTACK_SECRET_KEY` is set). Paid is recorded only after `markPaid` (MockPay approve, or Paystack verify via callback/webhook). Flag `payments`. Payout/escrow not built. `npm run test:payments`.

## Handover options (Stage 7)
- `listings.handover` (text[] of pickup | campus_dropoff | courier) + `delivery_fee_zar`; constants and labels in `lib/validation.ts`. `delivered_on_campus` is kept in sync (true when campus_dropoff) but is legacy. `npm run test:handover`.

## Nationwide campuses (Stage 6)
- `campuses.province` is required; `active=false` means not launched. `getReference()` returns `campuses` (active only, for filters and chips) and `allCampuses` (pickers). Use `CampusSelect` for any campus choice. Activating a campus = Admin -> Manage. `npm run test:campuses`.

## Coach-mark tours (Stage 5)
- `CoachTour` (`src/components/CoachTour.tsx`) + steps in `src/lib/tours.ts`; targets are `data-tour="..."` attributes. Seen ids live in `profiles.tours_seen`; a tour waits for the welcome slides (`onboarding_seen`). New screens: add anchors + a steps array + `<CoachTour id=...>`; add the id to the seeds. `npm run test:tours`.

## Settings and navigation (Stage 4)
- Data saver, theme, notification prefs, campus, tour replay and legal links live in `/settings` (sections have ids for deep links, e.g. `/settings#data-saver`). The header has no data-saver toggle.
- `NAV` in `Header.tsx` is the one list for both navs; `desktopOnly` items stay out of the five-item mobile bottom nav (Home, Browse, Sell, Messages, Account). Keep it at 5 on mobile.
- `NavLink.tsx` provides the active state (`aria-current="page"`). `npm run test:settings` covers all of this.
