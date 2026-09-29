-- Phase 1: role helpers, sign-up gate, guard triggers, Row Level Security

-- Helper functions live in a private schema so they are NOT exposed by the Data API.
create schema if not exists private;
grant usage on schema private to authenticated, anon;

create or replace function private.app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
create or replace function private.is_mentor() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'mentor' from public.profiles where id = auth.uid()), false)
$$;
create or replace function private.owns_seller(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.seller_profiles where id = sid and user_id = auth.uid())
$$;
create or replace function private.seller_approved(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.seller_profiles where id = sid and status = 'approved')
$$;
create or replace function private.listing_visible(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    where l.id = lid and l.deleted_at is null and not l.hidden_by_moderation
      and private.seller_approved(l.seller_id))
$$;
create or replace function private.owns_listing(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    join public.seller_profiles s on s.id = l.seller_id
    where l.id = lid and s.user_id = auth.uid())
$$;
create or replace function private.in_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    left join public.seller_profiles s on s.id = c.seller_id
    where c.id = cid and (c.buyer_id = auth.uid() or s.user_id = auth.uid()))
$$;
create or replace function private.mentors_seller(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_mentor() and exists (
    select 1 from public.seller_profiles where id = sid and mentor_id = auth.uid())
$$;

-- SIGN-UP GATE: only allow-listed domains or emails, POPIA consent required.
create or replace function private.gate_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare dom text := lower(split_part(new.email, '@', 2));
begin
  if new.email is null then
    raise exception 'An email address is required';
  end if;
  if not (
    exists (select 1 from public.allowed_email_domains where domain = dom)
    or exists (select 1 from public.allowed_emails where email = lower(new.email))
  ) then
    raise exception 'Sign-up is limited to Eduvos student and staff email addresses';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'popia_consent', 'false') <> 'true' then
    raise exception 'You must accept the privacy policy (POPIA consent) to sign up';
  end if;
  return new;
end $$;
create trigger gate_signup before insert on auth.users
  for each row execute function private.gate_signup();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, popia_consent_at)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''), now());
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- GUARD TRIGGERS (defence in depth: column-level rules RLS cannot express)
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Role can only be changed by an admin';
    end if;
    if new.popia_consent_at is distinct from old.popia_consent_at then
      raise exception 'Consent record is immutable';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function private.guard_profile();

create or replace function private.guard_seller() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_admin() then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved' then
      new.approved_at := now();
      update public.profiles set role = 'seller' where id = new.user_id and role = 'buyer';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verified or new.mentor_id is not null or new.status not in ('draft','pending') then
      raise exception 'Not allowed';
    end if;
    if new.user_id <> auth.uid() then raise exception 'Not allowed'; end if;
  else
    if new.verified is distinct from old.verified
       or new.mentor_id is distinct from old.mentor_id
       or new.user_id is distinct from old.user_id
       or new.approved_at is distinct from old.approved_at then
      raise exception 'Not allowed';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('draft','rejected') and new.status = 'pending') then
      raise exception 'Only an admin can change approval status';
    end if;
    if new.slug is distinct from old.slug then
      if old.slug_edited then raise exception 'Your profile link can only be changed once'; end if;
      new.slug_edited := true;
    end if;
  end if;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    new.submitted_at := now();
  end if;
  return new;
end $$;
create trigger guard_seller before insert or update on public.seller_profiles
  for each row execute function private.guard_seller();

