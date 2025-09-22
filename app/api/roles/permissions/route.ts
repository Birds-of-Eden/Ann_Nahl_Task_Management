// app/api/roles/permissions/route.ts

import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

function handleError(action: string, error: unknown) {
  console.error(`Error ${action}:`, error);
  return NextResponse.json(
    {
      success: false,
      error: `Failed ${action}`,
      message: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 }
  );
}

// PUT: Update role permissions  → permission: role.permissions.update
export const PUT = withAuth(
  async (req: NextRequest) => {
    try {
      const { roleId, permissions } = await req.json();
      if (!roleId || !Array.isArray(permissions)) {
        return NextResponse.json(
          {
            success: false,
            error: "Role ID and permissions array are required",
          },
          { status: 400 }
        );
      }

      await prisma.rolePermission.deleteMany({ where: { roleId } });

      if (permissions.length > 0) {
        const rolePermissions = permissions.map(
          (permissionId: string | number) => ({
            roleId,
            permissionId,
          })
        );
        await prisma.rolePermission.createMany({
          data: rolePermissions,
          skipDuplicates: true,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Role permissions updated successfully",
      });
    } catch (error) {
      return handleError("updating role permissions", error);
    }
  },
  { permissions: ["role.permissions.update"] }
);

// GET: Fetch role permissions  → permission: role.permissions.read
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const roleId = searchParams.get("roleId");

      if (!roleId) {
        return NextResponse.json(
          { success: false, error: "Role ID is required" },
          { status: 400 }
        );
      }

      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId },
        select: { permissionId: true },
      });

      const permissions = rolePermissions.map((rp) => rp.permissionId);
      return NextResponse.json({ success: true, data: permissions });
    } catch (error) {
      return handleError("fetching role permissions", error);
    }
  },
  { permissions: ["role.permissions.read"] }
);
