"use client";

import { Button } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-3 text-muted">We hit a snag loading this page. Check your connection and try again.</p>
      <div className="mt-6 flex justify-center"><Button onClick={reset}>Try again</Button></div>
    </section>
  );
}
