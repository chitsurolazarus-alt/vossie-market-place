export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold text-navy">You&apos;re offline</h1>
      <p className="mt-3 text-muted">Check your data or Wi-Fi connection and try again. Pages you&apos;ve already visited may still work.</p>
    </section>
  );
}
