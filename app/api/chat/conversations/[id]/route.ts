// app/api/chat/conversations/[id]/route.ts
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

// ---------- GET: conversation detail ----------
export const GET = withAuth(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const session = await getServerSession(authOptions);
      const me = session?.user as any | null;
      if (!me?.id) {
        return NextResponse.json(
          { message: "Unauthorized" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const id = params?.id;
      if (!id) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // member check
      const isMember = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: id, userId: me.id } },
        select: { userId: true },
      });
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  lastSeenAt: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(conv, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("GET /api/chat/conversations/[id] error:", e);
      return NextResponse.json(
        {
          message: "Failed to fetch conversation",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }
);

// ---------- DELETE: leave (scope=self) or delete-all (scope=all) ----------
export const DELETE = withAuth(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const session = await getServerSession(authOptions);
      const me = session?.user as any | null;
      if (!me?.id) {
        return NextResponse.json(
          { message: "Unauthorized" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const id = params?.id;
      if (!id) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const url = new URL(req.url);
      const scope = (url.searchParams.get("scope") || "self") as "self" | "all";

      // conversation + participants
      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: { participants: { select: { userId: true } } },
      });
      if (!conv) {
        return NextResponse.json(
          { message: "Not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      const amIParticipant = conv.participants.some((p) => p.userId === me.id);
      if (!amIParticipant) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      if (scope === "self") {
        // leave conversation
        await prisma.conversationParticipant.delete({
          where: {
            conversationId_userId: { conversationId: id, userId: me.id },
          },
        });

        // if now empty, delete conversation (messages/participants should cascade per schema)
        const remaining = await prisma.conversationParticipant.count({
          where: { conversationId: id },
        });
        if (remaining === 0) {
          await prisma.conversation.delete({ where: { id } });
          return NextResponse.json(
            { ok: true, left: true, deleted: true },
            { headers: NO_STORE_HEADERS }
          );
        }
        return NextResponse.json(
          { ok: true, left: true, deleted: false },
          { headers: NO_STORE_HEADERS }
        );
      }

      // scope=all → only creator or admin can delete
      const meWithRole = await prisma.user.findUnique({
        where: { id: me.id },
        include: { role: true },
      });
      const isAdmin = (meWithRole?.role?.name || "").toLowerCase() === "admin";
      const isCreator = conv.createdById === me.id;

      if (!isAdmin && !isCreator) {
        return NextResponse.json(
          { message: "Only creator or admin can delete for all" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      await prisma.conversation.delete({ where: { id } });
      return NextResponse.json(
        { ok: true, deleted: true },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("DELETE /api/chat/conversations/[id] error:", e);
      return NextResponse.json(
        {
          message: "Failed to delete/leave conversation",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  }
);
