// app/api/presence/heartbeat/route.ts

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    // First check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: (me as any).id },
    });

    if (!existingUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: (me as any).id },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    // Handle case where user doesn't exist or other database errors
    console.error("Error updating user lastSeenAt:", error);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
