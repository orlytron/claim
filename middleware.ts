import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API through unconditionally
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD;

  // Skip auth check if SITE_PASSWORD is not configured (local dev)
  if (!sitePassword) {
    return NextResponse.next();
  }

  const auth = request.cookies.get("auth")?.value;

  if (auth !== sitePassword) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
