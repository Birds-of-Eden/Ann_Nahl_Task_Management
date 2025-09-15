// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

export async function GET(req: NextRequest) {
  try {
    // 1) Read session token from cookies
    const token = req.cookies.get("session-token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          user: null,
          impersonation: { isImpersonating: false, realAdmin: null },
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    // 2) Lookup session and user (with role + permissions)
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    // 3) Expired / invalid session ⇒ treat as logged out
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        {
          user: null,
          impersonation: { isImpersonating: false, realAdmin: null },
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    const user = session.user;

    // Collect permission IDs (preferred for internal checks)
    const permissionIds =
      user.role?.rolePermissions.map((rp) => rp.permission.id) ?? [];

    // (Optional) Also collect names if you need them elsewhere
    // const permissionNames =
    //   user.role?.rolePermissions.map((rp) => rp.permission.name) ?? [];

    // 4) If impersonating, fetch minimal info of the real admin who started it
    let realAdmin: { id: string; name: string | null; email: string } | null =
      null;

    if (session.impersonatedBy) {
      const admin = await prisma.user.findUnique({
        where: { id: session.impersonatedBy },
        select: { id: true, name: true, email: true },
      });
      if (admin) realAdmin = admin;
    }

    // 5) Shape the response
    const payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name ?? null, // e.g. 'admin', 'agent', ...
        permissions: permissionIds, // keep it compact; names available if needed
      },
      impersonation: {
        isImpersonating: !!session.impersonatedBy,
        realAdmin,
      },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("❌ /api/auth/me error:", error);
    return NextResponse.json(
      {
        user: null,
        impersonation: { isImpersonating: false, realAdmin: null },
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
