# Data Model

Source of truth: `supabase/migrations/`. Types: `src/types/database.ts` (regenerate with
`npx supabase gen types typescript --db-url $DATABASE_URL --schema public`).

## ER diagram

```mermaid
erDiagram
  campuses ||--o{ pickup_points : has
  campuses ||--o{ seller_profiles : hosts
  campuses ||--o{ listings : "scopes"
  campuses ||--o{ requests : "scopes"
  categories ||--o{ seller_profiles : classifies
  categories ||--o{ listings : classifies
  categories ||--o{ requests : classifies
  auth_users ||--|| profiles : "1:1"
  profiles ||--o| seller_profiles : "becomes"
  profiles ||--o| seller_drafts : "onboarding draft"
  seller_profiles ||--o| seller_private : "WhatsApp (private)"
  seller_profiles ||--o{ seller_pickup_points : offers
  pickup_points ||--o{ seller_pickup_points : "chosen in"
  seller_profiles ||--o{ listings : sells
  listings ||--o{ listing_images : has
  listings ||--o{ listing_tags : tagged
  tags ||--o{ listing_tags : ""
  profiles ||--o{ conversations : "buyer"
  seller_profiles ||--o{ conversations : "seller"
  listings ||--o{ conversations : about
  conversations ||--o{ messages : contains
  conversations ||--o| enquiries : tracks
  enquiries ||--o{ enquiry_events : logs
  seller_profiles ||--o{ quick_replies : saves
  seller_profiles ||--o| seller_trust : "score (server-written)"
  trust_tiers ||--o{ seller_trust : defines
  profiles ||--o{ notifications : receives
  profiles ||--o| notification_prefs : sets
  profiles ||--o{ email_queue : queued
  profiles ||--o{ push_subscriptions : registers
  enquiries ||--o| reviews : "flagged"
  enquiries ||--o{ payments : "flagged"
  profiles ||--o{ reports : files
  profiles ||--o{ saved_listings : saves
  listings ||--o{ saved_listings : ""
  profiles ||--o{ follows : follows
  seller_profiles ||--o{ follows : ""
  seller_profiles ||--o{ featured_slots : spotlighted
  listings ||--o{ listing_views : viewed
  profiles ||--o{ requests : "posts (Looking For)"
  requests ||--o{ request_responses : receives
  seller_profiles ||--o{ request_responses : sends
  profiles ||--o{ audit_log : "acts in"
```

## Tables

| Table | Purpose |
|---|---|
| `campuses`, `categories`, `pickup_points`, `tags` | Reference data. Public read, admin write (tags: any signed-in user may add). |
| `allowed_email_domains`, `allowed_emails` | Sign-up allow-list (`vossie.net`, `eduvos.com`, plus named test addresses). Admin only. |
| `profiles` | One per auth user. Holds `role`, POPIA consent timestamp, onboarding flags, low-data preference. |
| `seller_profiles` | Business profile: slug, tagline, bio, photo, contact preference, `status`, `verified`, `mentor_id`. |
| `seller_private` | WhatsApp number (E.164, `+27` + 9 digits). Owner-only; server builds `wa.me` links. |
| `seller_pickup_points`, `seller_drafts` | Seller's 1-3 pickup points; multi-step onboarding draft. |
| `listings`, `listing_images`, `listing_tags` | Products and services (cash / swap / both), up to 5 images and 5 tags. Soft delete via `deleted_at`. |
| `conversations` | One per (buyer, seller, listing); seller-level chat (no listing) is one per pair. Snapshots buyer/seller names and listing title/cover, last-message preview, `origin` (in_app / whatsapp). |
| `messages` | Text (max 1000), optional private image path, `kind` text or swap_offer, scam-pattern `risk_flag`, `read_at` (seen). Realtime. |
| `enquiries` | One per conversation, created by trigger. Status new / in_progress / completed / declined, `source`, `first_response_at`, `sale_happened`, buyer confirm/dispute timestamps, `auto_confirmed`. |
| `enquiry_events` | Audit trail: status changes, completion request/confirm/dispute/auto-confirm, `whatsapp_handoff`. Written by triggers or the service role only. |
| `quick_replies` | Up to 5 canned seller replies. |
| `notifications` | In-app bell. Server-created only; the owner may only set `read_at`. Realtime. |
| `notification_prefs`, `email_queue`, `push_subscriptions` | Email/digest/push preferences, an email outbox (no sender connected yet) and web-push subscriptions (flag off). |
| `trust_tiers` | Admin-editable badge rules (min enquiries, response rate, confirmed sales, account age, verified). Public read. |
| `seller_trust` | Computed tier, response rate, confirmed sales and reply-time band per seller. Public read for approved sellers; **no client write policy or privilege**. |
| `reports`, `audit_log`, `feature_flags` | Moderation, admin audit trail, feature toggles. |
| `featured_slots`, `saved_listings`, `follows`, `listing_views` | Engagement and Featured Hustle rotation. |
| `requests`, `request_responses` | "Looking For" board. |
| `reviews`, `payments` | Schema only; behind feature flags (Phase 8). |

