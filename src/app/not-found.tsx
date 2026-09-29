import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-navy">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">The link may be old, or the seller or listing may no longer be available.</p>
      <div className="mt-6 flex justify-center"><ButtonLink href="/">Back to home</ButtonLink></div>
    </section>
  );
}
