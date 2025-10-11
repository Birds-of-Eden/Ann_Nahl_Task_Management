// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";

export async function GET() {
  try {
    const actingUser: any = await getAuthUser();
    const store = await cookies();
    const originId = store.get("impersonation-origin")?.value || null;
    const targetId = store.get("impersonation-target")?.value || null;

    const basePayload = {
      user: actingUser
        ? {
            id: actingUser.id,
            name: actingUser.name ?? null,
            email: actingUser.email ?? null,
            image: actingUser.image ?? null,
            role: actingUser.role ?? null,
            roleId: actingUser.roleId ?? null,
            clientId: actingUser.clientId ?? null,
            permissions: actingUser.permissions ?? [],
          }
        : null,
      impersonation: {
        isImpersonating: !!(
          originId &&
          targetId &&
          actingUser?.__impersonating
        ),
        realAdmin: null as null | {
          id: string;
          name: string | null;
          email: string | null;
        },
      },
    };

    let payload = basePayload;

    if (basePayload.impersonation.isImpersonating && originId) {
      const admin = await prisma.user.findUnique({
        where: { id: originId },
        select: { id: true, name: true, email: true },
      });
      payload = {
        ...basePayload,
        impersonation: {
          ...basePayload.impersonation,
          realAdmin: admin
            ? {
                id: admin.id,
                name: admin.name ?? null,
                email: admin.email ?? null,
              }
            : null,
        },
      };
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (e) {
    console.error("/api/auth/me error:", e);
    return NextResponse.json(
      { user: null, impersonation: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}
