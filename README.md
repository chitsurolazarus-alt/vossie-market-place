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
Phase 0 (done): PWA shell, brand tokens, responsive header / bottom nav / footer, health check.
Planned: see `CLAUDE.md` and the phase roadmap.
