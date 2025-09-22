// app/api/agents/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// GET: list agents  → permission: agent.read
export const GET = withAuth(
  async () => {
    try {
      const agents = await prisma.user.findMany({
        where: {
          // agent role
          role: { is: { name: "agent" } },
          // optional legacy flag: category not null
          category: { not: null },
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
          image: true,
          role: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const transformed = agents.map((a) => ({
        id: a.id,
        firstName: a.firstName || "",
        lastName: a.lastName || "",
        email: a.email,
        phone: a.phone || "",
        category: a.category || "",
        address: a.address || "",
        bio: a.biography || "",
        status: String(a.status).toLowerCase(),
        createdAt: a.createdAt.toISOString(),
        image: a.image,
        role: a.role?.name,
      }));

      return NextResponse.json(transformed, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    } catch (error) {
      console.error("Error in GET /api/agents:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.read"] }
);

// POST: create agent  → permission: agent.create
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const {
        firstName,
        lastName,
        email,
        password,
        teamId,
        phone,
        address,
        bio,
        status,
      } = body || {};

      if (!firstName || !lastName || !email || !password || !teamId) {
        return NextResponse.json(
          { message: "Missing required fields" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // unique email
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return NextResponse.json(
          { message: "Email already exists" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // team check
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        return NextResponse.json(
          { message: "Selected team not found" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // role: agent
      const agentRole = await prisma.role.findUnique({
        where: { name: "agent" },
      });
      if (!agentRole) {
        return NextResponse.json(
          { message: "Agent role not found in DB. Please seed roles first." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      // hash
      const passwordHash = await bcrypt.hash(password, 10);

      const newAgent = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash,
          phone: phone || null,
          category: team.name, // legacy mapping
          address: address || null,
          biography: bio || null,
          status: status === "active" ? "active" : "inactive",
          emailVerified: false,
          name: `${firstName} ${lastName}`,
          roleId: agentRole.id,
          accounts: {
            create: {
              providerId: "credentials",
              accountId: email,
              password: passwordHash,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
        include: {
          role: { select: { id: true, name: true } },
          accounts: true,
        },
      });

      return NextResponse.json(
        {
          message: "Agent created successfully",
          agent: {
            id: newAgent.id,
            firstName: newAgent.firstName,
            lastName: newAgent.lastName,
            email: newAgent.email,
            phone: newAgent.phone,
            category: newAgent.category,
            address: newAgent.address,
            bio: newAgent.biography,
            status: String(newAgent.status).toLowerCase(),
            createdAt: newAgent.createdAt.toISOString(),
            teamId,
            teamName: team.name,
            role: newAgent.role?.name,
          },
        },
        { status: 201, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("Error in POST /api/agents:", error);
      return NextResponse.json(
        { message: "Internal server error", error: error?.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.create"] }
);

// DELETE: delete agent  → permission: agent.delete
export const DELETE = withAuth(
  async (request: NextRequest) => {
    try {
      const { id } = await request.json();
      if (!id) {
        return NextResponse.json(
          { message: "Missing agent ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // detach from teams (best-effort)
      await prisma.clientTeamMember
        .deleteMany({ where: { agentId: id } })
        .catch(() => {});
      await prisma.templateTeamMember
        .deleteMany({ where: { agentId: id } })
        .catch(() => {});

      const deleted = await prisma.user
        .delete({ where: { id } })
        .catch((e: any) => {
          if (e?.code === "P2025") return null;
          throw e;
        });

      if (!deleted) {
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(
        { message: "Agent deleted successfully" },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("Error in DELETE /api/agents:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.delete"] }
);

// PUT: update agent (full/partial)  → permission: agent.update
export const PUT = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const {
        id,
        firstName,
        lastName,
        email,
        phone,
        address,
        biography,
        bio,
        status,
        teamId,
        password,
      } = body || {};

      if (!id) {
        return NextResponse.json(
          { message: "Missing agent ID" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      if (email && email !== existing.email) {
        const emailTaken = await prisma.user.findUnique({ where: { email } });
        if (emailTaken) {
          return NextResponse.json(
            { message: "Email already exists" },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
      }

      // map team -> category
      let categoryUpdate: string | undefined;
      if (teamId) {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
          return NextResponse.json(
            { message: "Selected team not found" },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
        categoryUpdate = team.name;
      }

      // optional password update
      let passwordHashUpdate: string | undefined;
      if (typeof password === "string" && password.trim()) {
        passwordHashUpdate = await bcrypt.hash(password, 10);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          firstName,
          lastName,
          email,
          phone: phone ?? null,
          address: address ?? null,
          biography: biography ?? bio ?? null,
          status: status === "active" ? "active" : "inactive",
          name: `${firstName ?? existing.firstName ?? ""} ${
            lastName ?? existing.lastName ?? ""
          }`.trim(),
          ...(categoryUpdate ? { category: categoryUpdate } : {}),
          ...(passwordHashUpdate ? { passwordHash: passwordHashUpdate } : {}),
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
            ...updated,
            bio: updated.biography,
            status: String(updated.status).toLowerCase(),
            createdAt: updated.createdAt.toISOString(),
            teamId,
          },
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    } catch (error: any) {
      console.error("Error in PUT /api/agents:", error);
      if (error?.code === "P2025") {
        return NextResponse.json(
          { message: "Agent not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
      return NextResponse.json(
        { message: "Internal server error", error: error?.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["agent.update"] }
);
