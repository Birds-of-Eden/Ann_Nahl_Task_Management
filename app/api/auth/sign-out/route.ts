// app/api/auth/sign-out/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const isHttps = req.nextUrl.protocol === "https:"; // ✅ http হলে false
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session-token")?.value;
    const originToken = cookieStore.get("impersonation-origin")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: "No active session found" },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      select: { userId: true, impersonatedBy: true, expiresAt: true },
    });

    // যদি ইমপারসোনেটেড সেশন হয়, তাহলে stop করে origin এ ফেরত যান
    if (session?.impersonatedBy && originToken) {
      // ✅ Activity Log (impersonation end) — delete করার আগেই লগ করি
      try {
        await prisma.activityLog.create({
          data: {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            entityType: "Auth",
            entityId: session.userId || "anonymous",
            userId: session.userId || undefined,
            action: "sign_out",
            details: {
              impersonation: true,
              endedBy: session.impersonatedBy,
            },
          },
        });
        console.log("🔍 Activity log created: sign_out (impersonation)");
      } catch (e) {
        console.error("❌ Failed to create activity log (impersonation):", e);
      }

      const res = NextResponse.json(
        {
          success: true,
          message: "Ended impersonation and restored original session",
        },
        { status: 200 }
      );

      // বর্তমান টোকেন ডিলিট
      await prisma.session.deleteMany({ where: { token: sessionToken } });

      // origin টোকেন valid হলে restore, না হলে clear
      const originValid = await prisma.session.findUnique({
        where: { token: originToken },
      });

      if (originValid) {
        res.cookies.set("session-token", originToken, {
          httpOnly: true,
          secure: isHttps, // ✅
          sameSite: "lax",
          path: "/",
          maxAge: Math.max(
            1,
            Math.floor((+originValid.expiresAt - Date.now()) / 1000)
          ),
        });
      } else {
        res.cookies.set("session-token", "", {
          httpOnly: true,
          secure: isHttps, // ✅
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }

      res.cookies.set("impersonation-origin", "", {
        httpOnly: true,
        secure: isHttps, // ✅
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return res;
    }

    // নরমাল sign-out
    if (session?.userId) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { lastSeenAt: new Date() },
      });

      // ✅ Activity Log (normal sign_out) — delete করার আগেই লগ করি
      try {
        await prisma.activityLog.create({
          data: {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            entityType: "Auth",
            entityId: session.userId,
            userId: session.userId,
            action: "sign_out",
            details: {
              impersonation: false,
            },
          },
        });
        console.log("🔍 Activity log created: sign_out");
      } catch (e) {
        console.error("❌ Failed to create activity log:", e);
      }
    }

    await prisma.session.deleteMany({ where: { token: sessionToken } });

    const res = NextResponse.json(
      { success: true, message: "Signed out successfully" },
      { status: 200 }
    );

    res.cookies.set("session-token", "", {
      httpOnly: true,
      secure: isHttps, // ✅
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("impersonation-origin", "", {
      httpOnly: true,
      secure: isHttps, // ✅
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("❌ Sign-out error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong during sign-out" },
      { status: 500 }
    );
  }
}
