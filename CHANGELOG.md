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
