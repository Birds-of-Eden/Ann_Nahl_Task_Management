// app/api/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// GET: Paginated activity logs  → permission: activity.read
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);

      const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
      const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const limitUncapped =
        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;
      const limit = Math.min(limitUncapped, 100); // cap
      const q = (searchParams.get("q") || "").trim();
      const action = (searchParams.get("action") || "").trim();

      const skip = (page - 1) * limit;

      // where clause
      const where: any = {};
      if (action && action !== "all") {
        where.action = action;
      }
      if (q) {
        where.OR = [
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          // relation filters (user)
          { user: { is: { name: { contains: q, mode: "insensitive" } } } },
          { user: { is: { email: { contains: q, mode: "insensitive" } } } },
        ];
      }

      const [totalCount, logs] = await Promise.all([
        prisma.activityLog.count({ where }),
        prisma.activityLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          include: { user: { select: { id: true, name: true, email: true } } },
          skip,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return NextResponse.json(
        {
          success: true,
          logs,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit,
          },
        },
        { headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("GET /api/activity error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch activity logs",
          message: error?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["activity.read"] }
);
