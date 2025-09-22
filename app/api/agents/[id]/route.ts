// app/api/agents/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

export const dynamic = "force-dynamic";

// PUT: update one agent by ID → permission: agent.update
export const PUT = withAuth(
  async (request: NextRequest) => {
    try {
      const updatedAgentData = await request.json();

      if (!updatedAgentData.id) {
        return NextResponse.json(
          { message: "Missing agent ID" },
          { status: 400 }
        );
      }

      const updatedAgent = await prisma.user.update({
        where: { id: updatedAgentData.id },
        data: {
          firstName: updatedAgentData.firstName,
          lastName: updatedAgentData.lastName,
          email: updatedAgentData.email,
          phone: updatedAgentData.phone ?? null,
          category: updatedAgentData.category,
          address: updatedAgentData.address ?? null,
          biography: updatedAgentData.bio ?? null,
          status: updatedAgentData.status === "active" ? "active" : "inactive",
          name: `${updatedAgentData.firstName ?? ""} ${
            updatedAgentData.lastName ?? ""
          }`.trim(),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          category: true,
          address: true,
          biography: true,
          status: true,
          createdAt: true,
        },
      });

      return NextResponse.json(
        {
          message: "Agent updated successfully",
          agent: {
            ...updatedAgent,
            bio: updatedAgent.biography,
            status: String(updatedAgent.status).toLowerCase(),
            createdAt: updatedAgent.createdAt.toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("Error in PUT /api/agents/[id]:", error);
      if (error?.code === "P2025") {
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { permissions: ["agent.update"] }
);
