// app/api/permissions/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// GET: Get a single permission by ID  → permission: permission.read
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const permission = await prisma.permission.findUnique({ where: { id } });

      if (!permission) {
        return NextResponse.json(
          { success: false, error: "Permission not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: permission });
    } catch (error) {
      console.error("Error fetching permission:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch permission" },
        { status: 500 }
      );
    }
  },
  { permissions: ["permission.read"] }
);

// PUT: Update a permission by ID  → permission: permission.update
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { name, description } = await req.json();
      const { id } = params;

      const updated = await prisma.permission.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Error updating permission:", error);
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Permission name must be unique" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to update permission" },
        { status: 500 }
      );
    }
  },
  { permissions: ["permission.update"] }
);

// DELETE: Delete a permission by ID  → permission: permission.delete
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      await prisma.permission.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: "Permission deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting permission:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete permission" },
        { status: 500 }
      );
    }
  },
  { permissions: ["permission.delete"] }
);
