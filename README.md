# Vossie Market Place

Student hustles. Campus customers. A multi-campus marketplace for Eduvos student entrepreneurs,
built for the Eduvos Hack Jam 2026 (Incubation Hub Marketplace).

## Setup
```bash
npm install
cp .env.example .env.local   # then fill in Supabase values
npm run dev                  # http://localhost:3000
```
Checks: `npm run lint`, `npm run typecheck`, `npm run build`. Health check: `GET /api/health`.

## Environment
| Variable | Exposure |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** |

## Deploy
Vercel: import the repo and add the three env vars (service role key as a non-public variable).

## Features
- **Phase 0:** PWA shell, brand tokens, responsive header / bottom nav / footer, health check.
- **Phase 1:** schema, RLS on every table, sign-up allow-list with POPIA consent, storage, seed data.
- **Phase 2:** email-code sign-in, seller onboarding wizard, seller dashboard and public profile,
  listing create/edit/manage with client-side image compression, first-time tours, seller guidelines.
- Planned: discovery, messaging, moderation, Looking For board, payments (see CLAUDE.md).

## Scripts
`npm run db:seed` (demo data), `npm run test:rls`, `npm run test:smoke` (needs `npm start -p 3111`),
`npm run db:audit` (needs DATABASE_URL). Demo logins: set `DEMO_LOGIN_ENABLED=true` locally only.
