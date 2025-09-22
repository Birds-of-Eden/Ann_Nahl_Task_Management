// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Auth routes সবসময় allow
  if (path.startsWith("/api/auth") || path.startsWith("/auth")) {
    return NextResponse.next();
  }

  const isApi = path.startsWith("/api");
  // NextAuth-এর অফিসিয়াল টোকেন রিডার
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const protectedPage =
    path.startsWith("/admin") ||
    path.startsWith("/agent") ||
    path.startsWith("/manager") ||
    path.startsWith("/qc") ||
    path.startsWith("/am") ||
    path.startsWith("/am_ceo") ||
    path.startsWith("/client") ||
    path.startsWith("/data_entry");

  if ((isApi || protectedPage) && !token) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/auth/sign-in", req.url);
    // callbackUrl যোগ করলে sign-in শেষে user আবার আগের পেজে ফিরে আসবে
    url.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(url);
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
    "/auth/:path*", // auth pages allow করার জন্য
  ],
};
