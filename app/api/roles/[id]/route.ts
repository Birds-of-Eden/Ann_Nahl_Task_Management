// app/api/roles/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// GET: Get a single role by ID  → permission: role.read
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      const role = await prisma.role.findUnique({
        where: { id },
        include: {
          rolePermissions: { include: { permission: true } },
        },
      });

      if (!role) {
        return NextResponse.json(
          { success: false, error: "Role not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: role });
    } catch (error) {
      console.error("Error fetching role:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch role" },
        { status: 500 }
      );
    }
  },
  { permissions: ["role.read"] }
);

// PUT: Update an existing role  → permission: role.update
export const PUT = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { name, description } = await req.json();
      const { id } = params;

      const updatedRole = await prisma.role.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });

      return NextResponse.json({ success: true, data: updatedRole });
    } catch (error: any) {
      console.error("Error updating role:", error);
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Role name must be unique" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to update role" },
        { status: 500 }
      );
    }
  },
  { permissions: ["role.update"] }
);

// DELETE: Delete a role by ID  → permission: role.delete
export const DELETE = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { id } = params;
      await prisma.role.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: "Role deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting role:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete role" },
        { status: 500 }
      );
    }
  },
  { permissions: ["role.delete"] }
);
