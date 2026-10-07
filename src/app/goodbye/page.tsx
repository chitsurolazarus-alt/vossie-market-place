import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Account deleted", robots: { index: false } };

export default function Goodbye() {
  return (
    <section className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-navy">Your account has been deleted</h1>
      <p className="mt-3 text-ink">Your personal details were removed straight away. Your sign-in will be permanently removed within 30 days. Thank you for being part of HustleHub.</p>
      <div className="mt-6 flex justify-center"><ButtonLink href="/" variant="sand">Back to the home page</ButtonLink></div>
    </section>
  );
}
