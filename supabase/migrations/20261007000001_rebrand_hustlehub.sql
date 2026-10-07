-- Rebrand: user-facing text in trigger functions and existing rows says HustleHub, not Vossie.
-- Function bodies are rewritten from their live definitions so no logic is touched. The vossie.net sign-up domain is not matched (lower-case).
do $$
declare r record; def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ 'Vossie'
  loop
    def := replace(replace(pg_get_functiondef(r.oid), 'Vossie Market Place', 'HustleHub'), 'Vossie', 'HustleHub');
    execute def;
  end loop;
end $$;

update public.notifications set title = replace(replace(title, 'Vossie Market Place', 'HustleHub'), 'Vossie', 'HustleHub'), body = replace(replace(body, 'Vossie Market Place', 'HustleHub'), 'Vossie', 'HustleHub')
  where title ~ 'Vossie' or body ~ 'Vossie';
update public.hub_posts set body = replace(replace(body, 'Vossie Market Place', 'HustleHub'), 'Vossie', 'HustleHub') where body ~ 'Vossie';