create or replace function private.guard_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.seller_profiles;
begin
  select * into s from public.seller_profiles where id = new.seller_id;
  new.campus_id := s.campus_id;
  if auth.uid() is not null and not private.is_admin() then
    if tg_op = 'INSERT' then
      if new.hidden_by_moderation then raise exception 'Not allowed'; end if;
      if (select count(*) from public.listings
          where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 20 then
        raise exception 'Daily listing limit reached (20). Try again tomorrow.';
      end if;
    elsif new.hidden_by_moderation is distinct from old.hidden_by_moderation
       or new.seller_id is distinct from old.seller_id then
      raise exception 'Not allowed';
    end if;
  end if;
  if new.pickup_point_id is not null and not exists (
    select 1 from public.seller_pickup_points
    where seller_id = new.seller_id and pickup_point_id = new.pickup_point_id) then
    raise exception 'Choose one of your approved pickup points';
  end if;
  return new;
end $$;
create trigger guard_listing before insert or update on public.listings
  for each row execute function private.guard_listing();

create or replace function private.guard_listing_image() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 5 then
    raise exception 'A listing can have at most 5 photos';
  end if;
  return new;
end $$;
create trigger guard_listing_image before insert on public.listing_images
  for each row execute function private.guard_listing_image();

create or replace function private.guard_listing_tag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listing_tags where listing_id = new.listing_id) >= 5 then
    raise exception 'A listing can have at most 5 tags';
  end if;
  return new;
end $$;
create trigger guard_listing_tag before insert on public.listing_tags
  for each row execute function private.guard_listing_tag();

create or replace function private.guard_seller_pickup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.pickup_points p
    join public.seller_profiles s on s.campus_id = p.campus_id
    where p.id = new.pickup_point_id and p.approved and s.id = new.seller_id) then
    raise exception 'Pickup point must be an approved point on your campus';
  end if;
  if (select count(*) from public.seller_pickup_points where seller_id = new.seller_id) >= 3 then
    raise exception 'You can choose at most 3 pickup points';
  end if;
  return new;
end $$;
create trigger guard_seller_pickup before insert on public.seller_pickup_points
  for each row execute function private.guard_seller_pickup();

-- Trigger/helper functions must not be callable via the API by anon.
revoke execute on all functions in schema private from public, anon;
grant execute on function private.app_role(), private.is_admin(), private.is_mentor(),
  private.owns_seller(uuid), private.seller_approved(uuid), private.listing_visible(uuid),
  private.owns_listing(uuid), private.in_conversation(uuid), private.mentors_seller(uuid)
  to authenticated, anon;

-- ROW LEVEL SECURITY: enable on every table
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Reference data: public read, admin write
create policy campuses_read on public.campuses for select using (true);
create policy campuses_admin on public.campuses for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_read on public.categories for select using (true);
create policy categories_admin on public.categories for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy pickup_read on public.pickup_points for select using (approved or (select private.is_admin()));
create policy pickup_admin on public.pickup_points for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy flags_read on public.feature_flags for select using (true);
create policy flags_admin on public.feature_flags for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy domains_admin on public.allowed_email_domains for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy emails_admin on public.allowed_emails for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tags_read on public.tags for select using (true);
create policy tags_insert on public.tags for insert to authenticated with check (true);
create policy tags_admin on public.tags for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tags_admin_del on public.tags for delete to authenticated using ((select private.is_admin()));

-- Profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Sellers
create policy seller_select on public.seller_profiles for select
  using (status = 'approved' or user_id = (select auth.uid())
         or (select private.is_admin()) or private.mentors_seller(id));
create policy seller_insert on public.seller_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy seller_update on public.seller_profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
create policy seller_delete on public.seller_profiles for delete to authenticated
  using ((select private.is_admin()));
create policy seller_private_owner on public.seller_private for all to authenticated
  using (private.owns_seller(seller_id)) with check (private.owns_seller(seller_id));
create policy spp_select on public.seller_pickup_points for select
  using (private.seller_approved(seller_id) or private.owns_seller(seller_id) or (select private.is_admin()));
create policy spp_insert on public.seller_pickup_points for insert to authenticated
  with check (private.owns_seller(seller_id));
create policy spp_delete on public.seller_pickup_points for delete to authenticated
  using (private.owns_seller(seller_id));
create policy drafts_owner on public.seller_drafts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Listings
create policy listings_select on public.listings for select
  using (private.listing_visible(id) or private.owns_seller(seller_id) or (select private.is_admin())
         or private.mentors_seller(seller_id));
create policy listings_insert on public.listings for insert to authenticated
  with check (private.owns_seller(seller_id));
