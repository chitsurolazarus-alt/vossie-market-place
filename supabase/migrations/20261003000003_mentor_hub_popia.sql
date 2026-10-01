-- Phase 5 (3/3): mentor layer, Hub Growth corner, seller activity stats, POPIA account deletion.

-- ---------------------------------------------------------------------------
-- 1. Seller activity stats for mentors (aggregates only; mentors never see message content)
-- ---------------------------------------------------------------------------
alter table public.seller_trust
  add column enquiries_14d int not null default 0,
  add column enquiries_30d int not null default 0,
  add column whatsapp_30d int not null default 0,
  add column listing_views_30d int not null default 0,
  add column last_active_at timestamptz,
  add column last_listing_update_at timestamptz,
  add column hidden_listings_14d int not null default 0;

create or replace function private.refresh_seller_trust(sid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s record; r record; rs record; a record; rate numeric; days int; v_tier text; band text;
begin
  select id, user_id, verified, created_at, status into s from public.seller_profiles where id = sid;
  if not found then return; end if;
  select
    count(*) filter (where source = 'in_app' and created_at > now() - interval '90 days'
                       and (first_response_at is not null or created_at < now() - interval '48 hours')) as enq,
    count(*) filter (where source = 'in_app' and created_at > now() - interval '90 days'
                       and first_response_at is not null and first_response_at <= created_at + interval '48 hours') as replied,
    count(*) filter (where sale_happened and buyer_confirmed_at is not null) as confirmed,
    count(*) filter (where source = 'whatsapp' and created_at > now() - interval '90 days') as wa,
    count(*) filter (where created_at > now() - interval '14 days') as e14,
    count(*) filter (where source = 'in_app' and created_at > now() - interval '30 days') as e30
  into r from public.enquiries where seller_id = sid;
  select n, median_s into rs from private.seller_reply_stats where seller_id = sid;
  select
    (select count(*) from public.enquiry_events ev join public.enquiries e on e.id = ev.enquiry_id
       where e.seller_id = sid and ev.type = 'whatsapp_handoff' and ev.created_at > now() - interval '30 days') as h30,
    (select count(*) from public.enquiry_events ev join public.enquiries e on e.id = ev.enquiry_id
       where e.seller_id = sid and ev.type = 'whatsapp_handoff' and ev.created_at > now() - interval '14 days') as h14,
    (select count(*) from public.listing_views v join public.listings l on l.id = v.listing_id
       where l.seller_id = sid and v.view_date > current_date - 30) as views30,
    (select max(updated_at) from public.listings where seller_id = sid and deleted_at is null) as last_listing,
    (select count(*) from public.listings where seller_id = sid and hidden_by_moderation
       and moderation_hidden_at > now() - interval '14 days') as hidden14,
    (select last_seen_at from public.profiles where id = s.user_id) as last_seen
  into a;

  rate := case when r.enq > 0 then round(r.replied::numeric / r.enq, 4) end;
  days := greatest(0, floor(extract(epoch from (now() - s.created_at)) / 86400))::int;

  select tt.tier into v_tier from public.trust_tiers tt
   where tt.min_enquiries <= r.enq
     and (tt.min_response_rate = 0 or coalesce(rate, 0) >= tt.min_response_rate)
     and tt.min_confirmed <= r.confirmed
     and tt.min_account_days <= days
     and (not tt.requires_verified or s.verified)
   order by tt.rank desc limit 1;

  band := case when coalesce(rs.n, 0) < 3 then null
               when rs.median_s <= 3600 then 'hour'
               when rs.median_s <= 6 * 3600 then 'hours'
               when rs.median_s <= 24 * 3600 then 'day'
               else 'slow' end;

  insert into public.seller_trust as t (seller_id, tier, enquiries_90d, replied_90d, response_rate, confirmed_sales,
      account_days, verified, reply_enquiries_30d, median_reply_seconds, reply_band, whatsapp_leads_90d, updated_at,
      enquiries_14d, enquiries_30d, whatsapp_30d, listing_views_30d, last_active_at, last_listing_update_at, hidden_listings_14d)
  values (sid, coalesce(v_tier, 'new'), r.enq, r.replied, rate, r.confirmed, days, s.verified,
      coalesce(rs.n, 0), rs.median_s, band, r.wa, now(),
      r.e14 + a.h14, r.e30, a.h30, a.views30, a.last_seen, a.last_listing, a.hidden14)
  on conflict (seller_id) do update set tier = excluded.tier, enquiries_90d = excluded.enquiries_90d,
      replied_90d = excluded.replied_90d, response_rate = excluded.response_rate,
      confirmed_sales = excluded.confirmed_sales, account_days = excluded.account_days,
      verified = excluded.verified, reply_enquiries_30d = excluded.reply_enquiries_30d,
      median_reply_seconds = excluded.median_reply_seconds, reply_band = excluded.reply_band,
      whatsapp_leads_90d = excluded.whatsapp_leads_90d, updated_at = excluded.updated_at,
      enquiries_14d = excluded.enquiries_14d, enquiries_30d = excluded.enquiries_30d, whatsapp_30d = excluded.whatsapp_30d,
      listing_views_30d = excluded.listing_views_30d, last_active_at = excluded.last_active_at,
      last_listing_update_at = excluded.last_listing_update_at, hidden_listings_14d = excluded.hidden_listings_14d;
end $$;

create or replace function private.listing_hidden_trust_refresh() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_seller_trust(new.seller_id);
  return null;
end $$;
create trigger listing_hidden_trust_refresh after update of hidden_by_moderation on public.listings
  for each row execute function private.listing_hidden_trust_refresh();

-- ---------------------------------------------------------------------------
-- 2. Mentor notes and check-ins (private to the mentor; admins can read)
-- ---------------------------------------------------------------------------
create table public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index mentor_notes_seller_idx on public.mentor_notes (seller_id, created_at desc);
create index mentor_notes_mentor_idx on public.mentor_notes (mentor_id);
create table public.mentor_checkins (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete set null,
  note text check (char_length(note) <= 500),
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index mentor_checkins_seller_idx on public.mentor_checkins (seller_id, checked_in_at desc);
create index mentor_checkins_mentor_idx on public.mentor_checkins (mentor_id);
alter table public.mentor_notes enable row level security;
alter table public.mentor_checkins enable row level security;
create policy mnotes_select on public.mentor_notes for select to authenticated
  using ((mentor_id = (select auth.uid()) and private.mentors_seller(seller_id)) or (select private.is_admin()));
create policy mnotes_insert on public.mentor_notes for insert to authenticated
  with check (mentor_id = (select auth.uid()) and private.mentors_seller(seller_id));
create policy mnotes_delete on public.mentor_notes for delete to authenticated
  using (mentor_id = (select auth.uid()));
create policy mcheck_select on public.mentor_checkins for select to authenticated
  using ((mentor_id = (select auth.uid()) and private.mentors_seller(seller_id)) or (select private.is_admin()));
create policy mcheck_insert on public.mentor_checkins for insert to authenticated
  with check (mentor_id = (select auth.uid()) and private.mentors_seller(seller_id));
revoke all on public.mentor_notes, public.mentor_checkins from anon;
revoke update, truncate on public.mentor_notes, public.mentor_checkins from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hub Growth corner: tips, events (RSVP) and mentor office hours (booking requests)
-- ---------------------------------------------------------------------------
create table public.hub_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tip', 'event', 'office_hours')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  cover_path text,
  campus_id uuid references public.campuses(id) on delete set null,
  event_at timestamptz,
  venue text check (char_length(venue) <= 120),
  capacity int check (capacity is null or capacity > 0),
  published boolean not null default true,
  rsvp_count int not null default 0,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'event' or event_at is not null)
);
create index hub_posts_feed_idx on public.hub_posts (published, created_at desc);
create index hub_posts_campus_idx on public.hub_posts (campus_id);
create index hub_posts_author_idx on public.hub_posts (author_id);
create index hub_posts_kind_idx on public.hub_posts (kind, event_at);

