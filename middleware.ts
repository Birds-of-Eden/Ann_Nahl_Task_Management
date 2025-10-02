// middleware.ts
import { NextRequest, NextResponse } from "next/server";

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

/**
 * If you later want to enforce permission-by-route (beyond just role/area),
 * fill this map. Each entry can match a concrete path or a regex.
 */
const ROUTE_PERMISSION_RULES: { re: RegExp; perm: string }[] = [
  // examples:
  // { re: /^\/agent\/agent_tasks\/?$/, perm: "view_agent_tasks" },
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
    "/auth/:path*", // ✅ add auth routes so we can guard sign-in
  ],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Allow API auth endpoints freely.
  if (path.startsWith("/api/auth")) return NextResponse.next();

  const isApi = path.startsWith("/api");

  // ✅ Handle /auth/*: disable cache + redirect away if already logged in
  if (path.startsWith("/auth")) {
    const res = NextResponse.next();
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    const token = req.cookies.get("session-token")?.value;
    if (token) {
      // Ask our own API who the user is (role etc.)
      const meRes = await fetch(new URL("/api/auth/me", req.url), {
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        const role = (me?.user?.role as Role) ?? "user";
        return NextResponse.redirect(new URL(roleHome(role), req.url));
      }
    }
    return res; // not logged-in → show auth pages (with no-store)
  }

  // ---- Protected areas (your previous logic) ----
  const firstSeg = "/" + (path.split("/")[1] || "");
  const isProtected = firstSeg in AREA_ROLE || path.startsWith("/api");

  // 1) Auth check
  const token = req.cookies.get("session-token")?.value;
  if (isProtected && !token) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  if (!isProtected || !token) return NextResponse.next();

  // 2) Fetch user (role + permissions)
  const meRes = await fetch(new URL("/api/auth/me", req.url), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
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
      email?: string;
      name?: string | null;
    } | null;
    impersonation?: { isImpersonating: boolean } | null;
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
    if (rule.re.test(path)) {
      if (!permissions.has(rule.perm)) {
        return deny(req, isApi, roleHome(role));
      }
    }
  }

  // 5) OK
  return NextResponse.next();
}

/** Where to send a user if they’re blocked */
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

/** Return a 403 for API or redirect for pages */
function deny(req: NextRequest, isApi: boolean, fallback: string) {
  return isApi
    ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
    : NextResponse.redirect(new URL(fallback, req.url));
}
