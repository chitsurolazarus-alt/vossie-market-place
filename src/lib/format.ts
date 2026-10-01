import { formatZar } from "@/lib/validation";

export const publicImageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${path}`;

export function priceLabel(l: { pricing_mode: string; price_zar: number | null; price_is_from: boolean }) {
  const cash = l.price_zar === null ? "" : `${l.price_is_from ? "From " : ""}${formatZar(l.price_zar)}`;
  if (l.pricing_mode === "swap") return "Swap";
  if (l.pricing_mode === "both") return `${cash} or swap`;
  return cash;
}

export const AVAILABILITY_LABEL: Record<string, string> = {
  available: "Available", sold_out: "Sold out", paused: "Paused",
};

export const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });

export const isWithinDays = (iso: string, days: number) => Date.now() - new Date(iso).getTime() < days * 24 * 3600 * 1000;

export const hubCoverUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hub-covers/${path}`;

export const dateTimeSA = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });

/** ISO instant -> value for <input type="datetime-local"> in South African time. */
export const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Africa/Johannesburg" }).replace(" ", "T").slice(0, 16) : "";
