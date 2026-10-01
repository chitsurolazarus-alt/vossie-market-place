// Shared by client components and server actions (no server-only imports).

export const MAX_BODY = 1000;
export const MAX_IMAGE_BYTES = 400 * 1024;

export type RiskFlag = "payment" | "bank";

/**
 * Scam-pattern detector. Mirrors private.message_risk() in the database (the DB value is the one stored
 * on each message; this copy powers the live composer warning). We warn, we never block.
 */
const PAYMENT =
  /(deposit\s*(first|upfront|before|required|needed)|(pay|send|transfer|eft|put)\s+(me\s+)?(a\s+|the\s+|your\s+)?(deposit|booking fee|upfront|in advance|first)|pay\s+before|money\s+first|upfront\s+payment)/i;
const BANK =
  /(account\s*(no|nr|number|#)|\bacc\s*(no|nr|number)|\biban\b|\bswift\b|branch\s*code|\bcvv\b|\botp\b|card\s*number|\b(fnb|absa|nedbank|capitec|tymebank|standard bank|african bank|discovery bank)\b[^\n]{0,40}\d{6,})/i;

export function detectRisk(text: string): RiskFlag | null {
  if (PAYMENT.test(text)) return "payment";
  if (BANK.test(text)) return "bank";
  return null;
}

export const RISK_TIPS: Record<RiskFlag, string> = {
  payment: "Safety tip: never pay a deposit or send money before you have met and seen the item or service. Pay on collection at a campus pickup point.",
  bank: "Safety tip: be careful sharing bank details, card numbers or one-time PINs in chat. Vossie will never ask for them.",
};

export type Segment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

/** Split plain text into text and http(s) link segments. No HTML is ever produced. */
export function linkify(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[1];
    // trailing punctuation belongs to the sentence, not the link
    const trail = url.match(/[.,!?;:)\]]+$/)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    out.push({ type: "link", text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = start + url.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out.length ? out : [{ type: "text", text }];
}

/** Friendly messages for the database's rate-limit and rule exceptions. */
export function friendlyDbError(message: string | undefined, fallback = "Something went wrong. Please try again."): string {
  const m = message ?? "";
  if (m.includes("rate_limit_messages")) return "You're sending messages too fast. Wait a moment and try again (limit: 30 a minute).";
  if (m.includes("rate_limit_conversations")) return "You've started a lot of conversations. Please wait a while before starting another (limit: 10 an hour).";
  if (m.includes("own_listing")) return "You can't message your own hustle.";
  if (m.includes("cash only")) return "That listing is cash only, so swap offers aren't available.";
  if (m.includes("your own listings")) return "You can only offer one of your own listings.";
  if (m.includes("Invalid image")) return "That image couldn't be attached.";
  return fallback;
}

export const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

export function dayLabel(iso: string, now = new Date()): string {
  const d = dayKey(iso);
  if (d === dayKey(now.toISOString())) return "Today";
  if (d === dayKey(new Date(now.getTime() - 86400000).toISOString())) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });

/** Compact relative time for inbox rows: "now", "5m", "3h", "Yesterday", "12 Sep". */
export function shortTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000 && dayKey(iso) === dayKey(now.toISOString())) return `${Math.floor(diff / 3_600_000)}h`;
  if (dayLabel(iso, now) === "Yesterday") return "Yesterday";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}

export const AUTO_CONFIRM_DAYS = 7;
