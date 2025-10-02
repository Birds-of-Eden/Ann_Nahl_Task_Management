// app/api/auth/get-session/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session-token")?.value;

    if (!token) {
      return NextResponse.json(
        { user: null },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: { include: { role: true } },
      },
    });

    if (!session || new Date() > session.expiresAt) {
      return NextResponse.json(
        { user: null },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const user = session.user;

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          role: user.role?.name ?? null,
          roleId: user.roleId,
          clientId: user.clientId ?? null,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error("get-session error:", e);
    return NextResponse.json(
      { user: null },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
