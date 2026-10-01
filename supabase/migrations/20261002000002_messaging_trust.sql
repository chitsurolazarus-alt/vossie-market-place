-- Phase 4 (2/2): conversations, messages, enquiry management, notifications, reply-time and trust score.
-- Design rules (same as Phases 1-3): RLS on every table, helpers/triggers in the un-exposed `private`
-- schema, column-level rules in guard triggers. Triggers detect "system" changes (cron, service role,
-- or a change made by another trigger) with `auth.uid() is null or pg_trigger_depth() > 1`.

-- ---------------------------------------------------------------------------
-- 1. Conversations: one per (buyer, seller, listing); a seller-level chat (no listing) is unique per pair.
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column origin text not null default 'in_app' check (origin in ('in_app','whatsapp')),
  add column buyer_name text,
  add column seller_name text,
  add column listing_title text,
  add column listing_cover text,
  add column last_message_at timestamptz,
  add column last_message_preview text,
  add column last_sender_id uuid references public.profiles(id) on delete set null;

alter table public.conversations drop constraint if exists conversations_listing_id_buyer_id_key;
create unique index conversations_listing_uniq on public.conversations (buyer_id, seller_id, listing_id) where listing_id is not null;
create unique index conversations_general_uniq on public.conversations (buyer_id, seller_id) where listing_id is null;
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_listing_idx on public.conversations (listing_id);
create index conversations_last_sender_idx on public.conversations (last_sender_id);

-- ---------------------------------------------------------------------------
-- 2. Messages: text, optional single private image, swap-offer cards, scam-pattern flag.
-- ---------------------------------------------------------------------------
alter table public.messages
  add column kind text not null default 'text' check (kind in ('text','swap_offer')),
  add column image_path text,
  add column swap_listing_id uuid references public.listings(id) on delete set null,
  add column swap_listing_title text,
  add column risk_flag text check (risk_flag in ('payment','bank'));
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_len check (char_length(body) <= 1000);
alter table public.messages add constraint messages_content_chk
  check (char_length(btrim(body)) > 0 or image_path is not null or swap_listing_id is not null);
