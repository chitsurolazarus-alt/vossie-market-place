-- Phase 5 (2/3): reports, suspension, append-only audit log, admin actions.
-- "System" changes (cron, service role, or a change made by another trigger) are recognised with
-- `auth.uid() is null or pg_trigger_depth() > 1`, as in Phase 4.

-- ---------------------------------------------------------------------------
-- 1. Site settings (admin-editable, public read): auto-hide threshold, Information Officer, policy version
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create index site_settings_updated_by_idx on public.site_settings (updated_by);
insert into public.site_settings (key, value, description) values
  ('auto_hide_threshold', '{"n": 3}', 'Unique reporters (pending review) after which a listing is hidden automatically'),
  ('information_officer', '{"name": "Incubation Hub Information Officer", "email": null, "phone": null, "note": "Contact details to be confirmed by the Incubation Hub before launch."}', 'POPIA Information Officer shown on /privacy'),
  ('policy_version', '{"version": "2026-10"}', 'Current privacy policy version');
alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select using (true);
create policy settings_admin_insert on public.site_settings for insert to authenticated with check ((select private.is_admin()));
create policy settings_admin_update on public.site_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy settings_admin_delete on public.site_settings for delete to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. Profiles: email (admin search), activity, suspension and ban
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column email text,
  add column last_seen_at timestamptz,
  add column suspended_until timestamptz,
  add column suspension_reason text,
  add column banned_at timestamptz,
  add column ban_reason text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
create index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);
create index profiles_last_seen_idx on public.profiles (last_seen_at);

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, popia_consent_at, email)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''), now(), lower(new.email));
  return new;
end $$;

create or replace function private.is_blocked(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.deleted_at is not null or p.banned_at is not null or coalesce(p.suspended_until > now(), false)
                   from public.profiles p where p.id = uid), false)
$$;
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin', 'mentor') and deleted_at is null and banned_at is null
                   from public.profiles where id = auth.uid()), false)
$$;
grant execute on function private.is_blocked(uuid), private.is_staff() to authenticated, anon;

-- A suspended, banned or deleted owner hides their profile and listings everywhere (and it returns when the suspension ends).
create or replace function private.seller_approved(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.seller_profiles where id = sid and status = 'approved' and not private.is_blocked(user_id))
$$;
drop policy if exists seller_select on public.seller_profiles;
create policy seller_select on public.seller_profiles for select
  using ((status = 'approved' and not private.is_blocked(user_id)) or user_id = (select auth.uid())
         or (select private.is_admin()) or private.mentors_seller(id));

create or replace view public.browse_listings with (security_invoker = true) as
select
  l.id, l.seller_id, l.campus_id, l.category_id, l.kind, l.title, l.description,
  l.pricing_mode, l.price_zar, l.price_is_from, l.swap_for, l.availability, l.created_at, l.search,
  s.business_name, s.slug as seller_slug, s.verified as seller_verified, s.photo_url as seller_photo,
  c.name as category_name, c.slug as category_slug, ca.name as campus_name,
  img.path as cover_path, img.alt as cover_alt,
  coalesce(tg.tags, '{}'::text[]) as tags,
  st.tier as seller_tier, st.reply_band as seller_reply_band, tt.label as seller_tier_label
from public.listings l
join public.seller_profiles s on s.id = l.seller_id and s.status = 'approved' and not private.is_blocked(s.user_id)
left join public.categories c on c.id = l.category_id
left join public.campuses ca on ca.id = l.campus_id
left join public.seller_trust st on st.seller_id = l.seller_id
left join public.trust_tiers tt on tt.tier = st.tier
left join lateral (
  select i.path, i.alt from public.listing_images i where i.listing_id = l.id order by i.position limit 1
) img on true
left join lateral (
  select array_agg(t.name order by t.name) as tags
  from public.listing_tags lt join public.tags t on t.id = lt.tag_id where lt.listing_id = l.id
) tg on true
where l.deleted_at is null and not l.hidden_by_moderation and l.availability <> 'paused';
grant select on public.browse_listings to anon, authenticated;

