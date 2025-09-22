// app/api/role-permissions/[roleId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// ছোট হেল্পার: roleId বা role name—দুইভাবেই role লোড করুন
async function findRoleByIdOrName(roleIdOrName: string) {
  // 1) exact id
  let role = await prisma.role.findUnique({
    where: { id: roleIdOrName },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  if (role) return role;

  // 2) case-insensitive name fallback (name ইউনিক ধরা হয়েছে)
  role = await prisma.role.findFirst({
    where: { name: { equals: roleIdOrName, mode: "insensitive" } },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  return role;
}

// GET: Get all permissions for a given role  → permission: rolePermission.read
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { roleId: string } }) => {
    try {
      const { roleId } = params;

      const role = await findRoleByIdOrName(roleId);
      if (!role) {
        return NextResponse.json(
          { success: false, error: "Role not found" },
          { status: 404 }
        );
      }

      const permissions = role.rolePermissions.map((rp) => rp.permission);
      return NextResponse.json({ success: true, role: role.name, permissions });
    } catch (error) {
      console.error("Error fetching permissions for role:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch permissions for role" },
        { status: 500 }
      );
    }
  },
  // 👉 যদি চান admin/manager সবসময় অ্যাক্সেস পাক, তাহলে এটা বদলে দিন:
  // { role: ["admin", "manager"] }
  { permissions: ["rolePermission.read"] }
);

// DELETE: Remove a specific permission from a role  → permission: rolePermission.delete
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: { roleId: string } }) => {
    try {
      const { permissionId } = await req.json();

      if (!permissionId) {
        return NextResponse.json(
          { success: false, error: "permissionId is required" },
          { status: 400 }
        );
      }

      // id বা name—যেটাই আসুক, আগে role বের করি
      const role = await findRoleByIdOrName(params.roleId);
      if (!role) {
        return NextResponse.json(
          { success: false, error: "Role not found" },
          { status: 404 }
        );
      }

      await prisma.rolePermission.delete({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Permission removed from role successfully",
      });
    } catch (error) {
      console.error("Error removing permission from role:", error);
      return NextResponse.json(
        { success: false, error: "Failed to remove permission from role" },
        { status: 500 }
      );
    }
  },
  { permissions: ["rolePermission.delete"] }
);
