import { NextResponse } from "next/server";
import { getSellerStats, statsToCsv } from "@/lib/mentor";
import { actionAuth } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** CSV of the caller's sellers' stats. RLS decides which sellers (a mentor's own, or all for an admin). */
export async function GET() {
  const a = await actionAuth(["mentor", "admin"]);
  if (!a.ok) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const [rows, tiers] = await Promise.all([getSellerStats(), supabase.from("trust_tiers").select("tier,label")]);
  const labels = Object.fromEntries((tiers.data ?? []).map((t) => [t.tier, t.label]));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + statsToCsv(rows, labels), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vossie-sellers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
