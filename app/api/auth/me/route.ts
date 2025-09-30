// app/api/auth/me/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // session.userেই role, roleId, clientId, permissions আছে (callbacks থেকে)
    return NextResponse.json(
      { user: session?.user ?? null },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error("GET /api/auth/me error:", e);
    return NextResponse.json(
      { user: null },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
