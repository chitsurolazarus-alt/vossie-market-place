import Link from "next/link";
import ConfigTable from "@/components/admin/ConfigTable";
import SettingsForm from "@/components/admin/SettingsForm";
import { SECTIONS } from "@/lib/admin-sections";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Manage" };
export const dynamic = "force-dynamic";
const KEYS = [...Object.keys(SECTIONS), "settings"];
const LABELS: Record<string, string> = { settings: "Settings", ...Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, v.title])) };

export default async function AdminManage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const key = KEYS.includes(s ?? "") ? (s as string) : "categories";
  const supabase = await createClient();

  let body: React.ReactNode;
  if (key === "settings") {
    const { data } = await supabase.from("site_settings").select("key,value");
    const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value as Record<string, unknown> | undefined;
    const o = get("information_officer") ?? {};
    body = <SettingsForm autoHide={Number(get("auto_hide_threshold")?.n ?? 3)} officer={{ name: String(o.name ?? ""), email: (o.email as string) ?? null, phone: (o.phone as string) ?? null, note: (o.note as string) ?? null }} />;
  } else {
    const spec = SECTIONS[key];
    const [{ data: rows }, { data: campuses }, { data: sellers }] = await Promise.all([
      supabase.from(spec.table as "categories").select("*").order(spec.orderBy as "id", { ascending: key !== "featured_slots" }).limit(200),
      supabase.from("campuses").select("id,name").order("name"),
      key === "featured_slots" ? supabase.from("seller_profiles").select("id,business_name").eq("status", "approved").order("business_name") : Promise.resolve({ data: [] }),
    ]);
    body = <ConfigTable sectionKey={key} spec={spec} rows={(rows ?? []) as never} options={{
      campuses: (campuses ?? []).map((c) => ({ value: c.id, label: c.name })),
      sellers: (sellers ?? []).map((x) => ({ value: x.id, label: x.business_name })),
    }} />;
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-navy">Manage</h2>
      <nav aria-label="Manage sections" className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex gap-2 pb-1">
          {KEYS.map((k) => (
            <li key={k} className="shrink-0">
              <Link href={`/admin/manage?s=${k}`} aria-current={k === key ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border-2 px-3 text-sm font-semibold ${k === key ? "border-navy bg-navy text-white" : "border-navy/30 text-navy hover:bg-mist"}`}>{LABELS[k]}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <section className="mt-5" aria-labelledby="sec-h">
        <h3 id="sec-h" className="font-display text-xl font-bold text-navy">{LABELS[key]}</h3>
        <div className="mt-2">{body}</div>
      </section>
    </div>
  );
}
