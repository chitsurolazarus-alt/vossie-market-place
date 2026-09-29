-- Typo tolerance: word_similarity >= 0.5 catches 'kotta' (0.57) and 'hair cut' (0.55); unrelated words score <= 0.25
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
           or extensions.word_similarity(q.raw, b.title) >= 0.5)
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