-- Profile guard: users cannot touch role, consent, moderation fields or e-mail; deletion cannot be undone.
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Role can only be changed by an admin';
    end if;
    if new.popia_consent_at is distinct from old.popia_consent_at then
      raise exception 'Consent record is immutable';
    end if;
    if new.suspended_until is distinct from old.suspended_until or new.suspension_reason is distinct from old.suspension_reason
       or new.banned_at is distinct from old.banned_at or new.ban_reason is distinct from old.ban_reason
       or new.email is distinct from old.email then
      raise exception 'Not allowed';
    end if;
    if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
      raise exception 'Not allowed';
    end if;
  end if;
  return new;
end $$;

-- The last active admin can never be demoted, banned, deleted or removed.
create or replace function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare risky boolean;
begin
  if tg_op = 'DELETE' then
    risky := old.role = 'admin';
  else
    risky := old.role = 'admin' and old.deleted_at is null and old.banned_at is null
      and (new.role <> 'admin' or new.deleted_at is not null or new.banned_at is not null);
  end if;
  if risky and not exists (select 1 from public.profiles
       where role = 'admin' and id <> old.id and deleted_at is null and banned_at is null) then
    raise exception 'last_admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger guard_last_admin before update of role, deleted_at, banned_at or delete on public.profiles
  for each row execute function private.guard_last_admin();

-- Suspended / banned / deleted users can sign in but cannot list or message.
create or replace function private.guard_not_blocked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 and private.is_blocked(auth.uid()) then
    raise exception 'account_suspended';
  end if;
  return new;
end $$;
create trigger guard_not_blocked before insert or update on public.listings
  for each row execute function private.guard_not_blocked();
create trigger guard_not_blocked before insert on public.messages
  for each row execute function private.guard_not_blocked();
create trigger guard_not_blocked before insert on public.conversations
  for each row execute function private.guard_not_blocked();

-- guard_listing / guard_seller: also allow changes made by other triggers (auto-hide, account scrub).
create or replace function private.guard_listing() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.seller_profiles;
begin
  select * into s from public.seller_profiles where id = new.seller_id;
  new.campus_id := s.campus_id;
  if auth.uid() is not null and pg_trigger_depth() = 1 and not private.is_admin() then
    if tg_op = 'INSERT' then
      if new.hidden_by_moderation then raise exception 'Not allowed'; end if;
      if (select count(*) from public.listings
          where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 20 then
        raise exception 'Daily listing limit reached (20). Try again tomorrow.';
      end if;
    elsif new.hidden_by_moderation is distinct from old.hidden_by_moderation
       or new.moderation_hidden_reason is distinct from old.moderation_hidden_reason
       or new.moderation_hidden_at is distinct from old.moderation_hidden_at
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

alter table public.listings
  add column moderation_hidden_at timestamptz,
  add column moderation_hidden_reason text check (moderation_hidden_reason in ('auto', 'admin'));
create index listings_hidden_idx on public.listings (moderation_hidden_at) where hidden_by_moderation;

alter table public.seller_profiles
  add column review_reason text,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz;
create index seller_profiles_reviewed_by_idx on public.seller_profiles (reviewed_by);
create index seller_profiles_mentor_idx on public.seller_profiles (mentor_id);
create index seller_profiles_status_submitted_idx on public.seller_profiles (status, submitted_at);

create or replace function private.guard_seller() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin() then
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
       or new.approved_at is distinct from old.approved_at
       or new.review_reason is distinct from old.review_reason
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
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

-- Stamp when moderation hides/restores a listing
create or replace function private.listing_moderation_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hidden_by_moderation and not old.hidden_by_moderation then
    new.moderation_hidden_at := now();
    new.moderation_hidden_reason := coalesce(new.moderation_hidden_reason, 'admin');
  elsif not new.hidden_by_moderation and old.hidden_by_moderation then
    new.moderation_hidden_at := null;
    new.moderation_hidden_reason := null;
  end if;
  return new;
end $$;
create trigger listing_moderation_stamp before update of hidden_by_moderation on public.listings
  for each row execute function private.listing_moderation_stamp();

-- ---------------------------------------------------------------------------
-- 3. Notifications: more types, null-safe notify()
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_enquiry','new_message','status_change','completion_request','completion_confirmed',
  'moderation','report_update','seller_review','warning','hub_booking','hub_update'));

