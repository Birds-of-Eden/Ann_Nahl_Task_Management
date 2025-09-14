// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Public (unauthenticated) API endpoints — keep minimal
const PUBLIC_API_ROUTES = new Set<string>([
  "/api/auth/sign-in",
  "/api/auth/get-session", // keep or remove as you wish
]);

// All protected app roots (no trailing slash)
const PROTECTED_BASES = [
  "/admin",
  "/agent",
  "/manager",
  "/qc",
  "/am",
  "/am_ceo",
  "/client",
  "/data_entry",
];

export function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // ---------- A) Protect ALL API routes ----------
  if (pathname.startsWith("/api/")) {
    // 0) Always let CORS preflight through
    if (req.method === "OPTIONS") {
      return NextResponse.next();
    }

    // 1) Allow listed public endpoints
    if (PUBLIC_API_ROUTES.has(pathname)) {
      return NextResponse.next();
    }

    const isDev = process.env.NODE_ENV !== "production";

    // 2) Same-origin enforcement (optional: relax in dev)
    const requestOrigin = req.headers.get("origin");
    if (!isDev && requestOrigin && requestOrigin !== origin) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Forbidden: cross-origin blocked",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const referer = req.headers.get("referer");
    if (!isDev && referer && !referer.startsWith(origin)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Forbidden: external referer",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3) Require session cookie for all non-public APIs
    const token = req.cookies.get("session-token")?.value;
    if (!token) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    return NextResponse.next();
  }

  // ---------- B) Guard App Pages ----------
  const token = req.cookies.get("session-token")?.value;

  // exact base or base + "/..."
  const needsAuth = PROTECTED_BASES.some(
    (base) => pathname === base || pathname.startsWith(base + "/")
  );

  if (needsAuth && !token) {
    return NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  return NextResponse.next();
}

// Apply middleware to both app sections and ALL APIs
export const config = {
  matcher: [
    // App pages
    "/admin/:path*",
    "/agent/:path*",
    "/manager/:path*",
    "/qc/:path*",
    "/am/:path*",
    "/am_ceo/:path*",
    "/client/:path*",
    "/data_entry/:path*",
    // APIs
    "/api/:path*",
  ],
};
