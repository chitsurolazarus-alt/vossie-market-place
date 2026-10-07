import { signOut } from "@/app/actions/auth";
import Icon from "@/components/Icon";
import { Button, ButtonLink, PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account" };

const STATUS_COPY: Record<string, string> = {
  draft: "Not submitted yet",
  pending: "Waiting for Incubation Hub approval",
  approved: "Approved seller",
  rejected: "Needs changes",
  suspended: "Suspended",
};

export default async function Account() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", user.id).single();
  const seller = await getMySeller(user.id);

  return (
    <PageShell title="Your account">
      <dl className="grid gap-4 rounded-xl bg-mist p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-muted">Signed in as</dt><dd className="font-semibold text-navy break-all">{user.email}</dd></div>
        <div><dt className="text-sm text-muted">Role</dt><dd className="font-semibold capitalize text-navy">{profile?.role ?? "buyer"}</dd></div>
        <div><dt className="text-sm text-muted">Seller status</dt><dd className="font-semibold text-navy">{seller ? STATUS_COPY[seller.status] : "Not a seller yet"}</dd></div>
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ButtonLink href="/sell" variant="sand">{seller ? "Seller dashboard" : "Start selling"}</ButtonLink>
        <ButtonLink href="/saved" variant="secondary"><Icon name="heart" size="md" />Saved</ButtonLink>
        <ButtonLink href="/looking-for" variant="secondary"><Icon name="megaphone" size="md" />Looking For board</ButtonLink>
        <ButtonLink href="/settings" variant="secondary"><Icon name="settings" size="md" />Settings</ButtonLink>
        {profile?.role === "admin" && <ButtonLink href="/admin" variant="primary">Admin panel</ButtonLink>}
        {(profile?.role === "mentor" || profile?.role === "admin") && <ButtonLink href="/mentor" variant="primary">Mentor view</ButtonLink>}
        <ButtonLink href="/growth" variant="secondary">Hub Growth corner</ButtonLink>
        <form action={signOut}><Button type="submit" variant="secondary" className="w-full">Sign out</Button></form>
      </div>
    </PageShell>
  );
}