create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_url text,
                                          p_conv uuid, p_enq uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n record;
begin
  if p_user is null then return; end if;
  if p_type = 'new_message' then
    select id, read_at into n from public.notifications
      where user_id = p_user and type = 'new_message' and conversation_id = p_conv
        and created_at > now() - interval '15 minutes'
      order by created_at desc limit 1;
    if found then
      if n.read_at is null then
        update public.notifications set count = count + 1, body = p_body where id = n.id;
      end if;
      return;
    end if;
  end if;
  insert into public.notifications (user_id, type, title, body, url, conversation_id, enquiry_id)
  values (p_user, p_type, p_title, p_body, p_url, p_conv, p_enq);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Audit log: before/after/reason, append-only for everyone
-- ---------------------------------------------------------------------------
alter table public.audit_log add column before jsonb, add column after jsonb, add column reason text;
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_type, target_id);
create index audit_log_action_idx on public.audit_log (action);

create or replace function private.audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- The single permitted change: anonymising the actor when an account is removed (POPIA).
  if tg_op = 'UPDATE' and old.actor_id is not null and new.actor_id is null
     and (new.id, new.action, new.target_type, new.target_id, new.detail, new.before, new.after, new.reason, new.created_at)
         is not distinct from
         (old.id, old.action, old.target_type, old.target_id, old.detail, old.before, old.after, old.reason, old.created_at) then
    return new;
  end if;
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_no_update_delete before update or delete on public.audit_log
  for each row execute function private.audit_append_only();
create trigger audit_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_append_only();
revoke update, delete, truncate on public.audit_log from anon, authenticated;
revoke all on public.audit_log from anon;
create policy audit_insert on public.audit_log for insert to authenticated
  with check ((select private.is_admin()) and actor_id = (select auth.uid()));

-- Every admin change to configuration tables is logged automatically with before/after.
create or replace function private.audit_config() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
        a jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
        r jsonb := coalesce(a, b);
begin
  if auth.uid() is null or not private.is_admin() then return null; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'key', r ->> 'domain', r ->> 'email', r ->> 'tier'), b, a);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['categories','campuses','pickup_points','feature_flags','allowed_email_domains','allowed_emails',
                           'trust_tiers','featured_slots','site_settings'] loop
    execute format('create trigger audit_config after insert or update or delete on public.%I
                    for each row execute function private.audit_config()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Reports
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_reporter_id_target_type_target_id_key;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id) on delete set null;
alter table public.reports
  add column target_owner_id uuid references public.profiles(id) on delete set null,
  add column conversation_id uuid references public.conversations(id) on delete set null,
  add column resolution text check (resolution in ('dismissed','content_hidden','warned','suspended','banned')),
  add column resolution_note text check (char_length(resolution_note) <= 500),
  add column resolved_by uuid references public.profiles(id) on delete set null,
  add column resolved_at timestamptz;
create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'pending';
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id) where status = 'pending';
create index reports_owner_idx on public.reports (target_owner_id);
create index reports_conversation_idx on public.reports (conversation_id);
create index reports_resolved_by_idx on public.reports (resolved_by);
create index reports_reporter_day_idx on public.reports (reporter_id, created_at);

