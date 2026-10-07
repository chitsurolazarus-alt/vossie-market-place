# Changelog

## Phase 0 — Scaffold
- Next.js (App Router, TS strict, Tailwind v4) project with Supabase SSR client helpers.
- Eduvos design tokens, Playfair Display + Inter fonts, skip link, reduced-motion support.
- Header, mobile bottom nav, footer, placeholder pages, offline page.
- PWA manifest, icons, production service worker.
- `/api/health` Supabase connectivity check.
- Docs: CLAUDE.md, README, AI_USAGE, docs/DATA_MODEL.

## Phase 1 — Database, auth and roles
- 4 migrations: full schema (22 tables + tags/seller helpers), RLS on every table, private helper schema,
  sign-up gate (allow-listed domains + POPIA consent), guard triggers, storage buckets.
- Allowed sign-up domains: `vossie.net` (student numbers) and `eduvos.com` (staff); roles by promotion only.
- Generated `src/types/database.ts`; `docs/DATA_MODEL.md` with Mermaid ER diagram.
- Seed (`npm run db:seed`): 2 campuses, categories, 1 admin, 1 mentor, 8 approved sellers, 32 listings.
- `npm run test:rls` (30 checks) and `npm run db:audit` (advisor-style audit, 0 flagged).

## Phase 2 — Seller onboarding, profiles and listings
- Email-code sign-in (`/login`), account page, session refresh in `proxy.ts`, demo logins (flag-gated).
- Seller onboarding wizard (`/sell/onboarding`): 5 steps, draft saved per step, square-crop + <300KB photo,
  private +27 WhatsApp number, campus + 1-3 pickup points, guidelines agreement, "You're in the queue" screen.
- Seller dashboard (`/sell`), edit profile, public profile (`/s/[slug]`) with verified badge, contact buttons that
  respect preference, and `/go/whatsapp/[slug]` redirect so numbers never appear in page HTML.
- Listings: create/edit/manage (`/sell/listings`): product/service, cash/swap/both, up to 5 photos (1600px WebP
  <400KB, EXIF stripped, drag or arrow reorder, alt text), tag suggestions, availability, soft delete.
- First-time welcome tour and a 3-step seller dashboard tour (flags stored on profiles).
- zod schemas shared by client and server; server actions for all writes; seller guidelines page.
- Tests: `npm run test:smoke` (31 checks) added alongside `test:rls` (30).

## Phase 3 - Discovery
- Migrations: browse_listings view, weighted FTS + typo search (search_listings), anonymous-safe listing_views, rotate_featured + pg_cron daily job.
- Home, /browse (URL filters, Load more), /l/[id] with OG image, /saved, /settings, /how-featured-works, low-data mode, save/follow, real 404s.
- Tests: test:discovery (67), test:rls (30), test:smoke (31) pass. test:ui (real-browser 360px) added.
- Phase 3 follow-up (done at the start of Phase 4): `test:ui` now passes 63/63. Fixes: carousel `sr-only` spans widened the home
  page (scrollers now `relative`); listing breadcrumb/tag/seller links raised to 44px; inline-in-sentence links exempted per
  WCAG 2.5.8; the welcome tour now appears right after sign-in (it only checked on first mount); the test resets the demo student
  so it is repeatable.

## Phase 4 - Messaging, enquiry management and trust (MVP, tag v0.1-mvp)
- **Enquiries:** "Message on Vossie" is live on listing and seller pages. Signed-out taps return to the same page with the composer
  open; the composer is prefilled and editable. One conversation per (buyer, seller, listing); re-enquiring reuses it (and reopens a
  declined one). Sellers cannot message themselves. Swap listings offer "Propose a swap" (pick one of your own listings and/or type an offer)
  shown as a distinct swap-offer card.
- **Messaging:** `/messages` inbox (thumbnail, preview, time, unread badge) and `/messages/[id]` thread with Realtime delivery, optimistic send
  with idempotent retry, "Seen" receipts, day separators, pinned listing card, one compressed private photo (signed URLs), 1000-char limit,
  link detection without HTML, and a safety tip when text looks like "pay deposit first" or bank details (warn, never block).
  Rate limits enforced in the database: 30 messages/min and 10 new conversations/hour.