## Roles

`buyer` (default), `seller` (set automatically when an admin approves a seller), `mentor`, `admin`.
Roles are only changed by an admin or the service role (trigger `guard_profile`). Being on an allowed
domain never grants a role.

## RLS summary

- RLS is enabled on **every** public table. Helper functions live in the un-exposed `private` schema
  (`is_admin`, `owns_seller`, `seller_approved`, `listing_visible`, `in_conversation`, ...).
- **Public**: approved sellers, and listings of approved sellers that are not deleted/hidden, with their
  images and tags; campuses, categories, pickup points, feature flags.
- **Owner**: own profile, drafts, WhatsApp number, own seller profile and listings (even while pending).
- **Admin**: full access to moderation tables and everything else.
- **Mentor**: read-only on sellers assigned to them (and their listings).
- **Guard triggers** (defence in depth): sellers cannot change `verified`, `mentor_id`, `approved_at`, or
  approval `status` (except draft/rejected to pending); `slug` is editable once; 20 listings per seller
  per day; max 5 images/tags per listing; max 3 pickup points, which must be approved and on the seller's
  campus; a listing's pickup point must be one of the seller's own.
- **Sign-up gate** (`gate_signup` on `auth.users`): email domain/address must be allow-listed and POPIA
  consent metadata must be `true`; consent time is stored in `profiles.popia_consent_at` (immutable).
- **Messaging**: conversations, messages and enquiries are readable only by the buyer, the seller's owner and admins (moderation). Mentors have no
  policy on message content. Guard triggers: no self-messaging, message edits limited to the recipient setting `read_at` once, sellers move enquiries
  only new -> in_progress -> completed/declined (completing needs a yes/no), buyers may only confirm or dispute a completed sale once, timestamps and
  `source` are immutable. Rate limits: 30 messages/min per user, 10 new conversations/hour. "System" changes are recognised by
  `auth.uid() is null or pg_trigger_depth() > 1`.
- **Trust**: `seller_trust` is written only by SECURITY DEFINER functions (`private.refresh_seller_trust`), run on every enquiry/verification change
  and nightly (pg_cron `trust-refresh`); `private.auto_confirm_completions` runs nightly (`enquiry-auto-confirm`). Response rate = in-app enquiries from
  the last 90 days answered within 48h / those old enough to judge; WhatsApp-sourced enquiries are excluded. Reply band = median first response over
  30 days (needs 3+ enquiries): <= 1h, <= 6h, <= 24h, else slow.
- **Storage**: `avatars` (512 KB) and `listing-images` (1 MB), webp/jpeg/png only, public read by URL, writes
  restricted to the `{user_id}/` folder. `message-images` (512 KB) is **private**: path `{conversation_id}/{user_id}/{message_id}.webp`, readable and
  uploadable only by the conversation's participants (signed URLs). There is no anonymous listing policy, so buckets cannot be enumerated.

## Verification

- `npm run test:messaging` runs 83 checks on conversations, messages, enquiry rules, trust, notifications, quick replies, private images and rate limits.
- `npm run test:flow` drives a two-user flow in a real browser at 360px.
- `node --env-file=.env.local scripts/rls-test.mjs` runs 30 automated checks (cross-user writes, privilege
  escalation, private data, visibility, sign-up gate, storage isolation).
- `DATABASE_URL=... node scripts/db-audit.mjs` approximates the Supabase advisors (RLS coverage, exposed
  functions, search paths, unindexed FKs, unwrapped `auth.uid()`). Last run: 0 flagged.
