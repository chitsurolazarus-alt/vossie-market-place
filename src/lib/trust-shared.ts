// Client-safe trust constants (no server imports).

export type ReplyBand = "hour" | "hours" | "day" | "slow";

export const REPLY_BAND_LABEL: Record<ReplyBand, string> = {
  hour: "Usually replies within an hour",
  hours: "Usually replies within a few hours",
  day: "Usually replies within a day",
  slow: "Replies slowly",
};

export const TIER_STYLE: Record<string, string> = {
  new: "bg-mist text-navy border border-navy/20",
  responsive: "bg-royal text-white",
  trusted: "bg-navy text-white",
  top_hustler: "bg-sand text-navy border border-navy/30",
};

