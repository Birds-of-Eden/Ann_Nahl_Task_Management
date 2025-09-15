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

export async function middleware(req: NextRequest) {
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

    // 4) Validate session server-side by calling internal get-session route.
    // This ensures the token exists in DB and is not expired.
    try {
      const sessionUrl = new URL("/api/auth/get-session", req.url);
      // Forward cookies so server can read session-token
      const sessionRes = await fetch(sessionUrl.toString(), {
        method: "GET",
        headers: { cookie: req.headers.get("cookie") || "" },
        cache: "no-store",
      });

      if (!sessionRes.ok) {
        return new NextResponse(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      return NextResponse.next();
    } catch (err) {
      console.error("Middleware session validation error:", err);
      return new NextResponse(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ---------- B) Guard App Pages ----------
  // If route is a protected base, validate session and also enforce role matching
  const token = req.cookies.get("session-token")?.value;

  const needsAuth = PROTECTED_BASES.some(
    (base) => pathname === base || pathname.startsWith(base + "/")
  );

  if (needsAuth) {
    // If no token, send to sign-in immediately
    if (!token) {
      return NextResponse.redirect(new URL("/auth/sign-in", req.url));
    }

    // Validate session and get user info from internal API
    try {
      const sessionUrl = new URL("/api/auth/get-session", req.url);
      const sessionRes = await fetch(sessionUrl.toString(), {
        method: "GET",
        headers: { cookie: req.headers.get("cookie") || "" },
        cache: "no-store",
      });

      if (!sessionRes.ok) {
        return NextResponse.redirect(new URL("/auth/sign-in", req.url));
      }

      const json = await sessionRes.json();
      const userRole = (json?.user?.role || "client").toLowerCase();

      // extract first segment of pathname (e.g. /agent/... -> agent)
      const seg = pathname.split("/")[1] || "";
      if (seg && PROTECTED_BASES.map((b) => b.replace("/", "")).includes(seg)) {
        // if user not admin and trying to access different role area, redirect
        if (userRole !== "admin" && seg !== userRole) {
          return NextResponse.redirect(new URL(`/${userRole}`, req.url));
        }
      }

      return NextResponse.next();
    } catch (err) {
      console.error("Middleware page session validation error:", err);
      return NextResponse.redirect(new URL("/auth/sign-in", req.url));
    }
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
