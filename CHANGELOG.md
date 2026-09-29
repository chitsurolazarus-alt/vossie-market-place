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

## Phase 3 - Discovery (in progress)
- Migrations: browse_listings view, weighted FTS + typo search (search_listings), anonymous-safe listing_views, rotate_featured + pg_cron daily job.
- Home, /browse (URL filters, Load more), /l/[id] with OG image, /saved, /settings, /how-featured-works, low-data mode, save/follow, real 404s.
- Tests: test:discovery (67), test:rls (30), test:smoke (31) pass. test:ui (real-browser 360px) added, not yet passing fully.