create policy listings_update on public.listings for update to authenticated
  using (private.owns_seller(seller_id) or (select private.is_admin()))
  with check (private.owns_seller(seller_id) or (select private.is_admin()));
create policy listings_delete on public.listings for delete to authenticated
  using ((select private.is_admin()));
create policy images_select on public.listing_images for select
  using (private.listing_visible(listing_id) or private.owns_listing(listing_id) or (select private.is_admin()));
create policy images_write on public.listing_images for insert to authenticated
  with check (private.owns_listing(listing_id));
create policy images_update on public.listing_images for update to authenticated
  using (private.owns_listing(listing_id)) with check (private.owns_listing(listing_id));
create policy images_delete on public.listing_images for delete to authenticated
  using (private.owns_listing(listing_id) or (select private.is_admin()));
create policy ltags_select on public.listing_tags for select
  using (private.listing_visible(listing_id) or private.owns_listing(listing_id));
create policy ltags_insert on public.listing_tags for insert to authenticated
  with check (private.owns_listing(listing_id));
create policy ltags_delete on public.listing_tags for delete to authenticated
  using (private.owns_listing(listing_id));

-- Conversations / messages / enquiries
create policy conv_select on public.conversations for select to authenticated
  using (buyer_id = (select auth.uid()) or private.owns_seller(seller_id) or (select private.is_admin()));
create policy conv_insert on public.conversations for insert to authenticated
  with check (buyer_id = (select auth.uid()) and private.seller_approved(seller_id));
create policy msg_select on public.messages for select to authenticated
  using (private.in_conversation(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.in_conversation(conversation_id));
create policy msg_update on public.messages for update to authenticated
  using (private.in_conversation(conversation_id) and sender_id <> (select auth.uid()))
  with check (private.in_conversation(conversation_id));
create policy enq_select on public.enquiries for select to authenticated
  using (private.in_conversation(conversation_id) or (select private.is_admin()));
create policy enq_insert on public.enquiries for insert to authenticated
  with check (private.in_conversation(conversation_id));
create policy enq_update on public.enquiries for update to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and private.owns_seller(c.seller_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and private.owns_seller(c.seller_id)));

-- Reports, audit, flags
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy reports_update on public.reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy audit_select on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- Engagement
create policy featured_read on public.featured_slots for select using (true);
create policy featured_admin on public.featured_slots for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy saved_owner on public.saved_listings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy follows_owner on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy views_insert on public.listing_views for insert to authenticated
  with check (viewer_id = (select auth.uid()) and private.listing_visible(listing_id));
create policy views_select on public.listing_views for select to authenticated
  using (private.owns_listing(listing_id) or (select private.is_admin()));

-- Looking For
create policy req_select on public.requests for select to authenticated using (true);
create policy req_insert on public.requests for insert to authenticated
  with check (buyer_id = (select auth.uid()));
create policy req_update on public.requests for update to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_admin()))
  with check (buyer_id = (select auth.uid()) or (select private.is_admin()));
create policy req_delete on public.requests for delete to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_admin()));
create policy resp_select on public.request_responses for select to authenticated
  using (private.owns_seller(seller_id)
         or exists (select 1 from public.requests r where r.id = request_id and r.buyer_id = (select auth.uid())));
create policy resp_insert on public.request_responses for insert to authenticated
  with check (private.owns_seller(seller_id) and private.seller_approved(seller_id));

-- Flagged features
create policy reviews_read on public.reviews for select using (true);
create policy payments_select on public.payments for select to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_admin()));

-- STORAGE: public-read buckets, owner-folder writes, size + mime limits
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 524288, array['image/webp','image/jpeg','image/png']),
  ('listing-images', 'listing-images', true, 1048576, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy storage_owner_select on storage.objects for select to authenticated
  using (bucket_id in ('avatars','listing-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','listing-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_owner_update on storage.objects for update to authenticated
  using (bucket_id in ('avatars','listing-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_owner_delete on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','listing-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
