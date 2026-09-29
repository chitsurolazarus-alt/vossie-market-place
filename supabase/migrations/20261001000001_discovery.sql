-- Phase 3: discovery. Search, public browse view, view tracking, featured rotation.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. Weighted full-text search: title A, tags B, description C
-- ---------------------------------------------------------------------------
create or replace function private.listings_search_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.search :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce((
      select string_agg(t.name, ' ') from public.listing_tags lt
      join public.tags t on t.id = lt.tag_id where lt.listing_id = new.id), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  new.updated_at := now();
  return new;
end $$;
revoke execute on function private.listings_search_update() from public, anon, authenticated;

-- Re-index a listing whenever its tags change.
create or replace function private.listing_tags_reindex() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings set title = title where id = coalesce(new.listing_id, old.listing_id);
  return null;
end $$;
revoke execute on function private.listing_tags_reindex() from public, anon, authenticated;
create trigger listing_tags_reindex after insert or delete on public.listing_tags
  for each row execute function private.listing_tags_reindex();

update public.listings set title = title; -- backfill

create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);
create index seller_profiles_status_campus_idx on public.seller_profiles (status, campus_id);
create index featured_slots_date_idx on public.featured_slots (slot_date, campus_id);

-- ---------------------------------------------------------------------------
-- 2. Public browse view. The visibility rule lives HERE (and in RLS beneath it):
--    approved seller, not deleted, not hidden by a moderator, not paused.
--    security_invoker = the caller's RLS still applies on the base tables.
-- ---------------------------------------------------------------------------
create view public.browse_listings with (security_invoker = true) as
select
  l.id, l.seller_id, l.campus_id, l.category_id, l.kind, l.title, l.description,
  l.pricing_mode, l.price_zar, l.price_is_from, l.swap_for, l.availability, l.created_at, l.search,
  s.business_name, s.slug as seller_slug, s.verified as seller_verified, s.photo_url as seller_photo,
  c.name as category_name, c.slug as category_slug, ca.name as campus_name,
  img.path as cover_path, img.alt as cover_alt,
  coalesce(tg.tags, '{}'::text[]) as tags
from public.listings l
join public.seller_profiles s on s.id = l.seller_id and s.status = 'approved'
left join public.categories c on c.id = l.category_id
left join public.campuses ca on ca.id = l.campus_id
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
-- 3. Search function (SECURITY INVOKER: RLS + view rules apply to the caller).
--    Full-text match OR trigram word-similarity (typo tolerance).
--    Returns ordered ids + total so the app can paginate with "Load more".
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(
  p_q text default null,
  p_category uuid default null,
  p_campus uuid default null,
  p_kind public.listing_kind default null,
  p_mode text default null,          -- cash | swap | both
  p_min int default null,
  p_max int default null,
  p_available_only boolean default true,
  p_sort text default 'newest',      -- relevance | newest | price_asc | price_desc
  p_limit int default 24,
  p_offset int default 0
) returns table (listing_id uuid, total_count bigint)
language sql stable set search_path = '' as $$
  with q as (
    select nullif(trim(p_q), '') as raw,
           case when nullif(trim(p_q), '') is null then null
                else websearch_to_tsquery('english', trim(p_q)) end as tsq
  ), base as (
    select b.id, b.created_at, b.price_zar,
      case when q.raw is null then 0::float4
           else ts_rank_cd(b.search, q.tsq)
                + (extensions.word_similarity(q.raw, b.title) * 0.5)::float4 end as rank
    from public.browse_listings b, q
    where (q.raw is null
           or b.search @@ q.tsq
           or q.raw operator(extensions.<%) b.title)
      and (p_category is null or b.category_id = p_category)
      and (p_campus is null or b.campus_id = p_campus)
      and (p_kind is null or b.kind = p_kind)
      and (p_mode is null
           or (p_mode = 'cash' and b.pricing_mode in ('cash', 'both'))
           or (p_mode = 'swap' and b.pricing_mode in ('swap', 'both'))
           or (p_mode = 'both' and b.pricing_mode = 'both'))
      and (p_min is null or b.price_zar >= p_min)
      and (p_max is null or b.price_zar <= p_max)
      and (not p_available_only or b.availability = 'available')
  )
  select id, count(*) over () from base
  order by
    case when p_sort = 'price_asc' then price_zar end asc nulls last,
    case when p_sort = 'price_desc' then price_zar end desc nulls last,
    case when p_sort = 'relevance' then rank end desc,
    created_at desc, id
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
$$;

