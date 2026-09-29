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
