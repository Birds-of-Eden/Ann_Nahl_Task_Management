// app/api/auth/sign-in/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: { where: { providerId: "credentials" } },
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });

    if (!user || user.accounts.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const account = user.accounts[0];
    const isPasswordValid = await bcrypt.compare(password, account.password ?? "");
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // session তৈরি
    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress,
        userAgent,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const permissions = user.role?.rolePermissions.map((rp) => rp.permission.name) || [];
    const roleName = user.role?.name ?? null;

    const isHttps = req.nextUrl.protocol === "https:";
    const res = NextResponse.json(
      {
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: roleName,
          permissions,
        },
      },
      { status: 200 }
    );

    res.cookies.set("session-token", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    // ✅ মিনিমাল: এখানেই activityLog তৈরি করি (API কল ছাড়াই)
    try {
      const log = await prisma.activityLog.create({
        data: {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          entityType: "Auth",
          entityId: user.id,
          userId: user.id,
          action: "sign_in",
          details: {
            email: user.email,
            role: roleName,
            permissions,
            ipAddress,
            userAgent,
          },
        },
      });
      console.log("🔍 Activity log created:", log.id);
    } catch (e) {
      console.error("❌ Failed to create activity log:", e);
    }

    return res;
  } catch (error) {
    console.error("❌ Login error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
