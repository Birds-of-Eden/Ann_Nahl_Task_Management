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

const ROUTE_PERMISSION_RULES: { re: RegExp; perm: string }[] = [
  // Add fine-grained rules if needed
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
    "/auth/:path*", // ✅ guard sign-in routes too
  ],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Allow NextAuth internal endpoints freely.
  if (path.startsWith("/api/auth")) return NextResponse.next();

  const isApi = path.startsWith("/api");

  // ✅ 0) Handle /auth/* first: disable cache + redirect away if already logged-in
  if (path.startsWith("/auth")) {
    const res = NextResponse.next();
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    // Check JWT from NextAuth
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      // Prefer role from token (set in `jwt` callback)
      let role = ((token as any).role as Role) ?? "user";

      // Fallback: if token has no role for some reason, ask our API
      if (!role || role === ("user" as Role)) {
        try {
          const meRes = await fetch(new URL("/api/auth/me", req.url), {
            headers: { cookie: req.headers.get("cookie") ?? "" },
            cache: "no-store",
          });
          if (meRes.ok) {
            const me = await meRes.json();
            role = (me?.user?.role as Role) ?? role;
          }
        } catch {}
      }

      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }

    // Not authenticated → allow /auth pages (but with no-store)
    return res;
  }

  // ---- Protected areas (same logic as before) ----
  const firstSeg = "/" + (path.split("/")[1] || "");
  const isProtected = firstSeg in AREA_ROLE || path.startsWith("/api");

  // 1) Auth check (NextAuth JWT)
  const sessionToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (isProtected && !sessionToken) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  if (!isProtected || !sessionToken) return NextResponse.next();

  // 2) Fetch user (role + permissions) from your own endpoint
  const meRes = await fetch(new URL("/api/auth/me", req.url), {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  const me: {
    user?: {
      id?: string;
      role?: string | null;
      permissions?: string[];
    } | null;
  } = await meRes.json();

  const role = (me?.user?.role as Role) ?? "user";
  const permissions = new Set(me?.user?.permissions ?? []);

  // 3) Enforce area-by-role
  const areaPrefix = firstSeg;
  const requiredRole = AREA_ROLE[areaPrefix as keyof typeof AREA_ROLE];
  if (requiredRole && role !== requiredRole) {
    return deny(req, isApi, roleHome(role));
  }

  // 4) OPTIONAL: permission-by-route
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (rule.re.test(path) && !permissions.has(rule.perm)) {
      return deny(req, isApi, roleHome(role));
    }
  }

  // 5) OK
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