create table public.report_context (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports(id) on delete cascade,
  message_id uuid,
  position int not null,
  is_reported boolean not null default false,
  sender_role text not null,
  sender_is_reported boolean not null default false,
  body text not null,
  kind text not null,
  has_image boolean not null default false,
  swap_title text,
  created_at timestamptz not null
);
create index report_context_report_idx on public.report_context (report_id, position);
alter table public.report_context enable row level security;
create policy rctx_admin on public.report_context for select to authenticated using ((select private.is_admin()));
revoke all on public.report_context from anon;
revoke insert, update, delete, truncate on public.report_context from authenticated;

create table public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  message text not null check (char_length(message) between 3 and 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_warnings_user_idx on public.user_warnings (user_id);
create index user_warnings_report_idx on public.user_warnings (report_id);
create index user_warnings_created_by_idx on public.user_warnings (created_by);
alter table public.user_warnings enable row level security;
create policy warnings_read on public.user_warnings for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy warnings_admin_insert on public.user_warnings for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));
revoke all on public.user_warnings from anon;
revoke update, delete, truncate on public.user_warnings from authenticated;

create or replace function private.report_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid; m record;
begin
  if auth.uid() is not null and (select count(*) from public.reports
       where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limit_reports';
  end if;
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  case new.target_type
    when 'listing' then
      select s.user_id into owner from public.listings l join public.seller_profiles s on s.id = l.seller_id where l.id = new.target_id;
    when 'seller' then
      select user_id into owner from public.seller_profiles where id = new.target_id;
    when 'user' then
      select id into owner from public.profiles where id = new.target_id;
    when 'request' then
      select buyer_id into owner from public.requests where id = new.target_id;
    when 'message' then
      select id, sender_id, conversation_id into m from public.messages where id = new.target_id;
      if not found then raise exception 'report_target_missing'; end if;
      if auth.uid() is not null and not private.in_conversation(m.conversation_id) then raise exception 'report_target_missing'; end if;
      owner := m.sender_id;
      new.conversation_id := m.conversation_id;
  end case;
  if not found then raise exception 'report_target_missing'; end if;
  if owner is not distinct from new.reporter_id then raise exception 'report_own_content'; end if;
  new.target_owner_id := owner;
  return new;
end $$;
create trigger report_before_insert before insert on public.reports
  for each row execute function private.report_before_insert();

create or replace function private.report_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rm record; n_reporters int; threshold int; l record;
begin
  if new.target_type = 'message' then
    select id, created_at into rm from public.messages where id = new.target_id;
    insert into public.report_context (report_id, message_id, position, is_reported, sender_role, sender_is_reported, body, kind, has_image, swap_title, created_at)
    select new.id, x.id, row_number() over (order by x.created_at, x.id), x.id = new.target_id,
           case when x.sender_id = c.buyer_id then 'buyer' else 'seller' end,
           x.sender_id is not distinct from new.target_owner_id, x.body, x.kind, x.image_path is not null, x.swap_listing_title, x.created_at
    from (
      (select * from public.messages where conversation_id = new.conversation_id and (created_at, id) < (rm.created_at, rm.id)
        order by created_at desc, id desc limit 3)
      union all (select * from public.messages where id = new.target_id)
      union all (select * from public.messages where conversation_id = new.conversation_id and (created_at, id) > (rm.created_at, rm.id)
        order by created_at, id limit 2)
    ) x join public.conversations c on c.id = new.conversation_id;
  elsif new.target_type = 'listing' then
    select coalesce((value ->> 'n')::int, 3) into threshold from public.site_settings where key = 'auto_hide_threshold';
    select count(distinct reporter_id) into n_reporters from public.reports
      where target_type = 'listing' and target_id = new.target_id and status = 'pending' and reporter_id is not null;
    select id, hidden_by_moderation into l from public.listings where id = new.target_id;
    if found and not l.hidden_by_moderation and n_reporters >= coalesce(threshold, 3) then
      update public.listings set hidden_by_moderation = true, moderation_hidden_reason = 'auto' where id = new.target_id;
      insert into public.audit_log (actor_id, action, target_type, target_id, detail)
      values (null, 'listing.auto_hide', 'listing', new.target_id::text, jsonb_build_object('unique_reporters', n_reporters, 'threshold', coalesce(threshold, 3)));
    end if;
  end if;
  return null;
end $$;
create trigger report_after_insert after insert on public.reports
  for each row execute function private.report_after_insert();

-- Reporter gets a status update when the report is resolved (never any detail about the other party).
create or replace function private.report_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    perform private.notify(new.reporter_id, 'report_update', 'Update on your report',
      case when new.status = 'dismissed'
        then 'We reviewed your report and did not find a breach of our rules. Thank you for flagging it.'
        else 'We reviewed your report and took action. Thank you for helping keep Vossie safe.' end,
      '/settings/privacy', null, null);
  end if;
  return null;
end $$;
create trigger report_after_update after update on public.reports
  for each row execute function private.report_after_update();

-- Seller is told a listing is under review (never who reported it) and when it is live again.
create or replace function private.listing_moderation_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if new.hidden_by_moderation is distinct from old.hidden_by_moderation then
    select user_id into owner from public.seller_profiles where id = new.seller_id;
    if new.hidden_by_moderation then
      perform private.notify(owner, 'moderation', 'Your listing is under review',
        '"' || new.title || '" is hidden while the Incubation Hub team reviews it. You can keep editing it.', '/sell/listings', null, null);
    else
      perform private.notify(owner, 'moderation', 'Your listing is live again', '"' || new.title || '" passed review and is visible.', '/sell/listings', null, null);
    end if;
  end if;
  return null;
end $$;
create trigger listing_moderation_notify after update of hidden_by_moderation on public.listings
  for each row execute function private.listing_moderation_notify();

create or replace function private.warning_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.user_id, 'warning', 'A message from the Vossie team', new.message, '/account', null, null);
  return null;
