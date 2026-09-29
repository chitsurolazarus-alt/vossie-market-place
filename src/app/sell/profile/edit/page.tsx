import { redirect } from "next/navigation";
import { SellerEditForm } from "@/components/sell/SellerForm";
import { PageShell } from "@/components/ui";
import { getMySeller, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadReferenceData, loadSellerInitial } from "@/lib/sell-data";

export const metadata = { title: "Edit profile" };

export default async function EditProfile() {
  const user = await requireUser("/sell/profile/edit");
  const seller = await getMySeller(user.id);
  if (!seller) redirect("/sell/onboarding");

  const supabase = await createClient();
  const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", seller.id);
  const [ref, init] = await Promise.all([loadReferenceData(), loadSellerInitial(seller, user.id)]);

  return (
    <PageShell title="Edit your profile" width="max-w-xl">
      <SellerEditForm
        userId={user.id} {...ref} {...init} mode="edit" currentSlug={seller.slug} slugLocked={seller.slug_edited}
        campusLocked={seller.status === "approved" || (count ?? 0) > 0} profileHref={`/s/${seller.slug}`}
      />
    </PageShell>
  );
}
