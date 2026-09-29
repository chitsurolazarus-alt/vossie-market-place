-- Vossie Market Place: core schema (Phase 1)
create extension if not exists pgcrypto;

-- ENUMS
create type public.user_role as enum ('buyer','seller','mentor','admin');
create type public.seller_status as enum ('draft','pending','approved','rejected','suspended');
create type public.contact_pref as enum ('in_app','whatsapp','both');
create type public.pricing_mode as enum ('cash','swap','both');
create type public.listing_kind as enum ('product','service');
create type public.availability as enum ('available','sold_out','paused');
create type public.enquiry_status as enum ('new','in_progress','completed');
create type public.report_reason as enum ('spam','scam','inappropriate','unsafe','wrong_category','other');
create type public.report_target as enum ('listing','user','request');
create type public.report_status as enum ('pending','actioned','dismissed');
create type public.request_status as enum ('open','fulfilled','closed');
create type public.payment_status as enum ('pending','paid','failed','refunded');

-- CAMPUSES / CATEGORIES
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

-- EMAIL ALLOW-LIST (sign-up gate)
create table public.allowed_email_domains (
  domain text primary key check (domain = lower(domain)),
  created_at timestamptz not null default now()
);
create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

-- PROFILES (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  phone text,
  role public.user_role not null default 'buyer',
  campus_id uuid references public.campuses(id),
  popia_consent_at timestamptz,
  onboarding_seen boolean not null default false,
  seller_tour_seen boolean not null default false,
  low_data_mode boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  name text not null,
  description text,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (campus_id, name)
);

create table public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  campus_id uuid not null references public.campuses(id),
  category_id uuid references public.categories(id),
  business_name text not null check (char_length(business_name) between 2 and 60),
  slug text not null unique,
  slug_edited boolean not null default false,
  tagline text check (char_length(tagline) <= 80),
  bio text check (char_length(bio) <= 500),
  photo_url text,
  contact_pref public.contact_pref not null default 'in_app',
  status public.seller_status not null default 'draft',
  verified boolean not null default false,
  mentor_id uuid references public.profiles(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campus_id, business_name)
);
-- WhatsApp number is private: separate table, owner + service role only.
create table public.seller_private (
  seller_id uuid primary key references public.seller_profiles(id) on delete cascade,
  whatsapp_e164 text check (whatsapp_e164 ~ '^\+27[0-9]{9}$')
);
create table public.seller_pickup_points (
  seller_id uuid references public.seller_profiles(id) on delete cascade,
  pickup_point_id uuid references public.pickup_points(id) on delete cascade,
  primary key (seller_id, pickup_point_id)
);
create table public.seller_drafts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- LISTINGS
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  campus_id uuid not null references public.campuses(id),
  category_id uuid references public.categories(id),
  kind public.listing_kind not null default 'product',
  title text not null check (char_length(title) between 3 and 70),
  description text check (char_length(description) <= 1000),
  pricing_mode public.pricing_mode not null default 'cash',
  price_zar int check (price_zar >= 0),
  price_is_from boolean not null default false,
  swap_for text check (char_length(swap_for) <= 200),
  availability public.availability not null default 'available',
  pickup_point_id uuid references public.pickup_points(id),
  delivered_on_campus boolean not null default false,
  hidden_by_moderation boolean not null default false,
  deleted_at timestamptz,
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_required check (pricing_mode = 'swap' or price_zar is not null),
  constraint swap_required check (pricing_mode = 'cash' or coalesce(swap_for,'') <> '')
);
create index listings_seller_idx on public.listings(seller_id);
create index listings_campus_cat_idx on public.listings(campus_id, category_id) where deleted_at is null;
create index listings_search_idx on public.listings using gin(search);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  path text not null,
  alt text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index listing_images_listing_idx on public.listing_images(listing_id, position);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name = lower(name) and char_length(name) between 2 and 30)
);
create table public.listing_tags (
  listing_id uuid references public.listings(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (listing_id, tag_id)
);

-- BUYER-SELLER
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  status public.enquiry_status not null default 'new',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- SAFETY / MODERATION
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note text check (char_length(note) <= 500),
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text
);

-- ENGAGEMENT
create table public.featured_slots (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  campus_id uuid not null references public.campuses(id),
  slot_date date not null,
  position int not null default 1,
  is_override boolean not null default false,
  unique (campus_id, slot_date, position)
);
create table public.saved_listings (
  user_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table public.follows (
  user_id uuid references public.profiles(id) on delete cascade,
  seller_id uuid references public.seller_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, seller_id)
);
create table public.listing_views (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  view_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (listing_id, viewer_id, view_date)
);

-- LOOKING FOR
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  campus_id uuid not null references public.campuses(id),
  category_id uuid references public.categories(id),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 800),
  budget_zar int check (budget_zar >= 0),
  open_to_swap boolean not null default false,
  deadline date,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now()
);
create table public.request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  unique (request_id, seller_id)
);

-- UNUSED FOR NOW (flagged features)
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null unique references public.enquiries(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  thumbs_up boolean not null,
  body text check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.enquiries(id) on delete set null,
  buyer_id uuid not null references public.profiles(id),
  amount_zar int not null check (amount_zar > 0),
  paystack_reference text unique,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Foreign-key indexes for RLS and join performance
create index on public.seller_profiles(campus_id);
create index on public.seller_profiles(category_id);
create index on public.seller_profiles(mentor_id);
create index on public.listings(category_id);
create index on public.listings(pickup_point_id);
create index on public.listing_tags(tag_id);
create index on public.conversations(buyer_id);
create index on public.conversations(seller_id);
create index on public.conversations(listing_id);
create index on public.messages(sender_id);
create index on public.reports(reporter_id);
create index on public.reports(target_type, target_id);
create index on public.featured_slots(seller_id);
create index on public.saved_listings(listing_id);
create index on public.follows(seller_id);
create index on public.listing_views(viewer_id);
create index on public.requests(buyer_id);
create index on public.requests(campus_id);
create index on public.requests(category_id);
create index on public.request_responses(seller_id);
create index on public.request_responses(listing_id);
create index on public.reviews(reviewer_id);
create index on public.payments(buyer_id);
create index on public.payments(enquiry_id);
create index on public.pickup_points(campus_id);
create index on public.audit_log(actor_id);
create index on public.profiles(campus_id);
create index on public.seller_pickup_points(pickup_point_id);

-- Full-text search maintenance
create or replace function public.listings_search_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.search := to_tsvector('english', coalesce(new.title,'') || ' ' || coalesce(new.description,''));
  new.updated_at := now();
  return new;
end $$;
create trigger listings_search_trg before insert or update on public.listings
  for each row execute function public.listings_search_update();
