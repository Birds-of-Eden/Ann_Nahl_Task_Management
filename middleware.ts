// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // allow next internals & static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    /\.[a-zA-Z0-9]+$/.test(pathname) // e.g. .png, .js, .css
  ) {
    return NextResponse.next();
  }

  // allow auth endpoints/pages
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isApi = pathname.startsWith("/api");

  if (!token) {
    // Block APIs with 401
    if (isApi) {
      return new NextResponse(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Redirect pages to sign-in with callback
    const signInUrl = new URL("/auth/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  // (ঐচ্ছিক) Role gating: যদি JWT-এ role ক্যাশ করে থাকেন
  // const role = String((token as any).role || "").toLowerCase();
  // if (pathname.startsWith("/admin") && role !== "admin") {
  //   return NextResponse.redirect(new URL("/auth/sign-in", req.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // ✅ শুধু যেগুলো প্রোটেক্টেড—সেগুলোই ম্যাচ করান
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
