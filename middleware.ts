// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * The app areas we consider "role-scoped" (must match the first path segment).
 * Key = path prefix, Value = required role for that area.
 */
const AREA_ROLE: Record<string, Role> = {
  "/admin": "admin",
  "/manager": "manager",
  "/agent": "agent",
  "/qc": "qc",
  "/am": "am",
  "/am_ceo": "am_ceo",
  "/client": "client",
  "/data_entry": "data_entry",
};

type Role =
  | "admin"
  | "manager"
  | "agent"
  | "qc"
  | "am"
  | "am_ceo"
  | "data_entry"
  | "client"
  | "user";

interface DecodedToken {
  sub?: string;
  role?: Role;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

const ROUTE_PERMISSION_RULES: { re: RegExp; perm: string }[] = [
  // Add fine-grained rules if needed
  // Example: { re: /^\/admin\/users\/delete/, perm: "users:delete" }
];

export const config = {
  matcher: [
    "/admin/:path*",
    "/agent/:path*",
    "/manager/:path*",
    "/qc/:path*",
    "/am/:path*",
    "/am_ceo/:path*",
    "/client/:path*",
    "/data_entry/:path*",
    "/api/:path*",
    "/auth/:path*",
  ],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // ✅ Allow NextAuth internal endpoints freely
  if (path.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isApi = path.startsWith("/api");

  // ✅ Get JWT token once and reuse
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  }) as DecodedToken | null;

  // 🎭 Check for impersonation cookies
  const impersonationTarget = req.cookies.get("impersonation-target")?.value;
  const impersonationOrigin = req.cookies.get("impersonation-origin")?.value;

  // ✅ Handle /auth/* routes
  if (path.startsWith("/auth")) {
    const res = NextResponse.next();
    // Disable caching for auth pages
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    // If already logged in, redirect to appropriate dashboard
    if (token?.sub) {
      const role = token.role ?? "user";
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }

    return res;
  }

  // ✅ Check if route is protected
  const firstSeg = "/" + (path.split("/")[1] || "");
  const isProtected = firstSeg in AREA_ROLE || isApi;

  // ✅ Require authentication for protected routes
  if (isProtected && !token?.sub) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  // ✅ Allow unprotected routes
  if (!isProtected) {
    return NextResponse.next();
  }

  // ✅ Get role from token (should be set in jwt callback)
  let role = token?.role ?? "user";

  // 🎭 If impersonating, use the role from cookie (set during impersonation start)
  const impersonationRole = req.cookies.get("impersonation-role")?.value;
  if (impersonationTarget && impersonationOrigin && token?.sub === impersonationOrigin && impersonationRole) {
    role = impersonationRole.toLowerCase() as Role;
  }

  // ⚠️ If role is missing from token, this is a config issue
  if (!role || role === "user") {
    console.error(
      `[Middleware] Missing role in JWT for user ${token?.sub}. Check auth.ts jwt callback.`
    );
    // For safety, deny access to role-specific areas
    if (firstSeg in AREA_ROLE) {
      return isApi
        ? NextResponse.json({ error: "Role not configured" }, { status: 403 })
        : NextResponse.redirect(new URL("/auth/sign-in", req.url));
    }
  }

  // ✅ Enforce role-based access control
  const requiredRole = AREA_ROLE[firstSeg as keyof typeof AREA_ROLE];
  if (requiredRole && role !== requiredRole) {
    return deny(req, isApi, roleHome(role));
  }

  // ✅ OPTIONAL: Fine-grained permission checks
  // Note: For permission checks, you'll need to add permissions to JWT token
  // or accept the performance cost of fetching from DB/API
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (rule.re.test(path)) {
      // Permissions not in JWT by default (too large for token)
      // You can either:
      // 1. Add critical permissions to JWT (limited set)
      // 2. Use API call for permission-heavy routes (trade-off)
      // For now, this is a placeholder
      console.warn(
        `[Middleware] Permission check for ${rule.perm} requires additional implementation`
      );
    }
  }

  // ✅ All checks passed
  return NextResponse.next();
}

function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "manager":
      return "/manager";
    case "agent":
      return "/agent";
    case "qc":
      return "/qc";
    case "am":
      return "/am";
    case "am_ceo":
      return "/am_ceo";
    case "data_entry":
      return "/data_entry";
    case "client":
    case "user":
    default:
      return "/client";
  }
}

function deny(req: NextRequest, isApi: boolean, fallback: string) {
  return isApi
    ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
    : NextResponse.redirect(new URL(fallback, req.url));
}