create table public.hub_rsvps (
  post_id uuid not null references public.hub_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index hub_rsvps_user_idx on public.hub_rsvps (user_id);

create table public.hub_bookings (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hub_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 300),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined')),
  host_note text check (char_length(host_note) <= 300),
  created_at timestamptz not null default now()
);
create unique index hub_bookings_one_open on public.hub_bookings (post_id, user_id) where status = 'requested';
create index hub_bookings_user_idx on public.hub_bookings (user_id);
create index hub_bookings_post_idx on public.hub_bookings (post_id, status);

alter table public.hub_posts enable row level security;
alter table public.hub_rsvps enable row level security;
alter table public.hub_bookings enable row level security;

create policy hub_select on public.hub_posts for select
  using (published or author_id = (select auth.uid()) or (select private.is_admin()));
create policy hub_insert on public.hub_posts for insert to authenticated
  with check ((select private.is_staff()) and author_id = (select auth.uid()));
create policy hub_update on public.hub_posts for update to authenticated
  using ((select private.is_staff()) and (author_id = (select auth.uid()) or (select private.is_admin())))
  with check ((select private.is_staff()) and (author_id = (select auth.uid()) or (select private.is_admin())));
create policy hub_delete on public.hub_posts for delete to authenticated
  using ((select private.is_staff()) and (author_id = (select auth.uid()) or (select private.is_admin())));

