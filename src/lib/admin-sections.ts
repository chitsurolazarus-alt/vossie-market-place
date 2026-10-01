import { z } from "zod";

// Definitions for the admin "Manage" screens. Shared by the UI (renders the fields) and the server action (validates).

export type FieldType = "text" | "textarea" | "number" | "bool" | "select" | "date";
export type Field = { key: string; label: string; type: FieldType; required?: boolean; step?: number; min?: number; max?: number; optionsKey?: string; hint?: string };
export type Section = {
  title: string; table: string; pk: string; fields: Field[]; canCreate: boolean; canDelete: boolean; help: string; orderBy: string;
};

const slug = { key: "slug", label: "Slug (lowercase, dashes)", type: "text", required: true } as const;

export const SECTIONS: Record<string, Section> = {
  categories: {
    title: "Categories", table: "categories", pk: "id", canCreate: true, canDelete: false, orderBy: "sort_order",
    help: "Categories can be hidden (inactive) but not deleted, because listings use them.",
    fields: [{ key: "name", label: "Name", type: "text", required: true }, slug, { key: "sort_order", label: "Order", type: "number", min: 0, max: 999 }, { key: "active", label: "Active", type: "bool" }],
  },
  campuses: {
    title: "Campuses", table: "campuses", pk: "id", canCreate: true, canDelete: false, orderBy: "name",
    help: "Adding a campus makes the marketplace multi-campus. Set inactive to hide a campus.",
    fields: [{ key: "name", label: "Name", type: "text", required: true }, slug, { key: "city", label: "City", type: "text" }, { key: "active", label: "Active", type: "bool" }],
  },
  pickup_points: {
    title: "Pickup points", table: "pickup_points", pk: "id", canCreate: true, canDelete: false, orderBy: "name",
    help: "Safe campus hand-over spots. Sellers can only choose approved points on their campus.",
    fields: [{ key: "name", label: "Name", type: "text", required: true }, { key: "description", label: "Description", type: "text" },
      { key: "campus_id", label: "Campus", type: "select", required: true, optionsKey: "campuses" }, { key: "approved", label: "Approved", type: "bool" }],
  },
  trust_tiers: {
    title: "Trust tiers", table: "trust_tiers", pk: "tier", canCreate: false, canDelete: false, orderBy: "rank",
    help: "Thresholds for each badge. Scores recompute on every enquiry change and nightly. Response rate is 0 to 1 (0.85 = 85%).",
    fields: [{ key: "label", label: "Label", type: "text", required: true }, { key: "summary", label: "Summary", type: "text", required: true },
      { key: "min_enquiries", label: "Min enquiries (90d)", type: "number", min: 0 }, { key: "min_response_rate", label: "Min response rate", type: "number", step: 0.01, min: 0, max: 1 },
      { key: "min_confirmed", label: "Min confirmed sales", type: "number", min: 0 }, { key: "min_account_days", label: "Min account days", type: "number", min: 0 },
      { key: "requires_verified", label: "Needs Verified", type: "bool" }],
  },
  feature_flags: {
    title: "Feature flags", table: "feature_flags", pk: "key", canCreate: false, canDelete: false, orderBy: "key",
    help: "Switch features on or off without a deploy.",
    fields: [{ key: "enabled", label: "Enabled", type: "bool" }, { key: "description", label: "Description", type: "text" }],
  },
  allowed_email_domains: {
    title: "Allowed email domains", table: "allowed_email_domains", pk: "domain", canCreate: true, canDelete: true, orderBy: "domain",
    help: "Anyone with an address on these domains can sign up (for example vossie.net). Roles are never granted by domain.",
    fields: [{ key: "domain", label: "Domain", type: "text", required: true, hint: "e.g. vossie.net" }],
  },
  allowed_emails: {
    title: "Allowed individual emails", table: "allowed_emails", pk: "email", canCreate: true, canDelete: true, orderBy: "email",
    help: "Named addresses that may sign up even if their domain is not allowed (staff, testers).",
    fields: [{ key: "email", label: "Email", type: "text", required: true }, { key: "note", label: "Note", type: "text" }],
  },
  featured_slots: {
    title: "Featured Hustle overrides", table: "featured_slots", pk: "id", canCreate: true, canDelete: true, orderBy: "slot_date",
    help: "Pin a seller into today's or a future Featured Hustle slot. Overrides are kept when the daily rotation runs.",
    fields: [{ key: "seller_id", label: "Seller", type: "select", required: true, optionsKey: "sellers" }, { key: "campus_id", label: "Campus", type: "select", required: true, optionsKey: "campuses" },
      { key: "slot_date", label: "Date", type: "date", required: true }, { key: "position", label: "Position (1-4)", type: "number", min: 1, max: 8 }],
  },
};

/** Build a zod schema from field definitions. Empty optional text becomes null. */
export function buildSchema(fields: Field[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.type === "bool") shape[f.key] = z.boolean();
    else if (f.type === "number") {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      shape[f.key] = n;
    } else if (f.type === "date") shape[f.key] = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
    else if (f.type === "select") shape[f.key] = z.string().min(1, `Choose ${f.label.toLowerCase()}`);
    else shape[f.key] = f.required ? z.string().trim().min(1, `${f.label} is required`).max(300) : z.string().trim().max(300).transform((v) => v || null).nullable();
  }
  return z.object(shape);
}
