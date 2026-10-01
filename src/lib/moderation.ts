// Shared by client components and server actions.

export type ReportTarget = "listing" | "seller" | "user" | "message";
export type ReportReason = "scam" | "prohibited_item" | "inappropriate" | "harassment" | "fake_profile" | "wrong_category" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "scam", label: "Scam or fraud", hint: "Asking for money first, fake items, phishing" },
  { value: "prohibited_item", label: "Prohibited item", hint: "Things that break the seller guidelines or the law" },
  { value: "inappropriate", label: "Offensive content", hint: "Hateful, sexual or violent content" },
  { value: "harassment", label: "Harassment", hint: "Threats, bullying or unwanted contact" },
  { value: "fake_profile", label: "Fake profile", hint: "Pretending to be someone or a business they are not" },
  { value: "wrong_category", label: "Wrong category or spam", hint: "Listed in the wrong place or repeated spam" },
  { value: "other", label: "Something else", hint: "Tell us more below" },
];

export const REASON_LABEL: Record<string, string> = Object.fromEntries([
  ...REPORT_REASONS.map((r) => [r.value, r.label]), ["spam", "Spam"], ["unsafe", "Unsafe"],
]);

export const TARGET_LABEL: Record<string, string> = { listing: "Listing", seller: "Seller profile", user: "User", message: "Message", request: "Request" };

export function friendlyModerationError(message: string | undefined, fallback = "Something went wrong. Please try again."): string {
  const m = message ?? "";
  const map: [string, string][] = [
    ["rate_limit_reports", "You've sent a lot of reports today (limit: 10 a day). Please try again tomorrow."],
    ["report_own_content", "You can't report your own content."],
    ["report_target_missing", "We couldn't find that to report."],
    ["reports_one_open", "You've already reported this. We're reviewing it."],
    ["account_suspended", "Your account is suspended, so you can't do that right now."],
    ["last_admin", "You can't remove the last admin. Make another admin first."],
    ["Admins only", "Only admins can do that."],
    ["not waiting for review", "That profile is no longer waiting for review."],
    ["A reason is required", "Please write a reason (at least 3 characters)."],
    ["already resolved", "Someone already resolved this report."],
    ["Demote this admin", "Demote this admin before taking action against them."],
    ["Write the warning", "Write the warning message first."],
    ["1 to 365 days", "Choose a suspension of 1 to 365 days."],
    ["Only listings can be hidden", "Only listings can be hidden. Choose warn, suspend or ban for this report."],
    ["not a mentor", "That user isn't a mentor."],
    ["event_full", "Sorry, this event is full."],
    ["session is not open", "That session isn't open for booking."],
  ];
  for (const [k, v] of map) if (m.includes(k)) return v;
  return fallback;
}

export const SUSPEND_OPTIONS = [
  { days: 1, label: "1 day" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" },
];

export const ACTION_LABEL: Record<string, string> = {
  dismiss: "Dismissed", hide: "Content hidden", warn: "User warned", suspend: "User suspended", ban: "User banned",
};
