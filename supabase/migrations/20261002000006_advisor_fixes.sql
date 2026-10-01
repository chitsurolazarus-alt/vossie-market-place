-- Phase 4: advisor clean-up. Drop a duplicate index and avoid overlapping SELECT policies on trust_tiers.
drop index if exists public.conversations_listing_idx;

drop policy if exists tiers_admin on public.trust_tiers;
create policy tiers_admin_insert on public.trust_tiers for insert to authenticated with check ((select private.is_admin()));
create policy tiers_admin_update on public.trust_tiers for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tiers_admin_delete on public.trust_tiers for delete to authenticated using ((select private.is_admin()));
