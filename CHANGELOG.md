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
