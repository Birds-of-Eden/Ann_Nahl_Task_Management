// app/api/roles/route.ts

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

// GET: List all roles  → permission: role.read
export const GET = withAuth(
  async (_req: NextRequest) => {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { users: true } } },
      });
      return NextResponse.json({ success: true, data: roles });
    } catch (error) {
      console.error("Error listing roles:", error);
      return NextResponse.json(
        { success: false, error: "Failed to list roles" },
        { status: 500 }
      );
    }
  },
  { permissions: ["role.read"] }
);

// POST: Create a new role  → permission: role.create
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const { name, description } = await req.json();

      if (!name || typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { success: false, error: "name is required" },
          { status: 400 }
        );
      }

      const created = await prisma.role.create({
        data: {
          id: randomUUID(),
          name: name.trim(),
          description: description ?? null,
        },
      });

      return NextResponse.json(
        { success: true, data: created },
        { status: 201 }
      );
    } catch (error: any) {
      console.error("Error creating role:", error);
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "Role name must be unique" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to create role" },
        { status: 500 }
      );
    }
  },
  { permissions: ["role.create"] }
);
