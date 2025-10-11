// app/api/impersonate/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  // ✅ admin, am, am_ceo—তিনজনই impersonate করতে পারে
  if (roleName === "admin" || roleName === "am" || roleName === "am_ceo") {
    return true;
  }

  // বিকল্প: rolePermissions-এ user_impersonate থাকলে allow
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

    // ✅ NextAuth-এর বর্তমান সেশন (অ্যাডমিন/AM/ইত্যাদি)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const actorUserId = session.user.id;

    // ✅ পারমিশন চেক
    const perm = await canImpersonate(actorUserId);
    if (!perm.ok) {
      return NextResponse.json(
        { error: "Not allowed to impersonate" },
        { status: 403 }
      );
    }

    // ✅ AM-স্কোপ গার্ড (যদি actor AM হয়)
    if (perm.roleName === "am") {
      const scope = await amScopeCheck(actorUserId, targetUserId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.reason }, { status: 403 });
      }
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const actorRole = adminSession.user.role?.name?.toLowerCase() ?? "";
    const targetRole = targetUser.role?.name?.toLowerCase() ?? "";

    // HARD GUARD: only admins can impersonate admins
    if (targetRole === "admin" && actorRole !== "admin") {
      return NextResponse.json(
        { error: "Only admins can impersonate admin users" },
        { status: 403 }
      );
    }

    // ✅ Scope guards
    if (actorRole === "am") {
      // AM: শুধুমাত্র নিজের client impersonate করতে পারবে
      if (targetRole !== "client") {
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
    } else if (actorRole === "am_ceo") {
      // AM CEO: যেকোনো client impersonate করতে পারবে (ownership check নেই)
      if (targetRole !== "client") {
        return NextResponse.json(
          { error: "AM CEO can only impersonate client users" },
          { status: 403 }
        );
      }
      if (!targetUser.clientId) {
        // চাইলে এটাও স্কিপ করা যায়; এখানে রেখেছি data integrity এর জন্য
        return NextResponse.json(
          { error: "Target client link missing" },
          { status: 403 }
        );
      }
      // ⛔ কোনো amId মালিকানা চেক নেই — AM CEO সব client impersonate করতে পারবে
    }
    // admin: কোনো client scope সীমাবদ্ধতা নেই (উপরে admin=>admin guard ছাড়া)

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
        entityId: target.id,
        userId: actorUserId,
        action: "impersonate_start",
        details: { targetUserId: target.id },
      },
    });

    // ✅ ৩ ঘন্টার জন্য ইমপারসোনেশন কুকি সেট
    const res = NextResponse.json(
      {
        success: true,
        message: `Now impersonating ${target.email || target.id}`,
        actingUser: { id: target.id, name: target.name, email: target.email },
      },
      { status: 200 }
    );

    const secure = isSecure(req);
    const maxAge = 3 * 60 * 60;

    // অরিজিনাল ইউজার সংরক্ষণ (UI/স্টপের জন্য দরকার)
    res.cookies.set("impersonation-origin", session.user.id, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // টার্গেট ইউজার সেট
    res.cookies.set("impersonation-target", target.id, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return res;
  } catch (e) {
    console.error("impersonate/start error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
