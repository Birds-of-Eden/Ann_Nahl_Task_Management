// app/api/impersonate/stop/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

function isSecure(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req as any).nextUrl?.protocol?.replace(":", "") ??
    "http";
  return proto === "https";
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const targetId = req.cookies.get("impersonation-target")?.value || null;
    const originId = req.cookies.get("impersonation-origin")?.value || null;

    if (!targetId || !originId) {
      return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
    }

    // অডিট লগ (actor = originId)
    await prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "auth",
        entityId: targetId,
        userId: originId,
        action: "impersonate_stop",
        details: {},
      },
    });

    const res = NextResponse.json(
      { success: true, message: "Impersonation ended" },
      { status: 200 }
    );

    const secure = isSecure(req);

    // কুকি ক্লিয়ার
    res.cookies.set("impersonation-target", "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("impersonation-origin", "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e) {
    console.error("impersonate/stop error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
