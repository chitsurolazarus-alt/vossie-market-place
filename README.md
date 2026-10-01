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
- **Phase 3:** discovery: home, browse with filters and typo-tolerant search, listing pages, saved/follow, Featured Hustle rotation, low-data mode.
- **Phase 4 (MVP):** buyer-seller enquiries and realtime messaging, seller enquiry dashboard, buyer-confirmed completion, reply-time bands,
  trust badges (no stars) with a public explainer, notification bell, WhatsApp handoff logging.
- Planned: moderation and safety, barter polish, mentor view, Looking For board, payments (see CLAUDE.md).

## MVP tour (360px phone screenshots)
Captured from a real two-user run (`npm run test:flow`): a buyer enquires, the seller replies in realtime, completes the sale, and the buyer confirms.

| 1. Enquire | 2. Buyer thread | 3. Seller bell | 4. Seller dashboard |
|---|---|---|---|
| ![Enquire composer](docs/screenshots/1-enquire.png) | ![Buyer thread](docs/screenshots/2-buyer-thread.png) | ![Seller bell](docs/screenshots/3-seller-bell.png) | ![Seller dashboard](docs/screenshots/4-seller-dashboard.png) |

| 5. Safety tip | 6. Did it happen? | 7. Buyer confirms | 8. Inbox |
|---|---|---|---|
| ![Safety tip](docs/screenshots/5-safety-tip.png) | ![Did it happen](docs/screenshots/6-did-it-happen.png) | ![Buyer confirms](docs/screenshots/7-buyer-confirm.png) | ![Inbox](docs/screenshots/8-inbox.png) |

| 9. Seller profile with trust badge | 10. Browse cards with badges |
|---|---|
| ![Seller profile](docs/screenshots/9-seller-profile-trust.png) | ![Browse](docs/screenshots/10-browse-cards.png) |

GitHub can show the code and these screenshots but cannot run the app (it needs a server, Supabase and realtime).
To get a live URL, import this repo into Vercel and add the three environment variables above.

## Scripts
`npm run db:seed` (demo data, safe to rerun), `npm run test:rls`, `npm run test:messaging`, `npm run test:smoke`,
`npm run test:ui` and `npm run test:flow` (the last three need a production server: `npm run build && npx next start -p 3111`),
`npm run test:discovery` and `npm run db:audit` (need DATABASE_URL). Demo logins: set `DEMO_LOGIN_ENABLED=true` locally only.

## Two-phone test (about 5 minutes)
Run the app (`npm run build && npm start`) or use the deployed URL, with `DEMO_LOGIN_ENABLED=true`.
1. **Phone A (buyer):** open `/login`, tap "New student". Browse to *Thandi's Kitchen > Chicken kota with atchar*.
2. Tap **Message on Vossie**, edit the text, **Send**. You land in the thread.
3. **Phone B (seller):** `/login`, tap "Thandi's Kitchen". The bell shows a new enquiry; open **/sell/enquiries** (New tab) and open the chat.
4. Reply from B: it appears on A instantly, and B's message shows "Seen" once A has it open. Try typing "pay a deposit first" on A for the safety tip.
5. On B tap **Start**, then **Mark completed > Yes, it happened**. A sees "Did this go ahead?"; tap **Yes, it went ahead**.
6. Open `/s/thandis-kitchen` on either phone: the **Top Hustler** badge and "Usually replies within an hour" show; `/how-trust-works` lists the rules.
7. On A tap **Chat on WhatsApp**: B's dashboard counts it under "WhatsApp leads". Attach a photo from A's thread to check the private image.