create or replace function private.hub_post_host(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.hub_posts where id = pid and (author_id = auth.uid() or private.is_admin()))
$$;
grant execute on function private.hub_post_host(uuid) to authenticated;

create policy rsvp_select on public.hub_rsvps for select to authenticated
  using (user_id = (select auth.uid()) or private.hub_post_host(post_id));
create policy rsvp_insert on public.hub_rsvps for insert to authenticated with check (user_id = (select auth.uid()));
create policy rsvp_delete on public.hub_rsvps for delete to authenticated using (user_id = (select auth.uid()));
create policy booking_select on public.hub_bookings for select to authenticated
  using (user_id = (select auth.uid()) or private.hub_post_host(post_id));
create policy booking_insert on public.hub_bookings for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'requested');
create policy booking_update on public.hub_bookings for update to authenticated
  using (private.hub_post_host(post_id)) with check (private.hub_post_host(post_id));
revoke all on public.hub_rsvps, public.hub_bookings from anon;
revoke update, truncate on public.hub_rsvps from authenticated;
revoke delete, truncate on public.hub_bookings from authenticated;

create or replace function private.hub_post_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and pg_trigger_depth() = 1 then
    new.rsvp_count := old.rsvp_count;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger hub_post_before_write before update on public.hub_posts
  for each row execute function private.hub_post_before_write();

create or replace function private.hub_rsvp_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.hub_posts;
begin
  select * into p from public.hub_posts where id = new.post_id;
  if not found or p.kind <> 'event' or not p.published then raise exception 'You can only RSVP to published events'; end if;
  if auth.uid() is not null and private.is_blocked(auth.uid()) then raise exception 'account_suspended'; end if;
  if p.capacity is not null and (select count(*) from public.hub_rsvps where post_id = new.post_id) >= p.capacity then
    raise exception 'event_full';
  end if;
  return new;
end $$;
create trigger hub_rsvp_before_insert before insert on public.hub_rsvps
  for each row execute function private.hub_rsvp_before_insert();

create or replace function private.hub_rsvp_count() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.hub_posts set rsvp_count = (select count(*) from public.hub_rsvps where post_id = pid) where id = pid;
  return null;
end $$;
create trigger hub_rsvp_count after insert or delete on public.hub_rsvps
  for each row execute function private.hub_rsvp_count();

create or replace function private.hub_booking_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.hub_posts;
begin
  if tg_op = 'INSERT' then
    select * into p from public.hub_posts where id = new.post_id;
    if not found or p.kind <> 'office_hours' or not p.published then raise exception 'That session is not open for booking'; end if;
    if auth.uid() is not null and private.is_blocked(auth.uid()) then raise exception 'account_suspended'; end if;
  elsif auth.uid() is not null and pg_trigger_depth() = 1 then
    if (new.post_id, new.user_id, new.message, new.created_at) is distinct from (old.post_id, old.user_id, old.message, old.created_at) then
      raise exception 'Not allowed';
    end if;
    if new.status = 'requested' and old.status <> 'requested' then raise exception 'Not allowed'; end if;
  end if;
  return new;
end $$;
create trigger hub_booking_guard before insert or update on public.hub_bookings
  for each row execute function private.hub_booking_guard();

create or replace function private.hub_booking_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.hub_posts; who text;
begin
  select * into p from public.hub_posts where id = new.post_id;
  if tg_op = 'INSERT' then
    select private.display_first_name(display_name) into who from public.profiles where id = new.user_id;
    perform private.notify(p.author_id, 'hub_booking', 'New office-hours request',
      coalesce(who, 'A seller') || ' asked to book "' || p.title || '"' || coalesce(': ' || nullif(new.message, ''), ''), '/growth/manage', null, null);
  elsif new.status is distinct from old.status then
    perform private.notify(new.user_id, 'hub_booking',
      case new.status when 'confirmed' then 'Your office-hours request is confirmed' else 'Your office-hours request was declined' end,
      '"' || p.title || '"' || coalesce(' · ' || nullif(new.host_note, ''), ''), '/growth/' || p.id, null, null);
  end if;
  return null;
end $$;
create trigger hub_booking_notify after insert or update on public.hub_bookings
  for each row execute function private.hub_booking_notify();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-covers', 'hub-covers', true, 409600, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 409600;
