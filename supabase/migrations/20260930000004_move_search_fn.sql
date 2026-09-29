-- Keep trigger helpers out of the API-exposed public schema
alter function public.listings_search_update() set schema private;
revoke execute on function private.listings_search_update() from public, anon, authenticated;
