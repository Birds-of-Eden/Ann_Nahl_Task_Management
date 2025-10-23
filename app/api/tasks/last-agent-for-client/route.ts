import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the last agent (assignedTo) who completed a task in Blog Posting or Social Activity for a client
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) {
      return NextResponse.json({ message: "clientId is required" }, { status: 400 });
    }

    // Category names to search
    const CAT_BLOG_POSTING = "Blog Posting";
    const CAT_SOCIAL_ACTIVITY = "Social Activity";

    const last = await prisma.task.findFirst({
      where: {
        clientId,
        assignedToId: { not: null },
        status: "completed",
        category: { name: { in: [CAT_BLOG_POSTING, CAT_SOCIAL_ACTIVITY] } },
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        assignedTo: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        id: true,
        name: true,
        completedAt: true,
      },
    });

    if (!last?.assignedTo) {
      return NextResponse.json({ agent: null }, { status: 200 });
    }

    return NextResponse.json({ agent: last.assignedTo }, { status: 200 });
  } catch (err: any) {
    console.error("[last-agent-for-client] ERROR", err);
    return NextResponse.json({ message: err?.message || "Internal Error" }, { status: 500 });
  }
}
