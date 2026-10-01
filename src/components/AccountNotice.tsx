import { getProfile, isSuspended } from "@/lib/roles";

/** Tells a suspended or banned user why they can browse but not list or message. */
export default async function AccountNotice() {
  const p = await getProfile();
  if (!p) return null;
  if (!isSuspended({ ...p, deleted_at: null })) return null;
  return (
    <div role="alert" className="border-b-4 border-red-800 bg-red-50 text-red-950">
      <p className="mx-auto max-w-5xl px-4 py-3 text-sm font-medium">
        {p.banned_at
          ? `Your account has been banned${p.ban_reason ? `: ${p.ban_reason}` : "."}`
          : `Your account is suspended until ${new Date(p.suspended_until!).toLocaleString("en-ZA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" })}${p.suspension_reason ? `: ${p.suspension_reason}` : "."} You can browse, but you can't list or message.`}
        {" "}Questions? Contact the Information Officer via the privacy page.
      </p>
    </div>
  );
}
