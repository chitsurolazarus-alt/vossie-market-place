import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, Ref } from "react";

export const inputCls =
  "block w-full min-h-11 rounded-lg border border-navy/30 bg-white px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-royal aria-[invalid=true]:border-red-700";

export function Field({
  label, htmlFor, error, hint, children, counter,
}: {
  label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode; counter?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="font-semibold text-navy">{label}</label>
        {counter && <span className="text-sm text-muted" aria-hidden="true">{counter}</span>}
      </div>
      {hint && <p id={`${htmlFor}-hint`} className="text-sm text-muted">{hint}</p>}
      {children}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-red-800">{error}</p>}
    </div>
  );
}

export const describe = (id: string, error?: string, hint?: boolean) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

const btnBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const variants = {
  primary: "bg-navy text-white hover:bg-royal",
  secondary: "border-2 border-navy text-navy hover:bg-mist",
  sand: "bg-sand text-navy hover:brightness-95",
  danger: "border-2 border-red-800 text-red-800 hover:bg-red-50",
};
export type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; ref?: Ref<HTMLButtonElement> }) {
  return <button {...props} className={`${btnBase} ${variants[variant]} ${className}`} />;
}
export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return <Link href={href} className={`${btnBase} ${variants[variant]} ${className}`}>{children}</Link>;
}

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const tones = {
    error: "border-red-800 bg-red-50 text-red-900",
    info: "border-royal bg-blue-50 text-navy",
    success: "border-emerald-800 bg-emerald-50 text-emerald-950",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border-l-4 p-3 ${tones[tone]}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-navy/10 ${className}`} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-navy/25 bg-mist px-6 py-10 text-center">
      <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageShell({ title, intro, children, width = "max-w-3xl" }: { title: string; intro?: string; children: ReactNode; width?: string }) {
  return (
    <section className={`mx-auto ${width} px-4 py-8 sm:py-12`}>
      <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
      {intro && <p className="mt-2 text-muted">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
