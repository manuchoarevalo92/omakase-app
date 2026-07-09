import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifySessionToken } from "@/src/lib/auth-session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|gif)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Widgets públicos embebibles (p. ej. feed de Instagram en Wix): sin sesión.
  if (pathname.startsWith("/widget")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("omakase_session")?.value;
  const session = await verifySessionToken(token);

  if (pathname.startsWith("/login")) {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (
    session.role === "staff" &&
    (pathname.startsWith("/platos") ||
      pathname.startsWith("/receta") ||
      pathname.startsWith("/estadisticas") ||
      pathname.startsWith("/personal"))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
