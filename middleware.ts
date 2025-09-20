import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const isApi = p.startsWith("/api");
  const token = req.cookies.get("session-token")?.value;

  if (p.startsWith("/api/auth")) return NextResponse.next();

  const protectedPage =
    p.startsWith("/admin") ||
    p.startsWith("/agent") ||
    p.startsWith("/manager") ||
    p.startsWith("/qc") ||
    p.startsWith("/am") ||
    p.startsWith("/am_ceo") ||
    p.startsWith("/client") ||
    p.startsWith("/data_entry");

  if ((isApi || protectedPage) && !token) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", req.url));
  }
  return NextResponse.next();
}

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
  ],
};
