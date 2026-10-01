import AdminNav from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  const supabase = await createClient();
  const [sellers, reports] = await Promise.all([
    supabase.from("seller_profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-3xl font-bold text-navy">Admin</h1>
      <div className="mt-3"><AdminNav counts={{ sellers: sellers.count ?? 0, reports: reports.count ?? 0 }} /></div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
