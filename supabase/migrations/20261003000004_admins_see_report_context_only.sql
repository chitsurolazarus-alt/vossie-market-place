-- Phase 5: admins no longer have blanket read access to message threads. They see only the snapshot of a reported
-- message and its surrounding messages (public.report_context), taken when the report was filed.
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
  using (private.in_conversation(conversation_id));