end $$;
create trigger warning_after_insert after insert on public.user_warnings
  for each row execute function private.warning_after_insert();

create or replace function private.profile_moderation_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.banned_at is not null and old.banned_at is null then
    perform private.notify(new.id, 'moderation', 'Your account has been banned', coalesce(new.ban_reason, 'You broke the Vossie community rules.'), '/account', null, null);
  elsif new.suspended_until is not null and new.suspended_until > now() and new.suspended_until is distinct from old.suspended_until then
    perform private.notify(new.id, 'moderation', 'Your account is suspended',
      'You can browse, but you cannot list or message until ' || to_char(new.suspended_until at time zone 'Africa/Johannesburg', 'DD Mon YYYY HH24:MI') || '. ' || coalesce('Reason: ' || new.suspension_reason, ''), '/account', null, null);
  elsif (old.banned_at is not null and new.banned_at is null) or (old.suspended_until is not null and new.suspended_until is null) then
    perform private.notify(new.id, 'moderation', 'Your account has been restored', 'You can list and message again.', '/account', null, null);
  end if;
  return null;
end $$;
create trigger profile_moderation_notify after update of suspended_until, banned_at on public.profiles
  for each row execute function private.profile_moderation_notify();

create or replace function private.seller_review_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' and new.reviewed_at is not null then
    perform private.notify(new.user_id, 'seller_review',
      case new.status when 'approved' then 'You''re approved! Welcome to Vossie' when 'rejected' then 'Your seller application was not approved' else 'Changes needed on your seller profile' end,
      case new.status when 'approved' then 'Your profile and available listings are now visible to buyers.' else coalesce(new.review_reason, '') end,
      '/sell', null, null);
  end if;
  if new.verified is distinct from old.verified and new.status = 'approved' then
    perform private.notify(new.user_id, 'seller_review',
      case when new.verified then 'You''re now a Verified Incubation Hub member' else 'Your Verified badge was removed' end,
      case when new.verified then 'Your verified badge now shows on your profile and listings.' else coalesce(new.review_reason, 'Contact the Incubation Hub team if you have questions.') end,
      '/sell', null, null);
  end if;
  return null;
