// app/api/chat/team/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// POST /api/chat/team  → নতুন/এক্সিস্টিং টিম কনভারসেশন ওপেন
// permission: chat.team.open  (আপনার পারমিশন সিডে এই নামে রাখুন)
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const me = session?.user as any | null;
      if (!me?.id) {
        return NextResponse.json(
          { message: "Unauthorized" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const { teamId, title } = await req.json().catch(() => ({} as any));
      if (!teamId) {
        return NextResponse.json(
          { message: "teamId is required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // টিম আছে কিনা
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        return NextResponse.json(
          { message: "Team not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      // অথরাইজেশন: admin/manager হলে OK; নইলে টিম-মেম্বার হতে হবে
      const meWithRole = await prisma.user.findUnique({
        where: { id: me.id },
        include: { role: true },
      });
      const roleName = meWithRole?.role?.name?.toLowerCase?.() || "";
      const isAdminOrManager = roleName === "admin" || roleName === "manager";

      let isTeamMember = false;
      if (!isAdminOrManager) {
        const [clientMemberCount, templateMemberCount] = await Promise.all([
          prisma.clientTeamMember.count({ where: { teamId, agentId: me.id } }),
          prisma.templateTeamMember.count({
            where: { teamId, agentId: me.id },
          }),
        ]);
        isTeamMember = clientMemberCount > 0 || templateMemberCount > 0;
      }

      if (!isAdminOrManager && !isTeamMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // যদি আগেই টিম কনভারসেশন থাকে → সেটাই রিটার্ন; না থাকলে ক্রিয়েট
      const existing = await prisma.conversation.findFirst({
        where: { type: "team", teamId },
        include: { participants: true },
      });

      if (existing) {
        const amIParticipant = existing.participants.some(
          (p) => p.userId === me.id
        );
        if (!amIParticipant) {
          await prisma.conversationParticipant.create({
            data: {
              conversationId: existing.id,
              userId: me.id,
              role: "member",
            },
          });
        }
        return NextResponse.json(
          { id: existing.id },
          { headers: NO_STORE_HEADERS }
        );
      }

      // টিম-মেম্বার তালিকা (unique)
      const [clientMembers, templateMembers] = await Promise.all([
        prisma.clientTeamMember.findMany({
          where: { teamId },
          select: { agentId: true },
        }),
        prisma.templateTeamMember.findMany({
          where: { teamId },
          select: { agentId: true },
        }),
      ]);
      const memberIds = new Set<string>();
      clientMembers.forEach((m) => memberIds.add(m.agentId));
      templateMembers.forEach((m) => memberIds.add(m.agentId));
      memberIds.add(me.id); // রিকোয়েস্টার থাকবেই

      const participantsCreate = Array.from(memberIds).map((uid) => ({
        userId: uid,
        role: uid === me.id ? "owner" : "member",
      }));

      const created = await prisma.conversation.create({
        data: {
          type: "team",
          teamId,
          title: title || `Team: ${team.name}`,
          createdById: me.id,
          participants: { create: participantsCreate },
        },
        select: { id: true },
      });

      return NextResponse.json(
        { id: created.id },
        { status: 201, headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("POST /api/chat/team error:", e);
      return NextResponse.json(
        {
          message: "Internal server error",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.team.open"] }
);
