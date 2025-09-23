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

function hasImpersonatePermission(
  session: Awaited<ReturnType<typeof currentSessionWithAuth>>
) {
  if (!session?.user) return false;
  const roleName = session.user.role?.name?.toLowerCase();
  if (roleName === "admin" || roleName === "am") return true; // allow AM
  const perms =
    session.user.role?.rolePermissions.map((rp) => rp.permission.name) || [];
  return perms.includes("user_impersonate");
}

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

    const adminToken = req.cookies.get("session-token")?.value;
    const adminSession = await currentSessionWithAuth(adminToken);

    if (!adminSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!hasImpersonatePermission(adminSession)) {
      return NextResponse.json(
        { error: "Not allowed to impersonate" },
        { status: 403 }
      );
    }
    if (adminSession.userId === targetUserId) {
      return NextResponse.json(
        { error: "You are already this user" },
        { status: 400 }
      );
    }

    // target user (need role + clientId)
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

    // AM scope guard: AM can only impersonate their own Client users
    const actorRole = adminSession.user.role?.name?.toLowerCase();
    if (actorRole === "am") {
      if (targetUser.role?.name?.toLowerCase() !== "client") {
        return NextResponse.json(
          { error: "AM can only impersonate client users" },
          { status: 403 }
        );
      }
      if (!targetUser.clientId) {
        return NextResponse.json(
          { error: "Target client link missing" },
          { status: 403 }
        );
      }
      const client = await prisma.client.findUnique({
        where: { id: targetUser.clientId },
        select: { amId: true },
      });
      if (!client || String(client.amId) !== String(adminSession.userId)) {
        return NextResponse.json({ error: "Not your client" }, { status: 403 });
      }
    }

    const impersonatedToken = randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        token: impersonatedToken,
        userId: targetUser.id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: ip(req),
        userAgent: req.headers.get("user-agent") ?? null,
        impersonatedBy: adminSession.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        id: randomUUID(),
        entityType: "auth",
        entityId: targetUser.id,
        userId: adminSession.userId,
        action: "impersonate_start",
        details: { targetUserId: targetUser.id },
      },
    });

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

    res.cookies.set("impersonation-origin", adminToken!, {
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
