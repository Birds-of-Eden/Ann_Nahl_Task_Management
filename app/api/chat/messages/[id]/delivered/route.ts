// app/api/chat/messages/[id]/delivered/route.ts
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

// ✅ POST /api/chat/messages/[id]/delivered
// permission: chat.receipt.write  (আপনার Permission সিডের সাথে মিলিয়ে নিন)
export const POST = withAuth(
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

      // message + conversation
      const msg = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { id: true, conversationId: true, senderId: true },
      });
      if (!msg) {
        return NextResponse.json(
          { message: "Not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      // must be a participant
      const isMember = await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: msg.conversationId,
            userId: me.id,
          },
        },
        select: { userId: true },
      });
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // ignore delivering your own message
      if (msg.senderId === me.id) {
        return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
      }

      const now = new Date();

      await prisma.messageReceipt.upsert({
        where: { messageId_userId: { messageId, userId: me.id } },
        update: { deliveredAt: now },
        create: { messageId, userId: me.id, deliveredAt: now },
      });

      // realtime update
      await pusherServer.trigger(
        `presence-conversation-${msg.conversationId}`,
        "receipt:update",
        {
          updates: [
            {
              messageId,
              userId: me.id,
              deliveredAt: now.toISOString(),
            },
          ],
        }
      );

      return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("POST /api/chat/messages/[id]/delivered error:", e);
      return NextResponse.json(
        {
          ok: false,
          message: "Internal server error",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.receipt.write"] }
);
