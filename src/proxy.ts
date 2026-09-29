import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "vossie_vid";

// Keeps the Supabase auth cookie fresh and issues a random anonymous visitor id
// (used only to count one view per visitor per day; never linked to a person).
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let newVid: string | null = null;
  if (!request.cookies.get(VISITOR_COOKIE)) {
    newVid = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, newVid); // visible to this request's server components
  }

  let response = NextResponse.next({ request });
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  }
  if (newVid) {
    response.cookies.set(VISITOR_COOKIE, newVid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|brand/|icons/|api/health).*)"],
};
