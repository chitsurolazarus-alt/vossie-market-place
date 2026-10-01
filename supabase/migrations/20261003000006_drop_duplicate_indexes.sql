-- Phase 5: advisor clean-up. These two duplicated indexes that already existed.
drop index if exists public.audit_log_actor_idx;
drop index if exists public.seller_profiles_mentor_idx;
