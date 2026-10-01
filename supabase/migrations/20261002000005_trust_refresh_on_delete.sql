-- Phase 4: trust scores must also be recomputed when an enquiry disappears (cascade delete of a conversation).
create or replace function private.enquiry_trust_refresh_del() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_seller_trust(old.seller_id);
  return null;
end $$;
create trigger enquiry_trust_refresh_del after delete on public.enquiries
  for each row execute function private.enquiry_trust_refresh_del();
revoke execute on function private.enquiry_trust_refresh_del() from public, anon, authenticated;
select private.refresh_all_trust();
