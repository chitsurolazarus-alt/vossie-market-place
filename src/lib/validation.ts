import { z } from "zod";

// Shared by client forms and server actions.

/** Normalise South African mobile numbers to +27XXXXXXXXX, or return null. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  let n: string;
  if (/^\+27\d{9}$/.test(digits)) n = digits;
  else if (/^27\d{9}$/.test(digits)) n = `+${digits}`;
  else if (/^0\d{9}$/.test(digits)) n = `+27${digits.slice(1)}`;
  else return null;
  return /^\+27[6-8]\d{8}$/.test(n) ? n : null;
}

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

export const CONTACT_PREFS = ["in_app", "whatsapp", "both"] as const;
export const PRICING_MODES = ["cash", "swap", "both"] as const;
export const AVAILABILITY = ["available", "sold_out", "paused"] as const;
export const KINDS = ["product", "service"] as const;
export const HANDOVER = ["pickup", "campus_dropoff", "courier"] as const;
export type Handover = (typeof HANDOVER)[number];
export const HANDOVER_LABEL: Record<Handover, string> = { pickup: "Campus pickup point", campus_dropoff: "Campus drop-off", courier: "Courier (seller arranges)" };

/** Seller form fields, grouped so each wizard step can validate its own subset. */
export const sellerBase = z.object({
  businessName: z.string().trim().min(2, "Enter your business name (at least 2 characters)").max(60, "Business name must be 60 characters or fewer"),
  categoryId: z.uuid("Choose a category"),
  tagline: optionalText(80, "Tagline"),
  bio: optionalText(500, "Bio"),
  photoUrl: z.string().max(500),
  contactPref: z.enum(CONTACT_PREFS),
  whatsapp: z.string().trim().max(20),
  campusId: z.uuid("Choose your campus"),
  pickupPointIds: z.array(z.uuid()).min(1, "Choose at least 1 pickup point").max(3, "Choose at most 3 pickup points"),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes").min(3).max(50).optional(),
  agree: z.literal(true, "Please agree to the seller guidelines"),
});
export type SellerInput = z.infer<typeof sellerBase>;

export const sellerSchema = sellerBase.superRefine((v, ctx) => {
  if (v.contactPref !== "in_app" && v.whatsapp && !normalisePhone(v.whatsapp)) {
    ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Enter a South African mobile number, e.g. 082 123 4567" });
  }
});

export const STEP_FIELDS = [
  ["businessName", "categoryId", "tagline"],
  ["bio", "photoUrl"],
  ["contactPref", "whatsapp"],
  ["campusId", "pickupPointIds"],
  ["agree"],
] as const;

export type FieldErrors = Record<string, string>;

export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

/** Validate only the fields for a given wizard step. `requireWhatsapp` true when the pref needs a number. */
export function validateStep(step: number, data: Partial<Omit<SellerInput, "agree">> & { agree?: boolean }, needsNumber: boolean): FieldErrors {
  const res = sellerSchema.safeParse(data);
  const errors = res.success ? {} : issuesToErrors(res.error.issues);
  const allowed = new Set<string>(STEP_FIELDS[step]);
  const stepErrors: FieldErrors = {};
  for (const [k, v] of Object.entries(errors)) if (allowed.has(k)) stepErrors[k] = v;
  if (step === 2 && data.contactPref !== "in_app" && needsNumber && !data.whatsapp?.trim()) {
    stepErrors.whatsapp = "Add your WhatsApp number so buyers can reach you";
  }
  return stepErrors;
}

export const listingSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(KINDS),
    title: z.string().trim().min(3, "Title needs at least 3 characters").max(70, "Title must be 70 characters or fewer"),
    description: optionalText(1000, "Description"),
    categoryId: z.uuid("Choose a category"),
    tags: z.array(z.string().trim().toLowerCase().min(2, "Tags need 2+ characters").max(30, "Tags must be 30 characters or fewer")).max(5, "Up to 5 tags"),
    pricingMode: z.enum(PRICING_MODES),
    priceZar: z.number().int("Use whole rand").min(0, "Price can't be negative").max(1_000_000, "That price looks too high").nullable(),
    priceIsFrom: z.boolean(),
    swapFor: optionalText(200, "Swap details"),
    availability: z.enum(AVAILABILITY),
    pickupPointId: z.uuid().nullable(),
    handover: z.array(z.enum(HANDOVER)).min(1, "Choose at least one way to hand over").max(3),
    deliveryFeeZar: z.number().int("Use whole rand").min(0, "Fee can't be negative").max(5000, "That fee looks too high").nullable(),
    images: z
      .array(z.object({ path: z.string().min(3).max(300), alt: z.string().trim().min(1, "Add alt text").max(200) }))
      .min(1, "Add at least 1 photo")
      .max(5, "Up to 5 photos"),
  })
  .superRefine((v, ctx) => {
    if (v.pricingMode !== "swap" && v.priceZar === null) {
      ctx.addIssue({ code: "custom", path: ["priceZar"], message: "Enter a price in rand" });
    }
    if (v.pricingMode !== "cash" && !v.swapFor) {
      ctx.addIssue({ code: "custom", path: ["swapFor"], message: "Tell buyers what you'd swap for" });
    }
    if (v.kind === "product" && v.handover.includes("pickup") && !v.pickupPointId) {
      ctx.addIssue({ code: "custom", path: ["pickupPointId"], message: "Choose a pickup point for handover" });
    }
  });
export type ListingInput = z.infer<typeof listingSchema>;

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/&/g, " and ")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "seller"
  );
}

export const formatZar = (n: number) => `R${n.toLocaleString("en-ZA")}`;
