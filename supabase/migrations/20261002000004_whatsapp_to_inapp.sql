-- Phase 4: a WhatsApp-sourced enquiry becomes a normal in-app enquiry when the buyer sends the first in-app
-- message. The reply clock then starts from that message (not from the earlier WhatsApp tap) and the seller
-- gets a regular "new enquiry" notification.
create or replace function private.message_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record; e record; recipient uuid; from_seller boolean; preview text; n int; converted boolean := false;
begin
  select cv.buyer_id, cv.seller_id, cv.buyer_name, cv.seller_name, cv.listing_title, s.user_id as seller_user into c
    from public.conversations cv join public.seller_profiles s on s.id = cv.seller_id where cv.id = new.conversation_id;
  from_seller := new.sender_id = c.seller_user;
  preview := case when new.kind = 'swap_offer' then 'Swap offer' || coalesce(': ' || left(coalesce(new.swap_listing_title, nullif(btrim(new.body), '')), 80), '')
                  when btrim(new.body) = '' then 'Photo'
                  else left(regexp_replace(new.body, '\s+', ' ', 'g'), 120) end;
  update public.conversations set last_message_at = new.created_at, last_message_preview = preview, last_sender_id = new.sender_id
   where id = new.conversation_id;

  select id, status, sale_happened, first_response_at, source into e from public.enquiries where conversation_id = new.conversation_id;
  select count(*) into n from public.messages where conversation_id = new.conversation_id;

  if from_seller then
    if e.first_response_at is null and e.source = 'in_app' then
      update public.enquiries set first_response_at = new.created_at where id = e.id;
    end if;
  else
    if e.source = 'whatsapp' and n = 1 then
      update public.enquiries set source = 'in_app', created_at = new.created_at where id = e.id;
      converted := true;
    elsif e.status = 'declined' or (e.status = 'completed' and e.sale_happened is not true) then
      update public.enquiries set status = 'new' where id = e.id;  -- buyer re-enquires: reopen
    end if;
  end if;

  if converted then
    perform private.notify(c.seller_user, 'new_enquiry', 'New enquiry from ' || c.buyer_name,
      coalesce(c.listing_title, 'About your hustle'), '/messages/' || new.conversation_id, new.conversation_id, e.id);
  elsif n > 1 then  -- the very first message is covered by the new-enquiry notification
    recipient := case when from_seller then c.buyer_id else c.seller_user end;
    perform private.notify(recipient, 'new_message',
      'New message from ' || case when from_seller then c.seller_name else c.buyer_name end,
      preview, '/messages/' || new.conversation_id, new.conversation_id, e.id);
  end if;
  return null;
end $$;
revoke execute on function private.message_after_insert() from public, anon, authenticated;