- **Seller dashboard (`/sell/enquiries`):** New / In progress / Completed tabs with counts (declined sit under Completed), listing filter,
  buyer-name search, WhatsApp-lead count, Start / Decline / Mark completed. Completing asks "Did this sale/swap happen?". Only a buyer-confirmed
  "yes" counts toward trust; the buyer gets a one-tap prompt in the thread and it auto-confirms after 7 days (pg_cron). Up to 5 quick replies.
- **Reply time:** median first-response time over 30 days (private SQL view), shown only as bands ("within an hour" / "a few hours" / "a day" /
  "Replies slowly") once a seller has 3+ enquiries.
- **Trust badge (no stars):** New seller -> Responsive -> Trusted -> Top Hustler. Rules live in the admin-editable `trust_tiers` table; scores
  live in `seller_trust`, written only by SECURITY DEFINER functions (refreshed on every enquiry change and nightly). `/how-trust-works` renders
  the exact rules from the table. Badges and reply times appear on seller pages, listing pages and listing cards.
- **Notifications:** bell with Realtime unread count and mark-all-read; events for new enquiry, new message (batched: max 1 per conversation per
  15 min), status change and completion request/confirmation. `notification_prefs` + `email_queue` exist but no email provider is connected
  (decision: skip email for now). `push_subscriptions` + `web_push` flag (off) only.
- **WhatsApp handoff:** the signed-in redirect is unchanged (number never in HTML); each tap is logged as a `whatsapp_handoff` event on the
  enquiry (creating a WhatsApp-sourced enquiry if needed). WhatsApp leads are counted for dashboards but excluded from response-rate maths.
- **Database:** 6 migrations (declined status; conversations/messages/enquiries upgrades; events, quick replies, notifications, prefs, email
  queue, push subscriptions; trust tiers/score; private `message-images` bucket; Realtime publication; cron jobs; advisor fixes).
