// app/api/assignments/[id]/route.ts
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

// ✅ GET /api/assignments/[id]  → permission: assignment.read
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      if (!id) {
        return NextResponse.json(
          { error: "Missing ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const assignment = await prisma.assignment.findUnique({
        where: { id },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
              templateTeamMembers: {
                include: {
                  agent: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
              },
            },
          },
          tasks: {
            include: {
              assignedTo: true,
              // চাইলে category/templateSiteAsset-ও ফেরত নিতে পারেন:
              // category: true,
              // templateSiteAsset: true,
            },
            orderBy: { createdAt: "desc" },
          },
          // যদি settings দরকার হয়:
          // siteAssetSettings: true,
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: "Assignment not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(assignment, { headers: NO_STORE_HEADERS });
    } catch (error: any) {
      console.error("GET /api/assignments/[id] error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch assignment",
          message: error?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["assignment.read"] }
);

// ✅ DELETE /api/assignments/[id]  → permission: assignment.delete
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      if (!id) {
        return NextResponse.json(
          { error: "Missing ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // সম্পর্কিত রেকর্ডগুলো ক্লিনআপ (যদি schema-তে cascade না থাকে)
      await prisma.$transaction([
        prisma.task.deleteMany({ where: { assignmentId: id } }),
        prisma.assignmentSiteAssetSetting?.deleteMany
          ? prisma.assignmentSiteAssetSetting.deleteMany({
              where: { assignmentId: id },
            })
          : prisma.$executeRaw`SELECT 1`, // যদি টেবিল না থাকে, নো-অপ
      ]);

      // মেইন অ্যাসাইনমেন্ট ডিলিট
      await prisma.assignment.delete({ where: { id } });

      return NextResponse.json(
        { success: true, message: "Assignment deleted" },
        { headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      // P2025 = not found
      if (error?.code === "P2025") {
        return NextResponse.json(
          { error: "Assignment not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
      console.error("DELETE /api/assignments/[id] error:", error);
      return NextResponse.json(
        {
          error: "Failed to delete assignment",
          message: error?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["assignment.delete"] }
);
