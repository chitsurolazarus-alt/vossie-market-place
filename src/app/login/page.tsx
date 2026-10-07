import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { PageShell } from "@/components/ui";
import { getUser, safeNext } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  if (await getUser()) redirect(dest);
  return (
    <PageShell title="Sign in to HustleHub" intro="No passwords. We email you a one-time code." width="max-w-md">
      <LoginForm next={dest} demoEnabled={process.env.DEMO_LOGIN_ENABLED === "true"} />
    </PageShell>
  );
}
