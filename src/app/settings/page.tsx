import LowDataToggle from "@/components/LowDataToggle";
import { ThemeChooser } from "@/components/ThemeToggle";
import { ButtonLink, PageShell } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { getLowData } from "@/lib/viewer";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const [lowData, user] = await Promise.all([getLowData(), getUser()]);
  return (
    <PageShell title="Settings" width="max-w-xl">
      <div className="space-y-4">
        <ThemeChooser />
        <LowDataToggle initial={lowData} variant="settings" />
        <p className="text-sm text-muted">
          {user ? "This is saved to your account and works on every device you sign in on." : "Saved on this device. Sign in to keep it across devices."}
        </p>
        {user && <ButtonLink href="/settings/privacy" variant="secondary">Privacy and my data</ButtonLink>}
        {user
          ? <ButtonLink href="/account" variant="secondary">Account</ButtonLink>
          : <ButtonLink href="/login?next=/settings" variant="secondary">Sign in</ButtonLink>}
      </div>
    </PageShell>
  );
}
