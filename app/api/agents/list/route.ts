// app/api/agents/list/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

export const dynamic = "force-dynamic";

// GET: lightweight agent list (id, name, email, image) → permission: agent.read
export const GET = withAuth(
  async () => {
    try {
      const agents = await prisma.user.findMany({
        where: { role: { is: { name: "agent" } } }, // no hardcoded roleId
        select: { id: true, name: true, email: true, image: true },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(agents, { status: 200 });
    } catch (error: any) {
      console.error("Error fetching agents:", error);
      return NextResponse.json(
        { message: "Failed to fetch agents", error: error?.message },
        { status: 500 }
      );
    }
  },
  { permissions: ["agent.read"] }
);
