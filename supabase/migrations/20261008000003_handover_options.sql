-- Stage 7: per-listing handover options (pickup point, campus drop-off, seller-arranged courier) and an optional delivery fee.
alter table public.listings
  add column if not exists handover text[] not null default '{pickup}',
  add column if not exists delivery_fee_zar int check (delivery_fee_zar is null or delivery_fee_zar between 0 and 5000);

alter table public.listings drop constraint if exists handover_valid;
alter table public.listings add constraint handover_valid
  check (cardinality(handover) between 1 and 3 and handover <@ array['pickup','campus_dropoff','courier']);

-- Keep what sellers already chose: services marked "delivered on campus" become campus drop-off (plus pickup if a point was set).
update public.listings set handover = array_remove(array[
  case when pickup_point_id is not null or not delivered_on_campus then 'pickup' end,
  case when delivered_on_campus then 'campus_dropoff' end], null)
where delivered_on_campus;
