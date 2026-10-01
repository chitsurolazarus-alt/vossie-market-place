import Link from "next/link";
import UserActions from "@/components/admin/UserActions";
import { EmptyState, inputCls } from "@/components/ui";
import { shortTime } from "@/lib/messages";
import { requireAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Users" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { user: me } = await requireAdmin("/admin/users");
  const q = one(sp.q).trim().slice(0, 60).replace(/[%,()]/g, "");
  const role = one(sp.role);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id,display_name,email,role,created_at,last_seen_at,suspended_until,suspension_reason,banned_at,deleted_at,seller_profiles!seller_profiles_user_id_fkey(id,business_name,slug)")
    .order("created_at", { ascending: false }).limit(30);
  if (q) query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (["buyer", "seller", "mentor", "admin"].includes(role)) query = query.eq("role", role as "buyer");
  const { data } = await query;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Users</h2>
      <form method="get" role="search" className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <div><label htmlFor="q" className="sr-only">Search users</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Name or email" className={inputCls} /></div>
        <div><label htmlFor="role" className="sr-only">Role</label>
          <select id="role" name="role" defaultValue={role} className={inputCls}>
            <option value="">All roles</option>{["buyer", "seller", "mentor", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select></div>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-5 font-semibold text-white hover:bg-royal">Search</button>
      </form>
      <div className="mt-4">
        {(data ?? []).length === 0 ? <EmptyState title="No users found" body="Try a different search." /> : (
          <ul className="space-y-3">
            {data!.map((u) => {
              const seller = Array.isArray(u.seller_profiles) ? u.seller_profiles[0] : u.seller_profiles;
              const suspended = !!u.suspended_until && new Date(u.suspended_until) > new Date();
              const restricted = suspended || !!u.banned_at;
              return (
                <li key={u.id} className="rounded-2xl border border-navy/15 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{u.display_name ?? "No name"}</p>
                      <p className="truncate text-sm text-muted">{u.email ?? "No email on record"}</p>
                      <p className="text-xs text-muted">{u.last_seen_at ? `Seen ${shortTime(u.last_seen_at)} ago` : "Not seen yet"}</p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-bold">
                      <span className="rounded-full bg-mist px-2 py-0.5 capitalize text-navy">{u.role}</span>
                      {u.banned_at && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-900">Banned</span>}
                      {suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-900">Suspended</span>}
                      {u.deleted_at && <span className="rounded-full bg-mist px-2 py-0.5 text-muted">Deleted</span>}
                    </span>
                  </div>
                  {seller && <Link href={`/admin/sellers/${seller.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-royal underline">Seller: {seller.business_name}</Link>}
                  {!u.deleted_at && <UserActions userId={u.id} role={u.role} restricted={restricted} isSelf={u.id === me.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
