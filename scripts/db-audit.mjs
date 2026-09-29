// Security/performance audit approximating the Supabase advisors.
// Usage: DATABASE_URL=postgresql://... node scripts/db-audit.mjs
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const checks = {
  "Tables in public WITHOUT row level security": `
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
  "Tables with RLS but no policies (deny-all; ok if intentional)": `
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)`,
  "Functions in public schema (exposed via API)": `
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'`,
  "Functions with mutable search_path": `
    select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')`,
  "Foreign keys without a covering index": `
    select c.conrelid::regclass::text || '(' || a.attname || ')' as fk
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])`,
  "Policies calling auth.uid() without (select ...) wrapper": `
    select tablename || '.' || policyname as p from pg_policies
    where schemaname in ('public','storage')
      and (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\\.uid\\(\\)'
      and (coalesce(qual,'') || coalesce(with_check,'')) !~ 'SELECT auth\\.uid\\(\\)'`,
  "Multiple permissive policies for same role+action": `
    select tablename || ' ' || cmd || ' ' || roles::text as dup, count(*) from pg_policies
    where schemaname = 'public' and permissive = 'PERMISSIVE'
    group by tablename, cmd, roles having count(*) > 1`,
  "Public buckets with a broad SELECT policy (listing exposure)": `
    select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT' and 'anon' = any(roles::text[])`,
};

let issues = 0;
for (const [name, sql] of Object.entries(checks)) {
  const { rows } = await client.query(sql);
  console.log(`\n== ${name}: ${rows.length}`);
  rows.forEach((r) => console.log("  -", Object.values(r).join(" | ")));
  if (!name.includes("no policies") && !name.includes("Multiple") && rows.length) issues += rows.length;
}
await client.end();
console.log(`\nTotal flagged (excluding informational): ${issues}`);
