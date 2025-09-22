// app/api/chat/messages/[id]/reactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

function aggregate(recs: { emoji: string; userId: string }[]) {
  const map = new Map<
    string,
    { emoji: string; count: number; userIds: string[] }
  >();
  for (const r of recs) {
    if (!map.has(r.emoji))
      map.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
    const row = map.get(r.emoji)!;
    row.count += 1;
    row.userIds.push(r.userId);
  }
  return Array.from(map.values());
}

// ✅ GET → reactions aggregate (initial load) — permission: chat.reaction.read
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

      const messageId = params?.id;
      if (!messageId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // membership check via message → conversation
      const msg = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: { participants: { select: { userId: true } } },
          },
        },
      });
      if (!msg) {
        return NextResponse.json(
          { message: "Not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
      const isMember = msg.conversation.participants.some(
        (p) => p.userId === me.id
      );
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      const recs = await prisma.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
      });

      return NextResponse.json(
        { messageId, reactions: aggregate(recs) },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("GET /api/chat/messages/[id]/reactions error:", e);
      return NextResponse.json(
        {
          message: "Failed to fetch reactions",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.reaction.read"] }
);

// ✅ POST → toggle (add if not exists, else remove) — permission: chat.reaction.write
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

      const messageId = params?.id;
      if (!messageId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const { emoji } = await req.json().catch(() => ({}));
      if (!emoji || typeof emoji !== "string") {
        return NextResponse.json(
          { message: "Invalid emoji" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // membership check
      const msg = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          conversationId: true,
          conversation: {
            select: { participants: { select: { userId: true } } },
          },
        },
      });
      if (!msg) {
        return NextResponse.json(
          { message: "Not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
      const isMember = msg.conversation.participants.some(
        (p) => p.userId === me.id
      );
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // toggle
      const where = {
        messageId_userId_emoji: { messageId, userId: me.id, emoji },
      };
      const exists = await prisma.messageReaction.findUnique({ where });
      if (exists) {
        await prisma.messageReaction.delete({ where });
      } else {
        await prisma.messageReaction.create({
          data: { messageId, userId: me.id, emoji },
        });
      }

      // aggregate + broadcast
      const recs = await prisma.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
      });
      const payload = { messageId, reactions: aggregate(recs) };

      await pusherServer.trigger(
        `presence-conversation-${msg.conversationId}`,
        "reaction:update",
        payload
      );

      return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("POST /api/chat/messages/[id]/reactions error:", e);
      return NextResponse.json(
        {
          message: "Failed to toggle reaction",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.reaction.write"] }
);
