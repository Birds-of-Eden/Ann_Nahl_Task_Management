// app/api/permissions/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// GET: Fetch all permissions  → permission: permission.read
export const GET = withAuth(
  async () => {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ success: true, data: permissions });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch permissions" },
        { status: 500 }
      );
    }
  },
  { permissions: ["permission.read"] }
);

// POST: Create a new permission  → permission.create
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const { id, name, description } = await req.json();

      if (!id || !name) {
        return NextResponse.json(
          { success: false, error: "id and name are required" },
          { status: 400 }
        );
      }

      const newPermission = await prisma.permission.create({
        data: { id, name, description },
      });

      return NextResponse.json(
        { success: true, data: newPermission },
        { status: 201 }
      );
    } catch (error: any) {
      console.error("Error creating permission:", error);
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Permission id or name must be unique" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to create permission" },
        { status: 500 }
      );
    }
  },
  { permissions: ["permission.create"] }
);
