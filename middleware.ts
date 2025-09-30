// // middleware.ts

// import { NextRequest, NextResponse } from "next/server";

// export function middleware(req: NextRequest) {
//   const p = req.nextUrl.pathname;
//   const isApi = p.startsWith("/api");
//   const token = req.cookies.get("session-token")?.value;

//   if (p.startsWith("/api/auth")) return NextResponse.next();

//   const protectedPage =
//     p.startsWith("/admin") ||
//     p.startsWith("/agent") ||
//     p.startsWith("/manager") ||
//     p.startsWith("/qc") ||
//     p.startsWith("/am") ||
//     p.startsWith("/am_ceo") ||
//     p.startsWith("/client") ||
//     p.startsWith("/data_entry");

//   if ((isApi || protectedPage) && !token) {
//     return isApi
//       ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
//       : NextResponse.redirect(new URL("/auth/sign-in", req.url));
//   }
//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     "/admin/:path*",
//     "/agent/:path*",
//     "/manager/:path*",
//     "/qc/:path*",
//     "/am/:path*",
//     "/am_ceo/:path*",
//     "/client/:path*",
//     "/data_entry/:path*",
//     "/api/:path*",
//   ],
// };

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

/**
 * If you later want to enforce permission-by-route (beyond just role/area),
 * fill this map. Each entry can match a concrete path or a regex.
 *
 * Example:
 *   { re: /^\/agent\/agent_tasks$/, perm: "view_agent_tasks" }
 *
 * Make sure the `perm` string matches your Permission.id used in the sidebar.
 */
const ROUTE_PERMISSION_RULES: { re: RegExp; perm: string }[] = [
  // --- Examples based on your sidebar; add as you need ---
  // { re: /^\/agent\/agent_tasks\/?$/, perm: "view_agent_tasks" },
  // { re: /^\/agent\/taskHistory\/?$/, perm: "view_agent_tasks_history" },
  // { re: /^\/agent\/social-activity\/?$/, perm: "view_social_activities" },
  // { re: /^\/qc\/qc-review\/?$/, perm: "view_qc_review" },
  // { re: /^\/:role\/tasks\/?$/, perm: "view_tasks_list" }, // don't use :role in regex—write concrete prefixes if needed
];

/** Which paths are considered protected (need auth). Keep your API here too. */
const PROTECTED_PREFIXES = [
  "/admin",
  "/agent",
  "/manager",
  "/qc",
  "/am",
  "/am_ceo",
  "/client",
  "/data_entry",
  "/api",
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
    "/auth/:path*", // auth pages allow করার জন্য
  ],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Allow NextAuth auth endpoints freely.
  if (path.startsWith("/api/auth")) return NextResponse.next();

  const isApi = path.startsWith("/api");

  const firstSeg = "/" + (path.split("/")[1] || "");
  const isProtected = firstSeg in AREA_ROLE || path.startsWith("/api");

  // 1) Auth check: use NextAuth JWT (works with `session: { strategy: "jwt" }`)
  const sessionToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (isProtected && !sessionToken) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }

  // If not protected or not authenticated, continue.
  if (!isProtected || !sessionToken) return NextResponse.next();

  // 2) Fetch user (role + permissions) from your existing endpoint.
  //    Pass cookies through so the endpoint can read the session.
  const meRes = await fetch(new URL("/api/auth/me", req.url), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
    },
    // Edge-safe; defaults are fine.
  });

  if (!meRes.ok) {
    // Could not resolve the session server-side; treat as unauthorized
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

  // 3) Enforce area-by-role (e.g., only 'agent' can open /agent/**)
  const areaPrefix = firstSeg; // exact area by first segment (no prefix collision)
  const requiredRole = AREA_ROLE[areaPrefix as keyof typeof AREA_ROLE];
  if (requiredRole && role !== requiredRole) {
    return deny(req, isApi, roleHome(role));
  }

  // 4) OPTIONAL: permission-by-route (fine-grained)
  //    If you add entries in ROUTE_PERMISSION_RULES, enforce them here.
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (rule.re.test(path)) {
      if (!permissions.has(rule.perm)) {
        return deny(req, isApi, roleHome(role));
      }
    }
  }

  // 5) Otherwise OK
  return NextResponse.next();
}

/** Get the first matched area prefix (e.g., '/agent' from '/agent/tasks/123') */
function firstAreaPrefix(path: string): string | null {
  const seg1 = "/" + (path.split("/")[1] || "");
  return Object.keys(AREA_ROLE).find((p) => path.startsWith(p)) ?? null;
}

/** Where to send a user if they’re blocked */
function roleHome(role: Role): string {
  // Mirrors your basePath mapping in the sidebar
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
