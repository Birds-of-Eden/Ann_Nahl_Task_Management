// app/api/impersonate/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

function ip(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

async function currentSessionWithAuth(token: string | undefined) {
  if (!token) return null;
  return prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      },
    },
  });
}

// শুধুই HTTPS কুকি-সেটিং হেল্পার
function getIsSecure(req: NextRequest) {
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (req as any).nextUrl?.protocol?.replace(":", "") ??
    "http";
  return proto === "https";
}

export async function POST(req: NextRequest) {
  try {
    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 }
      );
    }

    // যে-ই হোক, আগে authenticate হতে হবে
    const originToken = req.cookies.get("session-token")?.value;
    const originSession = await currentSessionWithAuth(originToken);

    if (!originSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (originSession.userId === targetUserId) {
      return NextResponse.json(
        { error: "You are already this user" },
        { status: 400 }
      );
    }

    // টার্গেট ইউজার অবশ্যই CLIENT হতে হবে
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }
    if ((targetUser.role?.name || "").toLowerCase() !== "client") {
      return NextResponse.json(
        { error: "Only client users can be impersonated" },
        { status: 403 }
      );
    }

    // নতুন impersonated সেশন
    const impersonatedToken = randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3h

    await prisma.session.create({
      data: {
        token: impersonatedToken,
        userId: targetUser.id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: ip(req),
        userAgent: req.headers.get("user-agent") ?? null,
        impersonatedBy: originSession.userId, // কে impersonate শুরু করেছে
      },
    });

    // অডিট
    await prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "auth",
        entityId: targetUser.id,
        userId: originSession.userId,
        action: "impersonate_start",
        details: { targetUserId: targetUser.id },
      },
    });

    // কুকি সেট: origin টোকেন আলাদাভাবে রেখে দিচ্ছি, আর session-token-এ client-user টোকেন
    const res = NextResponse.json(
      {
        success: true,
        message: `Now impersonating ${targetUser.email || targetUser.id}`,
        actingUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
        },
      },
      { status: 200 }
    );

    const isSecure = getIsSecure(req);

    res.cookies.set("impersonation-origin", originToken!, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 3 * 60 * 60,
    });

    res.cookies.set("session-token", impersonatedToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 3 * 60 * 60,
    });

    return res;
  } catch (e) {
    console.error("impersonate/start error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
