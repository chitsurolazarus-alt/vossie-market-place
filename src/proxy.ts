import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "vossie_vid";
const SEEN_COOKIE = "vossie_seen";

// Keeps the Supabase auth cookie fresh, issues a random anonymous visitor id (used only to count one view per
// visitor per day; never linked to a person), gates /admin and /mentor by role, and stamps "last seen" at most hourly.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let newVid: string | null = null;
  if (!request.cookies.get(VISITOR_COOKIE)) {
    newVid = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, newVid); // visible to this request's server components
  }

  let response = NextResponse.next({ request });
  let stampSeen = false;
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
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    const path = request.nextUrl.pathname;
    const area = path === "/admin" || path.startsWith("/admin/") ? "admin" : path === "/mentor" || path.startsWith("/mentor/") ? "mentor" : null;
    if (area) {
      if (!user) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", path);
        return NextResponse.redirect(login);
      }
      const { data: p } = await supabase.from("profiles").select("role,banned_at,deleted_at").eq("id", user.id).maybeSingle();
      const ok = !!p && !p.banned_at && !p.deleted_at && (area === "admin" ? p.role === "admin" : p.role === "mentor" || p.role === "admin");
      if (!ok) return NextResponse.rewrite(new URL("/404", request.url), { status: 404 }); // not advertised to other roles
    }

    if (user && !request.cookies.get(SEEN_COOKIE)) {
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
      stampSeen = true;
    }
  }
  if (newVid) {
    response.cookies.set(VISITOR_COOKIE, newVid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  if (stampSeen) response.cookies.set(SEEN_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|brand/|icons/|api/health).*)"],
};
