// app/api/role-permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// GET: List all role-permission mappings  → permission: rolePermission.read
export const GET = withAuth(
  async () => {
    try {
      const mappings = await prisma.rolePermission.findMany({
        include: {
          role: { select: { id: true, name: true } },
          permission: { select: { id: true, name: true, description: true } },
        },
      });

      return NextResponse.json({ success: true, data: mappings });
    } catch (error) {
      console.error("Error fetching role-permissions:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch role-permissions" },
        { status: 500 }
      );
    }
  },
  // 👇 এখানে পারমিশন গার্ড—admin/manager যদি ঢুকতে না পারে,
  // নিশ্চিত করুন seed-এ তাদের রোলে এই পারমিশন আছে।
  { permissions: ["rolePermission.read"] }
);

// POST: Assign a permission to a role  → permission: rolePermission.create
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const { roleId, permissionId } = await req.json();

      if (!roleId || !permissionId) {
        return NextResponse.json(
          { success: false, error: "roleId and permissionId are required" },
          { status: 400 }
        );
      }

      const mapping = await prisma.rolePermission.create({
        data: { roleId, permissionId },
      });

      return NextResponse.json({ success: true, data: mapping });
    } catch (error: any) {
      console.error("Error assigning role-permission:", error);
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Mapping already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to assign role-permission" },
        { status: 500 }
      );
    }
  },
  { permissions: ["rolePermission.create"] }
);
