// app/api/tasks/history/[agentId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 0;              // ✅ disable ISR caching
export const dynamic = "force-dynamic";   // ✅ force dynamic on route

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await ctx.params;
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    const dateField = url.searchParams.get("date") === "created" ? "createdAt" : "updatedAt";

    const statusParam = (url.searchParams.get("status") || "qc_approved,completed")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const allowed = new Set(["qc_approved", "completed"]);
    const statuses = statusParam.filter((s) => allowed.has(s));
    const statusIn = statuses.length ? statuses : ["qc_approved", "completed"];

    const q = url.searchParams.get("q") ?? url.searchParams.get("name") ?? "";

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: agentId,
        status: { in: statusIn as any[] },
        ...(q
          ? {
              name: {
                contains: q,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: { [dateField]: "desc" as const },
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        client: { select: { name: true } },
        performanceRating: true,
        idealDurationMinutes: true,
        actualDurationMinutes: true,
        qcTotalScore: true,            // ✅ ensure it's selected
      },
    });

    const toNum = (v: unknown) =>
      v == null
        ? null
        : typeof v === "object" && v !== null && "toNumber" in (v as any)
        ? (v as any).toNumber()
        : (typeof v === "number" ? v : Number(v));

    const rows = tasks.map((t) => ({
      id: String(t.id),
      name: t.name ?? "(Untitled Task)",
      clientName: t.client?.name ?? "-",
      status: String(t.status),
      date: (dateField === "createdAt" ? t.createdAt : t.updatedAt).toISOString(),
      performanceRating: t.performanceRating ?? null,          // enum/string রাখলাম যেমন আছে
      idealDurationMinutes: toNum(t.idealDurationMinutes),
      actualDurationMinutes: toNum(t.actualDurationMinutes),
      qcTotalScore: toNum(t.qcTotalScore),                     // ✅ always present (null if missing)
    }));

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store" },               // ✅ avoid fetch() cache
    });
  } catch (e: any) {
    console.error("QC history error:", e);
    return NextResponse.json(
      { error: "Failed to fetch task history", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