end $$;
create trigger seller_review_notify after update on public.seller_profiles
  for each row execute function private.seller_review_notify();

-- ---------------------------------------------------------------------------
-- 6. Admin actions: SECURITY INVOKER (RLS still applies), atomic with their audit row.
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_seller(p_seller uuid, p_decision text, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare s public.seller_profiles; v_status public.seller_status; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.seller_profiles where id = p_seller;
  if not found then raise exception 'Seller not found'; end if;
  if s.status <> 'pending' then raise exception 'This profile is not waiting for review'; end if;
  v_status := case p_decision when 'approve' then 'approved'::public.seller_status when 'reject' then 'rejected'::public.seller_status
                              when 'request_changes' then 'draft'::public.seller_status end;
  if v_status is null then raise exception 'Unknown decision'; end if;
  if p_decision <> 'approve' and (v_reason is null or char_length(v_reason) < 3) then raise exception 'A reason is required'; end if;
  update public.seller_profiles set status = v_status, review_reason = case when p_decision = 'approve' then null else v_reason end,
         reviewed_by = auth.uid(), reviewed_at = now() where id = p_seller;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'seller.' || p_decision, 'seller_profile', p_seller::text, jsonb_build_object('status', s.status),
          jsonb_build_object('status', v_status), v_reason);
end $$;

create or replace function public.admin_set_verified(p_seller uuid, p_verified boolean, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare s public.seller_profiles; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.seller_profiles where id = p_seller;
  if not found then raise exception 'Seller not found'; end if;
  update public.seller_profiles set verified = p_verified, review_reason = case when p_verified then null else v_reason end where id = p_seller;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), case when p_verified then 'seller.verify' else 'seller.unverify' end, 'seller_profile', p_seller::text,
          jsonb_build_object('verified', s.verified), jsonb_build_object('verified', p_verified), v_reason);
end $$;

create or replace function public.admin_moderate_listing(p_listing uuid, p_action text, p_category uuid default null, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare l public.listings; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into l from public.listings where id = p_listing;
  if not found then raise exception 'Listing not found'; end if;
  if p_action = 'hide' then
    update public.listings set hidden_by_moderation = true, moderation_hidden_reason = 'admin' where id = p_listing;
  elsif p_action = 'restore' then
    update public.listings set hidden_by_moderation = false where id = p_listing;
  elsif p_action = 'category' then
    if not exists (select 1 from public.categories where id = p_category) then raise exception 'Category not found'; end if;
    update public.listings set category_id = p_category where id = p_listing;
  else
    raise exception 'Unknown action';
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'listing.' || p_action, 'listing', p_listing::text,
          jsonb_build_object('hidden', l.hidden_by_moderation, 'category_id', l.category_id),
          jsonb_build_object('hidden', case p_action when 'hide' then true when 'restore' then false else l.hidden_by_moderation end,
                             'category_id', case when p_action = 'category' then p_category else l.category_id end), v_reason);
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_days int default null, p_note text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare r public.reports; v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_res text; v_status public.report_status;
        v_before jsonb; owner_role public.user_role; hidden_auto boolean;
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into r from public.reports where id = p_report;
  if not found then raise exception 'Report not found'; end if;
  if r.status <> 'pending' then raise exception 'This report is already resolved'; end if;
  v_before := jsonb_build_object('status', r.status);

  if p_action = 'dismiss' then
    v_res := 'dismissed'; v_status := 'dismissed';
    if r.target_type = 'listing' then
      select (hidden_by_moderation and moderation_hidden_reason = 'auto') into hidden_auto from public.listings where id = r.target_id;
      if coalesce(hidden_auto, false) then update public.listings set hidden_by_moderation = false where id = r.target_id; end if;
    end if;
  elsif p_action = 'hide' then
    if r.target_type <> 'listing' then raise exception 'Only listings can be hidden. Choose warn, suspend or ban.'; end if;
    update public.listings set hidden_by_moderation = true, moderation_hidden_reason = 'admin' where id = r.target_id;
    v_res := 'content_hidden'; v_status := 'actioned';
  else
    if r.target_owner_id is null then raise exception 'There is no user to act on'; end if;
    select role into owner_role from public.profiles where id = r.target_owner_id;
    if owner_role = 'admin' then raise exception 'Demote this admin before taking action against them'; end if;
    if p_action = 'warn' then
      if v_note is null or char_length(v_note) < 3 then raise exception 'Write the warning message'; end if;
      insert into public.user_warnings (user_id, report_id, message, created_by) values (r.target_owner_id, r.id, v_note, auth.uid());
      v_res := 'warned';
    elsif p_action = 'suspend' then
      if p_days is null or p_days < 1 or p_days > 365 then raise exception 'Choose a suspension of 1 to 365 days'; end if;
      update public.profiles set suspended_until = now() + make_interval(days => p_days), suspension_reason = v_note where id = r.target_owner_id;
      v_res := 'suspended';
    elsif p_action = 'ban' then
      update public.profiles set banned_at = now(), ban_reason = v_note where id = r.target_owner_id;
      v_res := 'banned';
    else
      raise exception 'Unknown action';
    end if;
    v_status := 'actioned';
  end if;

  update public.reports set status = v_status, resolution = v_res, resolution_note = v_note, resolved_by = auth.uid(), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'pending';
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason, detail)
  values (auth.uid(), 'report.' || p_action, 'report', p_report::text, v_before,
          jsonb_build_object('status', v_status, 'resolution', v_res, 'days', p_days),
          v_note, jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id, 'target_owner_id', r.target_owner_id));
