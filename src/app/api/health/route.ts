import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Reads nothing sensitive: only pings the Supabase Auth health endpoint
// with the public anon key. Never touches the service role key.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ ok: false, supabase: "not_configured" }, { status: 503 });
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json(
      { ok: res.ok, supabase: res.ok ? "reachable" : "unreachable", status: res.status },
      { status: res.ok ? 200 : 502 }
    );
  } catch {
    return NextResponse.json({ ok: false, supabase: "unreachable" }, { status: 502 });
  }
}