create index messages_sender_time_idx on public.messages (sender_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;
create index messages_swap_listing_idx on public.messages (swap_listing_id);

-- ---------------------------------------------------------------------------
-- 3. Enquiries: denormalised ids, source, response + completion fields, events.
-- ---------------------------------------------------------------------------
alter table public.enquiries
  add column seller_id uuid references public.seller_profiles(id) on delete cascade,
  add column buyer_id uuid references public.profiles(id) on delete cascade,
  add column listing_id uuid references public.listings(id) on delete set null,
  add column source text not null default 'in_app' check (source in ('in_app','whatsapp')),
  add column first_response_at timestamptz,
  add column sale_happened boolean,
  add column completed_at timestamptz,
  add column completion_requested_at timestamptz,
  add column buyer_confirmed_at timestamptz,
  add column buyer_disputed_at timestamptz,
  add column auto_confirmed boolean not null default false;
update public.enquiries e set seller_id = c.seller_id, buyer_id = c.buyer_id, listing_id = c.listing_id
  from public.conversations c where c.id = e.conversation_id;
alter table public.enquiries alter column seller_id set not null, alter column buyer_id set not null;
create index enquiries_seller_status_idx on public.enquiries (seller_id, status, created_at desc);
create index enquiries_buyer_idx on public.enquiries (buyer_id, created_at desc);
create index enquiries_listing_idx on public.enquiries (listing_id);
create index enquiries_trust_idx on public.enquiries (seller_id, created_at) where source = 'in_app';
create index enquiries_confirm_idx on public.enquiries (completion_requested_at)
  where sale_happened and buyer_confirmed_at is null and buyer_disputed_at is null;

create table public.enquiry_events (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  type text not null check (type in ('status_changed','whatsapp_handoff','completion_requested','buyer_confirmed','buyer_disputed','auto_confirmed')),
  actor_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index enquiry_events_enquiry_idx on public.enquiry_events (enquiry_id, created_at);
create index enquiry_events_type_idx on public.enquiry_events (type, created_at);
create index enquiry_events_actor_idx on public.enquiry_events (actor_id);

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index quick_replies_seller_idx on public.quick_replies (seller_id, position);

-- ---------------------------------------------------------------------------
-- 4. Notifications, preferences, email queue (no sender wired yet), web-push subscriptions (flagged).
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_enquiry','new_message','status_change','completion_request','completion_confirmed')),
  title text not null,
  body text,
  url text,
  conversation_id uuid references public.conversations(id) on delete cascade,
  enquiry_id uuid references public.enquiries(id) on delete cascade,
  count int not null default 1,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_batch_idx on public.notifications (user_id, conversation_id, created_at desc) where type = 'new_message';
create index notifications_conversation_idx on public.notifications (conversation_id);
create index notifications_enquiry_idx on public.notifications (enquiry_id);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_new_enquiry boolean not null default true,
  email_daily_digest boolean not null default false,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('new_enquiry','daily_digest')),
  subject text not null,
  body text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_queue_pending_idx on public.email_queue (created_at) where sent_at is null;
create index email_queue_user_idx on public.email_queue (user_id);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

insert into public.feature_flags (key, enabled, description) values
  ('in_app_messaging', true, 'Buyer-seller messaging and enquiries'),
  ('email_notifications', false, 'Email for new enquiries and daily digest (no provider connected yet)'),
  ('web_push', false, 'Web push notifications (PWA)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Trust: admin-editable tier rules + a server-computed score table nobody can write to via the API.
-- ---------------------------------------------------------------------------
create table public.trust_tiers (
  tier text primary key check (tier ~ '^[a-z_]+$'),
  rank int not null unique,
  label text not null,
  summary text not null,
  min_enquiries int not null default 0 check (min_enquiries >= 0),
  min_response_rate numeric(4,3) not null default 0 check (min_response_rate between 0 and 1),
  min_confirmed int not null default 0 check (min_confirmed >= 0),
  min_account_days int not null default 0 check (min_account_days >= 0),
  requires_verified boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.trust_tiers (tier, rank, label, summary, min_enquiries, min_response_rate, min_confirmed, min_account_days, requires_verified) values
  ('new',         0, 'New seller',  'Just getting started. Say hi and see how they reply.', 0, 0,     0,  0,  false),
  ('responsive',  1, 'Responsive',  'Replies to enquiries quickly and reliably.',            3, 0.800, 0,  0,  false),
  ('trusted',     2, 'Trusted',     'Replies reliably and has confirmed sales with buyers.', 3, 0.850, 5,  30, false),
  ('top_hustler', 3, 'Top Hustler', 'A proven campus favourite: fast, reliable and verified.', 3, 0.900, 15, 90, true);

create table public.seller_trust (
  seller_id uuid primary key references public.seller_profiles(id) on delete cascade,
  tier text not null default 'new' references public.trust_tiers(tier) on update cascade,
  enquiries_90d int not null default 0,
  replied_90d int not null default 0,
  response_rate numeric(5,4),
  confirmed_sales int not null default 0,
  account_days int not null default 0,
  verified boolean not null default false,
  reply_enquiries_30d int not null default 0,
  median_reply_seconds int,
  reply_band text check (reply_band in ('hour','hours','day','slow')),
  whatsapp_leads_90d int not null default 0,
  updated_at timestamptz not null default now()
);
create index seller_trust_tier_idx on public.seller_trust (tier);

-- ---------------------------------------------------------------------------
-- 6. Helpers
-- ---------------------------------------------------------------------------
create or replace function private.in_conversation_path(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when split_part(p, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then private.in_conversation(split_part(p, '/', 1)::uuid) else false end
$$;
grant execute on function private.in_conversation_path(text) to authenticated;

-- Scam-pattern detector (mirrored in src/lib/messages.ts). Warn only; messages are never blocked.
create or replace function private.message_risk(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p ~* '(deposit\s*(first|upfront|before|required|needed)|(pay|send|transfer|eft|put)\s+(me\s+)?(a\s+|the\s+|your\s+)?(deposit|booking fee|upfront|in advance|first)|pay\s+before|money\s+first|upfront\s+payment)' then 'payment'
    when p ~* '(account\s*(no|nr|number|#)|\macc\s*(no|nr|number)|\miban\M|\mswift\M|branch\s*code|\mcvv\M|\motp\M|card\s*number|\m(fnb|absa|nedbank|capitec|tymebank|standard bank|african bank|discovery bank)\M[^\n]{0,40}\d{6,})' then 'bank'
    else null end
$$;

create or replace function private.display_first_name(p text) returns text
language sql immutable set search_path = '' as $$
  with n as (select btrim(regexp_replace(coalesce(p, ''), '\s*\([^)]*\)\s*$', '')) as v)
  select case when v = '' then 'Student'
              when position(' ' in v) > 0 then split_part(v, ' ', 1) || ' ' || upper(left(regexp_replace(v, '^.*\s', ''), 1)) || '.'
              else v end from n
$$;

-- notify(): inserts a notification; new_message ones are batched (max 1 per conversation per 15 minutes).
create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_url text,
                                          p_conv uuid, p_enq uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n record;
begin
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
-- 7. Trust computation (server-side only)
-- ---------------------------------------------------------------------------
create view private.seller_reply_stats as
select e.seller_id,
       count(*)::int as n,
       percentile_cont(0.5) within group (order by extract(epoch from
         (coalesce(e.first_response_at, e.created_at + interval '48 hours') - e.created_at)))::int as median_s
from public.enquiries e
where e.source = 'in_app'
  and e.created_at > now() - interval '30 days'
  and (e.first_response_at is not null or e.created_at < now() - interval '48 hours')
group by e.seller_id;

create or replace function private.refresh_seller_trust(sid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s record; r record; rs record; rate numeric; days int; v_tier text; band text;
begin
  select id, verified, created_at, status into s from public.seller_profiles where id = sid;
  if not found then return; end if;
  select
    count(*) filter (where source = 'in_app' and created_at > now() - interval '90 days'
                       and (first_response_at is not null or created_at < now() - interval '48 hours')) as enq,
    count(*) filter (where source = 'in_app' and created_at > now() - interval '90 days'
                       and first_response_at is not null and first_response_at <= created_at + interval '48 hours') as replied,
    count(*) filter (where sale_happened and buyer_confirmed_at is not null) as confirmed,
    count(*) filter (where source = 'whatsapp' and created_at > now() - interval '90 days') as wa
  into r from public.enquiries where seller_id = sid;
  select n, median_s into rs from private.seller_reply_stats where seller_id = sid;

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
      account_days, verified, reply_enquiries_30d, median_reply_seconds, reply_band, whatsapp_leads_90d, updated_at)
  values (sid, coalesce(v_tier, 'new'), r.enq, r.replied, rate, r.confirmed, days, s.verified,
      coalesce(rs.n, 0), rs.median_s, band, r.wa, now())
  on conflict (seller_id) do update set tier = excluded.tier, enquiries_90d = excluded.enquiries_90d,
      replied_90d = excluded.replied_90d, response_rate = excluded.response_rate,
      confirmed_sales = excluded.confirmed_sales, account_days = excluded.account_days,
      verified = excluded.verified, reply_enquiries_30d = excluded.reply_enquiries_30d,
      median_reply_seconds = excluded.median_reply_seconds, reply_band = excluded.reply_band,
      whatsapp_leads_90d = excluded.whatsapp_leads_90d, updated_at = excluded.updated_at;
end $$;

create or replace function private.refresh_all_trust() returns int
language plpgsql security definer set search_path = '' as $$
declare s record; n int := 0;
begin
  for s in select id from public.seller_profiles where status = 'approved' loop
    perform private.refresh_seller_trust(s.id); n := n + 1;
  end loop;
  return n;
end $$;

create or replace function private.auto_confirm_completions() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.enquiries set buyer_confirmed_at = now(), auto_confirmed = true
   where sale_happened and buyer_confirmed_at is null and buyer_disputed_at is null
     and completion_requested_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Triggers: conversations
-- ---------------------------------------------------------------------------
create or replace function private.conversation_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record; l record;
begin
  select user_id, business_name into s from public.seller_profiles where id = new.seller_id;
  if not found then raise exception 'Seller not found'; end if;
  if s.user_id = new.buyer_id then raise exception 'own_listing'; end if;
  if auth.uid() is not null and (
       select count(*) from public.conversations where buyer_id = new.buyer_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit_conversations';
  end if;
  if new.listing_id is not null then
    select title, seller_id into l from public.listings where id = new.listing_id;
    if l.seller_id is distinct from new.seller_id then raise exception 'Listing does not belong to this seller'; end if;
    new.listing_title := l.title;
    new.listing_cover := (select i.path from public.listing_images i where i.listing_id = new.listing_id order by i.position limit 1);
  end if;
  new.seller_name := s.business_name;
  new.buyer_name := private.display_first_name((select display_name from public.profiles where id = new.buyer_id));
  return new;
end $$;
create trigger conversation_before_insert before insert on public.conversations
  for each row execute function private.conversation_before_insert();

create or replace function private.conversation_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.enquiries (conversation_id, seller_id, buyer_id, listing_id, source, created_at)
  values (new.id, new.seller_id, new.buyer_id, new.listing_id, new.origin, new.created_at);
  return null;
end $$;
create trigger conversation_after_insert after insert on public.conversations
  for each row execute function private.conversation_after_insert();

-- ---------------------------------------------------------------------------
-- 9. Triggers: enquiries (guard, events, notifications, trust refresh)
-- ---------------------------------------------------------------------------
create or replace function private.guard_enquiry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_seller boolean; v_buyer boolean;
begin
  new.updated_at := now();
  if uid is null or pg_trigger_depth() > 1 or private.is_admin() then return new; end if;

  if new.conversation_id is distinct from old.conversation_id or new.seller_id is distinct from old.seller_id
     or new.buyer_id is distinct from old.buyer_id or new.listing_id is distinct from old.listing_id
     or new.source is distinct from old.source or new.first_response_at is distinct from old.first_response_at
     or new.completed_at is distinct from old.completed_at
     or new.completion_requested_at is distinct from old.completion_requested_at
     or new.auto_confirmed is distinct from old.auto_confirmed or new.created_at is distinct from old.created_at then
    raise exception 'Not allowed';
  end if;

  v_seller := private.owns_seller(old.seller_id);
  v_buyer := old.buyer_id = uid;

  if v_seller then
    if new.buyer_confirmed_at is distinct from old.buyer_confirmed_at
       or new.buyer_disputed_at is distinct from old.buyer_disputed_at then
      raise exception 'Only the buyer can confirm a sale';
    end if;
    if new.status is distinct from old.status then
      if not ((old.status = 'new' and new.status in ('in_progress','declined'))
           or (old.status = 'in_progress' and new.status in ('completed','declined'))) then
        raise exception 'That status change is not allowed';
      end if;
      if new.status = 'completed' then
        if new.sale_happened is null then raise exception 'Say whether the sale or swap happened'; end if;
        new.completed_at := now();
        if new.sale_happened then new.completion_requested_at := now(); end if;
      elsif new.sale_happened is distinct from old.sale_happened then
        raise exception 'Not allowed';
      end if;
    elsif new.sale_happened is distinct from old.sale_happened then
      raise exception 'Not allowed';
    end if;
  elsif v_buyer then
    if new.status is distinct from old.status or new.sale_happened is distinct from old.sale_happened then
      raise exception 'Only the seller can change the status';
    end if;
    if new.buyer_confirmed_at is not distinct from old.buyer_confirmed_at
       and new.buyer_disputed_at is not distinct from old.buyer_disputed_at then
      return new;
    end if;
    if not (old.sale_happened is true and old.status = 'completed'
            and old.buyer_confirmed_at is null and old.buyer_disputed_at is null) then
      raise exception 'There is nothing to confirm';
    end if;
    if (new.buyer_confirmed_at is not null) = (new.buyer_disputed_at is not null) then
      raise exception 'Confirm or dispute, not both';
    end if;
    if new.buyer_confirmed_at is not null then new.buyer_confirmed_at := now(); end if;
    if new.buyer_disputed_at is not null then new.buyer_disputed_at := now(); end if;
  else
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
create trigger guard_enquiry before update on public.enquiries
  for each row execute function private.guard_enquiry();

create or replace function private.enquiry_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; pref record;
begin
  select cv.buyer_name, cv.listing_title, s.user_id as seller_user into c
    from public.conversations cv join public.seller_profiles s on s.id = cv.seller_id where cv.id = new.conversation_id;
  perform private.notify(c.seller_user, 'new_enquiry',
    case when new.source = 'whatsapp' then 'New WhatsApp lead from ' || c.buyer_name else 'New enquiry from ' || c.buyer_name end,
    coalesce(c.listing_title, 'About your hustle'),
    case when new.source = 'whatsapp' then '/sell/enquiries' else '/messages/' || new.conversation_id end,
    new.conversation_id, new.id);
  if new.source = 'in_app' then
    select email_new_enquiry, email_daily_digest into pref from public.notification_prefs where user_id = c.seller_user;
    if coalesce(pref.email_new_enquiry, true) then
      insert into public.email_queue (user_id, kind, subject, body)
      values (c.seller_user, case when coalesce(pref.email_daily_digest, false) then 'daily_digest' else 'new_enquiry' end,
              'New enquiry from ' || c.buyer_name, coalesce(c.listing_title, 'About your hustle'));
    end if;
  end if;
  return null;
end $$;
create trigger enquiry_after_insert after insert on public.enquiries
  for each row execute function private.enquiry_after_insert();

create or replace function private.enquiry_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; label text;
begin
  select cv.buyer_name, cv.seller_name, cv.listing_title, s.user_id as seller_user into c
    from public.conversations cv join public.seller_profiles s on s.id = cv.seller_id where cv.id = new.conversation_id;
  if new.status is distinct from old.status then
    insert into public.enquiry_events (enquiry_id, type, actor_id, data)
      values (new.id, 'status_changed', auth.uid(), jsonb_build_object('from', old.status, 'to', new.status, 'sale_happened', new.sale_happened));
    if new.status in ('in_progress','declined','completed') then
      label := case new.status when 'in_progress' then 'In progress' when 'declined' then 'Declined' else 'Completed' end;
      perform private.notify(new.buyer_id, 'status_change', c.seller_name || ' updated your enquiry',
        label || ' · ' || coalesce(c.listing_title, 'your enquiry'), '/messages/' || new.conversation_id, new.conversation_id, new.id);
    end if;
  end if;
  if new.completion_requested_at is not null and old.completion_requested_at is null then
    insert into public.enquiry_events (enquiry_id, type, actor_id) values (new.id, 'completion_requested', auth.uid());
    perform private.notify(new.buyer_id, 'completion_request', 'Did this go ahead?',
      c.seller_name || ' marked ' || coalesce(c.listing_title, 'your enquiry') || ' as done. Tap to confirm.',
      '/messages/' || new.conversation_id, new.conversation_id, new.id);
  end if;
  if new.buyer_confirmed_at is not null and old.buyer_confirmed_at is null then
    insert into public.enquiry_events (enquiry_id, type, actor_id)
      values (new.id, case when new.auto_confirmed then 'auto_confirmed' else 'buyer_confirmed' end,
              case when new.auto_confirmed then null else auth.uid() end);
    perform private.notify(c.seller_user, 'completion_confirmed',
      case when new.auto_confirmed then 'Sale auto-confirmed' else c.buyer_name || ' confirmed the sale' end,
      coalesce(c.listing_title, 'Your enquiry') || ' now counts toward your trust badge.',
      '/sell/enquiries?tab=completed', new.conversation_id, new.id);
  end if;
  if new.buyer_disputed_at is not null and old.buyer_disputed_at is null then
    insert into public.enquiry_events (enquiry_id, type, actor_id) values (new.id, 'buyer_disputed', auth.uid());
    perform private.notify(c.seller_user, 'completion_confirmed', c.buyer_name || ' says this did not go ahead',
      coalesce(c.listing_title, 'Your enquiry') || ' will not count toward your trust badge.',
      '/messages/' || new.conversation_id, new.conversation_id, new.id);
  end if;
  return null;
end $$;
create trigger enquiry_after_update after update on public.enquiries
  for each row execute function private.enquiry_after_update();

create or replace function private.enquiry_trust_refresh() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_seller_trust(new.seller_id);
  return null;
end $$;
create trigger enquiry_trust_refresh after insert or update on public.enquiries
  for each row execute function private.enquiry_trust_refresh();

create or replace function private.seller_trust_refresh() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.verified is distinct from old.verified
     or new.created_at is distinct from old.created_at or new.status is distinct from old.status then
    perform private.refresh_seller_trust(new.id);
  end if;
  return null;
end $$;
create trigger seller_trust_refresh after insert or update on public.seller_profiles
  for each row execute function private.seller_trust_refresh();

-- ---------------------------------------------------------------------------
-- 10. Triggers: messages
-- ---------------------------------------------------------------------------
create or replace function private.message_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  if auth.uid() is not null and (
       select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limit_messages';
  end if;
  if new.image_path is not null and new.image_path not like new.conversation_id::text || '/' || new.sender_id::text || '/%' then
    raise exception 'Invalid image';
  end if;
  if new.swap_listing_id is not null then
    select l2.title into l from public.listings l2
      join public.seller_profiles s on s.id = l2.seller_id
      where l2.id = new.swap_listing_id and s.user_id = new.sender_id and l2.deleted_at is null;
    if not found then raise exception 'You can only offer one of your own listings'; end if;
    new.swap_listing_title := l.title;
  end if;
  if new.kind = 'swap_offer' then
    if exists (select 1 from public.conversations c join public.listings x on x.id = c.listing_id
               where c.id = new.conversation_id and x.pricing_mode = 'cash') then
      raise exception 'This listing is cash only';
    end if;
  end if;
  new.risk_flag := private.message_risk(new.body);
  return new;
end $$;
create trigger message_before_insert before insert on public.messages
  for each row execute function private.message_before_insert();

create or replace function private.guard_message_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if (new.conversation_id, new.sender_id, new.body, new.kind, new.image_path, new.swap_listing_id,
      new.swap_listing_title, new.risk_flag, new.created_at)
     is distinct from
     (old.conversation_id, old.sender_id, old.body, old.kind, old.image_path, old.swap_listing_id,
      old.swap_listing_title, old.risk_flag, old.created_at) then
    raise exception 'Messages cannot be edited';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Messages cannot be edited';
  end if;
  return new;
end $$;
create trigger guard_message_update before update on public.messages
  for each row execute function private.guard_message_update();

create or replace function private.message_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; e record; recipient uuid; from_seller boolean; preview text; n int;
begin
  select cv.buyer_id, cv.seller_id, cv.buyer_name, cv.seller_name, cv.listing_title, s.user_id as seller_user into c
    from public.conversations cv join public.seller_profiles s on s.id = cv.seller_id where cv.id = new.conversation_id;
  from_seller := new.sender_id = c.seller_user;
  preview := case when new.kind = 'swap_offer' then 'Swap offer' || coalesce(': ' || left(coalesce(new.swap_listing_title, nullif(btrim(new.body), '')), 80), '')
                  when btrim(new.body) = '' then 'Photo'
                  else left(regexp_replace(new.body, '\s+', ' ', 'g'), 120) end;
  update public.conversations set last_message_at = new.created_at, last_message_preview = preview, last_sender_id = new.sender_id
   where id = new.conversation_id;

  select id, status, sale_happened, first_response_at into e from public.enquiries where conversation_id = new.conversation_id;
  if from_seller then
    if e.first_response_at is null then
      update public.enquiries set first_response_at = new.created_at where id = e.id;
    end if;
  elsif e.status = 'declined' or (e.status = 'completed' and e.sale_happened is not true) then
    update public.enquiries set status = 'new' where id = e.id;  -- buyer re-enquires: reopen
  end if;

  select count(*) into n from public.messages where conversation_id = new.conversation_id;
  if n > 1 then  -- the very first message is covered by the new-enquiry notification
    recipient := case when from_seller then c.buyer_id else c.seller_user end;
    perform private.notify(recipient, 'new_message',
      'New message from ' || case when from_seller then c.seller_name else c.buyer_name end,
      preview, '/messages/' || new.conversation_id, new.conversation_id, e.id);
  end if;
  return null;
end $$;
create trigger message_after_insert after insert on public.messages
  for each row execute function private.message_after_insert();

-- ---------------------------------------------------------------------------
-- 11. Other guards
-- ---------------------------------------------------------------------------
create or replace function private.guard_quick_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.quick_replies where seller_id = new.seller_id) >= 5 then
    raise exception 'You can save up to 5 quick replies';
  end if;
  return new;
end $$;
create trigger guard_quick_reply before insert on public.quick_replies
  for each row execute function private.guard_quick_reply();

create or replace function private.guard_notification_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  if (new.user_id, new.type, new.title, new.body, new.url, new.conversation_id, new.enquiry_id, new.count, new.created_at)
     is distinct from
     (old.user_id, old.type, old.title, old.body, old.url, old.conversation_id, old.enquiry_id, old.count, old.created_at) then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
create trigger guard_notification_update before update on public.notifications
  for each row execute function private.guard_notification_update();

-- Trigger/job functions must not be callable through the API.
revoke execute on function
  private.notify(uuid, text, text, text, text, uuid, uuid), private.message_risk(text), private.display_first_name(text),
  private.refresh_seller_trust(uuid), private.refresh_all_trust(), private.auto_confirm_completions(),
  private.conversation_before_insert(), private.conversation_after_insert(), private.guard_enquiry(),
  private.enquiry_after_insert(), private.enquiry_after_update(), private.enquiry_trust_refresh(),
  private.seller_trust_refresh(), private.message_before_insert(), private.guard_message_update(),
  private.message_after_insert(), private.guard_quick_reply(), private.guard_notification_update()
  from public, anon, authenticated;
revoke all on private.seller_reply_stats from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.enquiry_events enable row level security;
alter table public.quick_replies enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.email_queue enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.trust_tiers enable row level security;
alter table public.seller_trust enable row level security;

-- Messages: participants and admins (moderation). Mentors get nothing here by design.
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
  using (private.in_conversation(conversation_id) or (select private.is_admin()));

-- Enquiries are created by trigger only; participants may update (guard_enquiry decides which columns).
drop policy if exists enq_insert on public.enquiries;
drop policy if exists enq_update on public.enquiries;
create policy enq_update on public.enquiries for update to authenticated
  using (private.owns_seller(seller_id) or buyer_id = (select auth.uid()))
  with check (private.owns_seller(seller_id) or buyer_id = (select auth.uid()));

create policy enqev_select on public.enquiry_events for select to authenticated
  using (exists (select 1 from public.enquiries e where e.id = enquiry_id
                 and (private.owns_seller(e.seller_id) or e.buyer_id = (select auth.uid()) or (select private.is_admin()))));

create policy qr_owner on public.quick_replies for all to authenticated
  using (private.owns_seller(seller_id)) with check (private.owns_seller(seller_id));

create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy nprefs_owner on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_owner on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- email_queue: no policies = service role only.

create policy tiers_read on public.trust_tiers for select using (true);
create policy tiers_admin on public.trust_tiers for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- seller_trust: readable for approved sellers (public), the owner, the assigned mentor and admins. Never writable via the API.
create policy trust_read on public.seller_trust for select
  using (private.seller_approved(seller_id) or private.owns_seller(seller_id)
         or private.mentors_seller(seller_id) or (select private.is_admin()));

-- Table privileges: defence in depth on top of RLS.
revoke all on public.enquiry_events, public.quick_replies, public.notifications, public.notification_prefs,
  public.email_queue, public.push_subscriptions from anon;
revoke all on public.email_queue from authenticated;
revoke insert, delete, truncate on public.notifications from authenticated;
revoke insert, update, delete, truncate on public.enquiry_events from authenticated;
revoke insert, update, delete, truncate on public.seller_trust, public.trust_tiers from anon;
revoke insert, update, delete, truncate on public.seller_trust from authenticated;
revoke all on public.conversations, public.messages, public.enquiries from anon;

-- ---------------------------------------------------------------------------
-- 13. Private message-images bucket (signed URLs only), scoped by conversation
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-images', 'message-images', false, 512000, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 512000;

create policy msgimg_select on storage.objects for select to authenticated
  using (bucket_id = 'message-images' and private.in_conversation_path(name));
create policy msgimg_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'message-images' and private.in_conversation_path(name)
              and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 14. Browse view: expose tier + reply band for listing cards
-- ---------------------------------------------------------------------------
create or replace view public.browse_listings with (security_invoker = true) as
select
  l.id, l.seller_id, l.campus_id, l.category_id, l.kind, l.title, l.description,
  l.pricing_mode, l.price_zar, l.price_is_from, l.swap_for, l.availability, l.created_at, l.search,
  s.business_name, s.slug as seller_slug, s.verified as seller_verified, s.photo_url as seller_photo,
  c.name as category_name, c.slug as category_slug, ca.name as campus_name,
  img.path as cover_path, img.alt as cover_alt,
  coalesce(tg.tags, '{}'::text[]) as tags,
  st.tier as seller_tier, st.reply_band as seller_reply_band
from public.listings l
join public.seller_profiles s on s.id = l.seller_id and s.status = 'approved'
left join public.categories c on c.id = l.category_id
left join public.campuses ca on ca.id = l.campus_id
left join public.seller_trust st on st.seller_id = l.seller_id
left join lateral (
  select i.path, i.alt from public.listing_images i where i.listing_id = l.id order by i.position limit 1
) img on true
left join lateral (
  select array_agg(t.name order by t.name) as tags
  from public.listing_tags lt join public.tags t on t.id = lt.tag_id where lt.listing_id = l.id
) tg on true
where l.deleted_at is null and not l.hidden_by_moderation and l.availability <> 'paused';
grant select on public.browse_listings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 15. Realtime + scheduled jobs
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['messages','notifications','conversations','enquiries'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select cron.schedule('enquiry-auto-confirm', '15 0 * * *', $$select private.auto_confirm_completions()$$);
select cron.schedule('trust-refresh', '30 0 * * *', $$select private.refresh_all_trust()$$);
select private.refresh_all_trust();
