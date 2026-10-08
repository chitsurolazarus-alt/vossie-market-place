-- Stage 5: per-screen coach-mark tours. Ids of tours the user has finished or skipped.
alter table public.profiles add column if not exists tours_seen text[] not null default '{}';
