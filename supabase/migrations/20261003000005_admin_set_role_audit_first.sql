-- Phase 5: write the audit row BEFORE changing the role. An admin who steps down (when another admin exists) would
-- otherwise lose the right to write the audit row mid-function. The function is atomic, so a failed change rolls the
-- audit row back too.
create or replace function public.admin_set_role(p_user uuid, p_role public.user_role, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare p public.profiles; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then raise exception 'Admins only'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then raise exception 'User not found'; end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), 'user.set_role', 'user', p_user::text, jsonb_build_object('role', p.role), jsonb_build_object('role', p_role), v_reason);
  update public.profiles set role = p_role where id = p_user;
end $$;