-- ---------------------------------------------------------------------------
-- 4. View tracking: one per viewer per listing per day. Anonymous viewers are
--    identified only by a salted hash of a cookie id (no IP stored).
-- ---------------------------------------------------------------------------
alter table public.listing_views add column anon_hash text;
alter table public.listing_views drop constraint if exists listing_views_listing_id_viewer_id_view_date_key;
alter table public.listing_views add constraint listing_views_actor_chk
  check (viewer_id is not null or anon_hash is not null);
alter table public.listing_views add column viewer_key text
  generated always as (coalesce(viewer_id::text, anon_hash)) stored;
create unique index listing_views_daily_uniq on public.listing_views (listing_id, view_date, viewer_key);
create index listing_views_date_idx on public.listing_views (view_date);

-- ---------------------------------------------------------------------------
-- 5. Featured Hustle rotation (runs daily via pg_cron)
--    Eligible: approved seller with >= 1 available listing, not featured in the previous 7 days.
--    Weight:   1 / (1 + views_in_last_14_days / 10), doubled in the first 14 days after approval.
--    Draw:     weighted random without replacement (Efraimidis-Spirakis: order by -ln(random())/weight).
--    Fallback: if too few eligible sellers, recently featured ones fill the gap (oldest first via the weight draw).
--    Admin override slots (is_override = true) are kept and reduce the number of slots to fill.
-- ---------------------------------------------------------------------------
create or replace function private.rotate_featured(p_slots int default 4, p_date date default current_date)
returns int language plpgsql security definer set search_path = '' as $$
declare
  c record; s record; taken int; need int; pos int; total int := 0;
begin
  for c in select id from public.campuses where active loop
    delete from public.featured_slots where campus_id = c.id and slot_date = p_date and not is_override;
    select count(*) into taken from public.featured_slots where campus_id = c.id and slot_date = p_date;
    need := p_slots - taken;
    continue when need <= 0;

    pos := 0;
    for s in
      with elig as (
        select sp.id as seller_id,
          exists (select 1 from public.featured_slots f
                  where f.seller_id = sp.id and f.slot_date >= p_date - 7 and f.slot_date < p_date) as recent,
          (select count(*) from public.listing_views v join public.listings l on l.id = v.listing_id
            where l.seller_id = sp.id and v.view_date > p_date - 14 and v.view_date <= p_date) as views14,
          (sp.approved_at is not null and sp.approved_at >= (p_date - 14)::timestamptz) as is_new
        from public.seller_profiles sp
        where sp.status = 'approved' and sp.campus_id = c.id
          and exists (select 1 from public.listings l where l.seller_id = sp.id
                      and l.deleted_at is null and not l.hidden_by_moderation and l.availability = 'available')
          and not exists (select 1 from public.featured_slots f
                          where f.seller_id = sp.id and f.slot_date = p_date)
      )
      select seller_id from elig
      order by recent asc,
               (-ln(greatest(random(), 1e-9)) /
                ((1.0 / (1 + views14 / 10.0)) * case when is_new then 2.0 else 1.0 end)) asc
      limit need
    loop
      loop
        pos := pos + 1;
        exit when not exists (select 1 from public.featured_slots f
                              where f.campus_id = c.id and f.slot_date = p_date and f.position = pos);
      end loop;
      insert into public.featured_slots (seller_id, campus_id, slot_date, position, is_override)
      values (s.seller_id, c.id, p_date, pos, false);
      total := total + 1;
    end loop;
  end loop;
  return total;
end $$;
revoke execute on function private.rotate_featured(int, date) from public, anon, authenticated;

-- Daily at 00:05 UTC (02:05 in South Africa)
select cron.schedule('featured-daily', '5 0 * * *', $$select private.rotate_featured()$$);
select private.rotate_featured();