end $$;

create or replace function public.admin_unsuspend(p_user uuid, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare p public.profiles; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then raise exception 'User not found'; end if;
  update public.profiles set suspended_until = null, suspension_reason = null, banned_at = null, ban_reason = null where id = p_user;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'user.restore', 'user', p_user::text,
          jsonb_build_object('suspended_until', p.suspended_until, 'banned_at', p.banned_at), jsonb_build_object('suspended_until', null, 'banned_at', null), v_reason);
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare p public.profiles; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then raise exception 'User not found'; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'user.set_role', 'user', p_user::text, jsonb_build_object('role', p.role), jsonb_build_object('role', p_role), v_reason);
end $$;

create or replace function public.admin_assign_mentor(p_seller uuid, p_mentor uuid, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare s public.seller_profiles; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into s from public.seller_profiles where id = p_seller;
  if not found then raise exception 'Seller not found'; end if;
  if p_mentor is not null and not exists (select 1 from public.profiles where id = p_mentor and role = 'mentor') then
    raise exception 'That user is not a mentor';
  end if;
  update public.seller_profiles set mentor_id = p_mentor where id = p_seller;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'seller.assign_mentor', 'seller_profile', p_seller::text, jsonb_build_object('mentor_id', s.mentor_id), jsonb_build_object('mentor_id', p_mentor), v_reason);
end $$;

do $$ declare f text; begin
  foreach f in array array['admin_review_seller(uuid,text,text)','admin_set_verified(uuid,boolean,text)','admin_moderate_listing(uuid,text,uuid,text)',
    'admin_resolve_report(uuid,text,int,text)','admin_unsuspend(uuid,text)','admin_set_role(uuid,public.user_role,text)','admin_assign_mentor(uuid,uuid,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Trigger/job functions must not be callable through the API.
revoke execute on function
  private.audit_append_only(), private.audit_config(), private.guard_last_admin(), private.guard_not_blocked(),
  private.listing_moderation_stamp(), private.report_before_insert(), private.report_after_insert(), private.report_after_update(),
  private.listing_moderation_notify(), private.warning_after_insert(), private.profile_moderation_notify(), private.seller_review_notify()
  from public, anon, authenticated;
