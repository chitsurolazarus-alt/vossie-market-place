-- Phase 4: tier label on listing cards (admin-editable via trust_tiers).
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
join public.seller_profiles s on s.id = l.seller_id and s.status = 'approved'
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