- **Seed:** 6 demo buyers, backdated accounts and confirmed enquiries so tiers land at 1 Top Hustler (Thandi's Kitchen), 2 Trusted, 3 Responsive,
  2 New. Fresh unread enquiries for Thandi and a "did this go ahead?" prompt for the demo buyer.
- **Fixes found by the new end-to-end test:** `Modal` re-ran its focus effect on every render and stole focus from the textarea on each keystroke.
- **Tests:** `test:messaging` (83 access-control/rule checks), `test:flow` (46-check two-user browser flow at 360px with screenshots in
  `shots/flow`), `test:ui` 67, `test:smoke` 31, `test:rls` 30.

## Phase 5 - Safety, moderation, admin panel, mentor layer and POPIA
- **Report / flag:** report a listing, seller profile, user or an individual message (reasons: scam or fraud, prohibited item, offensive
  content, harassment, fake profile, wrong category or spam, other; optional note up to 500 characters). One open report per reporter per
  target, 10 reports a day. A listing auto-hides after **3** unique reporters pending review (editable in Admin > Manage > Settings); the seller is
  told it is under review, never who reported. Reporters are notified when a report is resolved. Reporter identity is hidden from the reported
  person by RLS.
- **Admin panel (`/admin`):** dashboard (waiting sellers, open reports, new listings today, active users in 7 days), seller approvals
  (approve / reject with reason / request changes, Verified badge, mentor assignment), reports queue with context (a reported message plus up to
  5 surrounding messages, snapshotted when reported) and actions dismiss / hide / warn / suspend (1 to 365 days) / ban, listing moderation (hide,
  restore, change category), user search with role changes and suspension lifting, an audit-log viewer with filters, and Manage screens for
  categories, campuses, pickup points, trust tier thresholds, feature flags, allowed email domains and addresses, Featured Hustle overrides and
  settings. Admin access is enforced three times: the proxy (404 for other roles), server checks and RLS.
- **Suspension and bans:** suspended, banned or deleted users can still sign in and browse, but cannot list or message (database triggers).
  Their profile and listings are hidden publicly while it lasts and return automatically when a suspension ends. Bans also block sign-in.
- **Audit log:** append-only for everyone, including admins and the service role (triggers). Admin actions run as RLS-protected SQL functions that
  write their audit row (actor, action, target, before, after, reason) in the same transaction; configuration changes are logged by trigger. The
  last admin can never be demoted, banned or deleted.
- **Mentor view (`/mentor`):** read-only; mentors see only their assigned sellers (admins see all) with enquiry volume (in-app and WhatsApp
  handoffs), response rate, reply-time band, confirmed sales, listing views, trust tier and last active, "may need support" flags (no enquiries
  in 14 days, response rate under 50%, no listing updated in 21 days, content recently hidden by moderation), private notes, check-ins and a CSV
  export. Mentors have no access to message content.
- **Hub Growth corner (`/growth`):** tips, Incubation Hub events (RSVP with capacity) and mentor office hours (booking requests with
  notifications), staff-managed with a safe markdown subset, cover image and campus targeting, plus a "From the Hub" card on the seller dashboard.
- **POPIA:** full plain-language `/privacy` policy (Information Officer is an editable setting), `/settings/privacy` with the consent record,
  JSON data export, the reports you made and **Delete my account** (type DELETE): personal data is scrubbed immediately, the login is removed after
  30 days by a nightly job, and messages other people rely on are kept as "Deleted user". Messages, enquiries and reports now survive a deleted
  user (foreign keys set null).
- **Email readiness:** `docs/EMAIL_SETUP.md` with step-by-step Resend and Brevo setup for Supabase custom SMTP.
- **Database:** 6 migrations (report enums; site settings, suspension, audit, reports, admin functions; mentor, Hub and account deletion;
  admins see report context only; admin_set_role audit ordering; duplicate indexes dropped).
- **Privacy tightening:** admins no longer have blanket read access to message threads (Phase 4 allowed it for moderation).
- **Seed:** a seller waiting for approval (Aisha, demo login), 3 Hub posts, an open demo report, and a seller who shows up as "may need support".
- **Tests:** `test:moderation` (161 access-control and rule checks), `test:phase5` (134-check browser flow at 360px, screenshots in `shots/phase5`),
  plus the existing `test:rls` 30, `test:messaging` 83, `test:smoke` 31, `test:ui` and `test:flow`.

## Theme - light and dark mode
- **Dark theme** across the whole app (public pages, seller dashboard, messages, admin, mentor, Hub, privacy). It follows the device setting by default; a
  moon/sun button in the header flips it in one tap, and Settings has "Match my device / Light / Dark". The choice is saved in a cookie (`vossie_theme`)
  and an inline script sets `<html data-theme>` before first paint, so there is no flash of the wrong theme.
- Brand colours are kept (navy, royal and sand backgrounds, sand buttons with navy text); the page surface, cards, borders, alerts and text colours are remapped.
  Light mode is unchanged.
- The header gained a toggle and still fits at 360px (the data-saver pill is icon-only on phones; its On/Off state is announced to screen readers).
- **Tests:** `test:theme` (79 checks): device default, no flash, toggle, persistence across reloads and pages, Auto following the device, and a WCAG AA
  contrast audit of every visible text element on 28 pages in both themes (0 failures). Screenshots in `shots/theme`.


## Rebrand stage 1 - HustleHub identity
- Product renamed **Vossie Market Place -> HustleHub** (metadata, manifest, titles, OG image, share/WhatsApp text, notifications, policy pages, seed copy, README, docs).
  Tagline: "Student hustles. Nationwide." Repo name, routes, cookie names and the `vossie.net` sign-up domain are unchanged.
- Migration `20261007000001_rebrand_hustlehub`: trigger-function texts and existing notification/Hub rows say HustleHub (logic untouched).
- New original logo: market-stall awning over an H. `public/brand/hustlehub-mark.svg` and `hustlehub-wordmark.svg` (text outlined, light/dark aware).
- Header shows the **mark only** (accessible name "HustleHub home"). The footer and the Eduvos logo are gone from every page.
- Settings gained **About & legal** (privacy, terms, seller guidelines, how trust works, how Featured Hustle works, Hub Growth, contact) plus a
  "Built for the Eduvos Incubation Hub" credit. New `/terms` page (draft for legal review). All pages stay reachable by URL.
- Icon set from the mark: `favicon.ico` (16/32/48), `icon.svg`, 192/512 PNG, maskable 512 (glyph inside the safe zone), apple-touch-icon 180.
  Service-worker cache renamed `hustlehub-shell-v2`.
- ESLint ignores `.claude/` (vendored skill scripts).
- Checks: lint, typecheck, build; `test:rls` 30, `test:messaging` 83, `test:moderation` 161, `test:flow` 46, `test:smoke` 31, `test:ui` 75, `test:theme` 79, `test:phase5` 134.

## Rebrand stage 2 - Design system, Unicons, mobile
- `design-system/hustlehub/MASTER.md` is the single source of truth (ui-ux-pro-max generator + the "Vibrant & Block-based" style, our palette and fonts kept, purple ignored).
- All icons are now **Unicons (line)** through one `Icon` component with a 16/20/24 size scale; every emoji and text glyph icon (check, cross, arrows, category and tour emoji) is gone.
  New `Verified` tick component. `@iconscout/react-unicons` added; old inline SVGs removed.
- Richer UI: new listing card (4:3 photo, price first, location line, kind chip, trust badge, press and hover feedback), browse category chips, filter sheet with drag handle,
  `StatTile`, `LinkTabs` (Saved), icon empty states, `Toast` (save confirmations), button press feedback.
- Mobile: header/desktop nav moved from 768px to 1024px (it overflowed at 768 on every page), safe-area insets (`viewport-fit=cover`), `dvh` sheet, fixed 44px tap target on `/sell`.
- `scripts/responsive-audit.mjs` (`npm run test:audit`): 35 routes x 6 widths x light/dark. 80 issue instances before, 0 after. Report in `docs/UI_AUDIT.md`.
- Checks: lint, typecheck, build; `test:ui` 75, `test:theme` 79, `test:phase5` 134, `test:flow` 46, `test:smoke` 31.

## Rebrand stage 3 (part 1) - Splash and loading screens
- Branded **splash** (logo mark rise-in) for installed-app launches only, once per session, gone in about 0.7s (0.25s with reduced motion); browser visits never see it, so first-visit speed is untouched.
- **Route skeletons** (fade in only after 150ms, so fast loads never flash): home, browse, messages list, sell, admin, mentor, account (plus the existing sell/listings one).
  Listing and message-thread pages deliberately have none, to keep real HTTP 404s (a streamed page cannot change its status).
- Photo pipeline ready: `scripts/fetch-photos.mjs` (Pexels API), `scripts/photos/queries.mjs` (33 listing + 10 site searches), seed uses the photos when present. Waiting for `PEXELS_API_KEY`.
- Checks: lint, typecheck, build; `test:splash` 7, `test:ui` 75, `test:theme` 79, `test:phase5` 134, `test:flow` 46, `test:smoke` 31.

## Rebrand stage 3 (closed) - real photos deferred
- Pexels keys were paused and Unsplash was not available, so **no real photos are in the app yet**: listings and the landing page keep the generated tiles.
- Free no-key option tried: Openverse (CC0 / public domain / CC BY only). Results were unusable (off-topic, historical or ethnographic images, visible Apple and Coca-Cola logos), so the whole batch was
  deleted and nothing from it shipped. The script keeps Openverse behind `--openverse` only.
- Pipeline stays ready: `scripts/fetch-photos.mjs` (Unsplash or Pexels key), `scripts/photos/queries.mjs`, `scripts/photos/sheet.mjs` (contact sheet for the by-eye check), seed fallback to tiles.
  To finish: add `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` to `.env.local`, run `npm run photos:fetch`, review the sheet, `npm run db:seed`.

## Rebrand stage 4 - Settings page and navigation
- `/settings` now has seven sections with a jump bar: **Appearance** (light/dark/device), **Data saver** (the same low-data mode, moved out of the header), **Notifications** (email on new enquiries, daily summary; push shown as coming soon),
  **Location** (my campus, saved to the profile; becomes province + campus in Stage 6), **Help** (Replay app tour, FAQ), **Privacy & data** (download or delete) and **About & legal** (privacy, terms, seller guidelines, how trust and Featured work, Hub Growth, contact, Incubation Hub credit).
  Signed-out visitors still get Appearance, Data saver and About; account sections ask them to sign in.
- New `/faq` page (10 questions). New server actions in `actions/settings.ts` (own-row writes through RLS, no service role).
- **Bottom nav (mobile):** exactly five items, icon + label, current section highlighted: Home, Browse, Sell, Messages, Account. Saved, Looking For and Settings moved into **Account**.
  **Desktop** top bar (from 1024px) keeps all links, with the current one highlighted. The data-saver toggle is gone from the header.
- New `scripts/settings-check.mjs` (`npm run test:settings`, 33 checks). `test:ui` updated for the moved toggle.