create policy hubcover_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hub-covers' and (select private.is_staff()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy hubcover_update on storage.objects for update to authenticated
  using (bucket_id = 'hub-covers' and (select private.is_staff()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy hubcover_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hub-covers' and (select private.is_staff()) and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 4. POPIA: delete my account. Immediate soft-delete with scrub; hard delete after 30 days.
--    Content other people rely on (messages, enquiries, reports) survives anonymised ("Deleted user").
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages alter column sender_id drop not null;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete set null;
alter table public.conversations drop constraint if exists conversations_buyer_id_fkey;
alter table public.conversations alter column buyer_id drop not null;
alter table public.conversations add constraint conversations_buyer_id_fkey foreign key (buyer_id) references public.profiles(id) on delete set null;
alter table public.enquiries drop constraint if exists enquiries_buyer_id_fkey;
alter table public.enquiries alter column buyer_id drop not null;
alter table public.enquiries add constraint enquiries_buyer_id_fkey foreign key (buyer_id) references public.profiles(id) on delete set null;
alter table public.seller_profiles drop constraint if exists seller_profiles_user_id_fkey;
alter table public.seller_profiles alter column user_id drop not null;
alter table public.seller_profiles add constraint seller_profiles_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.seller_profiles drop constraint if exists seller_profiles_mentor_id_fkey;
alter table public.seller_profiles add constraint seller_profiles_mentor_id_fkey foreign key (mentor_id) references public.profiles(id) on delete set null;
alter table public.payments drop constraint if exists payments_buyer_id_fkey;
alter table public.payments alter column buyer_id drop not null;
alter table public.payments add constraint payments_buyer_id_fkey foreign key (buyer_id) references public.profiles(id) on delete set null;

create or replace function private.profile_scrub() returns trigger
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if not (old.deleted_at is null and new.deleted_at is not null) then return null; end if;
  select id into sid from public.seller_profiles where user_id = new.id;
  update public.profiles set display_name = 'Deleted user', avatar_url = null, phone = null, email = null, low_data_mode = false where id = new.id;
  if sid is not null then
    update public.seller_profiles set business_name = 'Deleted seller', slug = 'deleted-' || left(replace(sid::text, '-', ''), 10),
           tagline = null, bio = null, photo_url = null, status = 'suspended', verified = false where id = sid;
    delete from public.seller_private where seller_id = sid;
    update public.listings set deleted_at = coalesce(deleted_at, now()) where seller_id = sid;
    delete from public.quick_replies where seller_id = sid;
    delete from public.follows where seller_id = sid;
    delete from public.featured_slots where seller_id = sid;
    update public.conversations set seller_name = 'Deleted user' where seller_id = sid;
  end if;
  update public.conversations set buyer_name = 'Deleted user' where buyer_id = new.id;
  update public.messages set image_path = null where sender_id = new.id and image_path is not null;
  delete from public.saved_listings where user_id = new.id;
  delete from public.follows where user_id = new.id;
  delete from public.notifications where user_id = new.id;
  delete from public.notification_prefs where user_id = new.id;
  delete from public.push_subscriptions where user_id = new.id;
  delete from public.email_queue where user_id = new.id;
  delete from public.hub_rsvps where user_id = new.id;
  delete from public.hub_bookings where user_id = new.id and status = 'requested';
  delete from public.seller_drafts where user_id = new.id;
  update public.audit_log set actor_id = null where actor_id = new.id;
  insert into public.audit_log (actor_id, action, target_type, target_id, detail)
  values (null, 'account.deleted', 'user', new.id::text, jsonb_build_object('hard_delete_after', now() + interval '30 days'));
  return null;
end $$;
create trigger profile_scrub after update of deleted_at on public.profiles
  for each row execute function private.profile_scrub();

create or replace function private.hard_delete_accounts() returns int
language plpgsql security definer set search_path = '' as $$
declare p record; n int := 0;
begin
  for p in select id from public.profiles where deleted_at < now() - interval '30 days' loop
    delete from auth.users where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $$;
select cron.schedule('hard-delete-accounts', '45 0 * * *', $$select private.hard_delete_accounts()$$);

revoke execute on function
  private.refresh_seller_trust(uuid), private.listing_hidden_trust_refresh(), private.hub_post_before_write(),
  private.hub_rsvp_before_insert(), private.hub_rsvp_count(), private.hub_booking_guard(), private.hub_booking_notify(),
  private.profile_scrub(), private.hard_delete_accounts()
  from public, anon, authenticated;

select private.refresh_all_trust();
