// app/api/chat/conversations/[id]/participants/route.ts
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

// --- helpers ---
function isAdminOrManager(roleName: string) {
  const r = (roleName || "").toLowerCase();
  return r === "admin" || r === "manager";
}

async function ensureCanModify(conversationId: string, userId: string) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  const roleName = me?.role?.name || "";

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { createdById: true },
  });

  const isCreator = conv?.createdById === userId;
  const isAdminMgr = isAdminOrManager(roleName);
  return !!(isCreator || isAdminMgr);
}

// ========================= GET: list participants =========================
// permission: chat.participant.read
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

      // must be participant to view
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
        select: {
          id: true,
          type: true,
          createdById: true,
          participants: {
            select: {
              userId: true,
              role: true,
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      });

      return NextResponse.json(conv?.participants ?? [], {
        headers: NO_STORE_HEADERS,
      });
    } catch (e: any) {
      console.error("GET /api/chat/conversations/[id]/participants error:", e);
      return NextResponse.json(
        {
          message: "Failed to fetch participants",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.participant.read"] }
);

// ========================= POST: add members =========================
// Body: { userIds: string[] }
// permission: chat.participant.manage
export const POST = withAuth(
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

      const body = await req.json().catch(() => ({}));
      const userIds: string[] = Array.isArray(body?.userIds)
        ? body.userIds
        : [];
      if (!userIds.length) {
        return NextResponse.json(
          { message: "userIds required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // must be allowed to modify (creator/admin/manager)
      const allowed = await ensureCanModify(id, me.id);
      if (!allowed) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // Add unique users not already in participants
      const existing = await prisma.conversationParticipant.findMany({
        where: { conversationId: id },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((p) => p.userId));
      const toAdd = Array.from(new Set(userIds)).filter(
        (uid) => uid && !existingIds.has(uid)
      );
      if (!toAdd.length) {
        return NextResponse.json(
          { ok: true, added: 0 },
          { headers: NO_STORE_HEADERS }
        );
      }

      await prisma.conversationParticipant.createMany({
        data: toAdd.map((uid) => ({
          conversationId: id,
          userId: uid,
          role: "member",
        })),
        skipDuplicates: true,
      });

      return NextResponse.json(
        { ok: true, added: toAdd.length },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("POST /api/chat/conversations/[id]/participants error:", e);
      return NextResponse.json(
        {
          message: "Failed to add participants",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.participant.manage"] }
);

// ========================= DELETE: remove member =========================
// Body: { userId: string } (cannot remove creator)
// permission: chat.participant.manage
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

      const { userId } = await req.json().catch(() => ({}));
      if (!userId) {
        return NextResponse.json(
          { message: "userId required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // must be allowed to modify (creator/admin/manager)
      const allowed = await ensureCanModify(id, me.id);
      if (!allowed) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // prevent deleting creator
      const conv = await prisma.conversation.findUnique({
        where: { id },
        select: { createdById: true },
      });
      if (conv?.createdById === userId) {
        return NextResponse.json(
          { message: "Cannot remove conversation owner" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      await prisma.conversationParticipant
        .delete({
          where: { conversationId_userId: { conversationId: id, userId } },
        })
        .catch(() => {
          /* ignore if not found */
        });

      return NextResponse.json(
        { ok: true, removed: userId },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error(
        "DELETE /api/chat/conversations/[id]/participants error:",
        e
      );
      return NextResponse.json(
        {
          message: "Failed to remove participant",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.participant.manage"] }
);
