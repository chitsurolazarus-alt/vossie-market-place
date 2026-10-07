import { REPLY_BAND_LABEL, TIER_STYLE, type ReplyBand } from "@/lib/trust-shared";

import Icon from "./Icon";
/** Text badge (no stars). Colour is never the only signal: the tier name is always shown. */
export function TrustBadge({ tier, label, size = "md" }: { tier: string | null | undefined; label?: string | null; size?: "sm" | "md" }) {
  const t = tier ?? "new";
  const text = label ?? ({ new: "New seller", responsive: "Responsive", trusted: "Trusted", top_hustler: "Top Hustler" } as Record<string, string>)[t] ?? "New seller";
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${pad} ${TIER_STYLE[t] ?? TIER_STYLE.new}`} data-slot="trust-score">
      <Icon name="shield" size="sm" />
      {text}
    </span>
  );
}

export function ReplyTime({ band, className = "" }: { band: string | null | undefined; className?: string }) {
  if (!band || !(band in REPLY_BAND_LABEL)) return null;
  return <p className={className} data-slot="reply-time">{REPLY_BAND_LABEL[band as ReplyBand]}</p>;
}
