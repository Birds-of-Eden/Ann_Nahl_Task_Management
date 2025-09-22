// app/api/agents/assign-team/route.ts
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

// POST: assign agent to team → permission: agent.assign
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const {
        agentId,
        teamId,
        role = "Member",
        assignmentType = "template",
      } = await request.json();

      if (!agentId || !teamId) {
        return NextResponse.json(
          { message: "Agent ID and Team ID are required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // verify agent & team
      const [agent, team] = await Promise.all([
        prisma.user.findUnique({ where: { id: agentId } }),
        prisma.team.findUnique({ where: { id: teamId } }),
      ]);
      if (!agent)
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      if (!team)
        return NextResponse.json(
          { message: "Team not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );

      if (assignmentType === "client") {
        // need clientId for client assignment
        return NextResponse.json(
          { message: "Client team assignment requires clientId" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // template assignment
      let template = await prisma.template.findFirst();
      if (!template) {
        template = await prisma.template.create({
          data: {
            id: "default-template",
            name: "Default Template",
            description: "Default template for team assignments",
          },
        });
      }

      const exists = await prisma.templateTeamMember.findFirst({
        where: { agentId, teamId, templateId: template.id },
      });
      if (exists) {
        return NextResponse.json(
          { message: "Agent is already assigned to this team" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const teamMember = await prisma.templateTeamMember.create({
        data: {
          templateId: template.id,
          agentId,
          teamId,
          role,
          assignedDate: new Date(),
        },
        include: {
          agent: { select: { firstName: true, lastName: true, email: true } },
          team: { select: { name: true } },
        },
      });

      return NextResponse.json(
        {
          message: "Agent assigned to team successfully",
          assignment: teamMember,
        },
        { status: 201, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("POST /api/agents/assign-team error:", error);
      return NextResponse.json(
        { message: "Internal server error", error: error?.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.assign"] }
);

// DELETE: remove team assignment → permission: agent.assign
export const DELETE = withAuth(
  async (request: NextRequest) => {
    try {
      const {
        agentId,
        teamId,
        assignmentType = "template",
      } = await request.json();

      if (!agentId || !teamId) {
        return NextResponse.json(
          { message: "Agent ID and Team ID are required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      if (assignmentType === "client") {
        await prisma.clientTeamMember.deleteMany({
          where: { agentId, teamId },
        });
      } else {
        await prisma.templateTeamMember.deleteMany({
          where: { agentId, teamId },
        });
      }

      return NextResponse.json(
        { message: "Team assignment removed successfully" },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("DELETE /api/agents/assign-team error:", error);
      return NextResponse.json(
        { message: "Internal server error", error: error?.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.assign"] }
);

// PUT: upsert/update assignment → permission: agent.assign
export const PUT = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const {
        agentId,
        teamId,
        role = "Member",
        assignmentType = "template",
        templateId: bodyTemplateId, // optional
        clientId, // required if assignmentType === "client"
      }: {
        agentId: string;
        teamId?: string | null;
        role?: string;
        assignmentType?: "template" | "client";
        templateId?: string;
        clientId?: string;
      } = body;

      if (!agentId) {
        return NextResponse.json(
          { message: "Agent ID is required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      if (!teamId) {
        return NextResponse.json(
          { message: "Team ID is required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // verify agent & team
      const [agent, team] = await Promise.all([
        prisma.user.findUnique({ where: { id: agentId } }),
        prisma.team.findUnique({ where: { id: teamId } }),
      ]);
      if (!agent)
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      if (!team)
        return NextResponse.json(
          { message: "Team not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );

      if (assignmentType === "client") {
        if (!clientId) {
          return NextResponse.json(
            { message: "Client team assignment requires clientId" },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }

        const clientMember = await prisma.clientTeamMember.upsert({
          where: { clientId_agentId: { clientId, agentId } },
          update: { teamId, role, assignedDate: new Date() },
          create: { clientId, agentId, teamId, role, assignedDate: new Date() },
          select: {
            clientId: true,
            agentId: true,
            teamId: true,
            role: true,
            assignedDate: true,
            agent: { select: { firstName: true, lastName: true, email: true } },
            team: { select: { name: true } },
            client: { select: { id: true, name: true } },
          },
        });

        return NextResponse.json(
          {
            message: "Client team assignment updated successfully",
            assignment: clientMember,
          },
          { status: 200, headers: NO_STORE_HEADERS }
        );
      }

      // template path
      let templateId = bodyTemplateId ?? null;
      if (!templateId) {
        const first = await prisma.template.findFirst({ select: { id: true } });
        if (first) {
          templateId = first.id;
        } else {
          const created = await prisma.template.create({
            data: {
              id: "default-template",
              name: "Default Template",
              description: "Default template for team assignments",
            },
            select: { id: true },
          });
          templateId = created.id;
        }
      }

      const teamMember = await prisma.templateTeamMember.upsert({
        where: { templateId_agentId: { templateId, agentId } },
        update: { teamId, role, assignedDate: new Date() },
        create: { templateId, agentId, teamId, role, assignedDate: new Date() },
        include: {
          agent: { select: { firstName: true, lastName: true, email: true } },
          team: { select: { name: true } },
          template: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(
        {
          message: "Template team assignment updated successfully",
          assignment: teamMember,
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json(
          { message: "Assignment already exists. No changes made." },
          { status: 200, headers: NO_STORE_HEADERS }
        );
      }
      console.error("PUT /api/agents/assign-team error:", error);
      return NextResponse.json(
        {
          message: "Internal server error",
          error: error?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.assign"] }
);
