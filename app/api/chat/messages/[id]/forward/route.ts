// app/api/chat/messages/[id]/forward/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher/server";
import { getOrCreateDm } from "@/lib/chat/dm";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// ✅ POST /api/chat/messages/[id]/forward
// permission: chat.message.forward  (আপনার Permission সিডে মিলিয়ে নিন)
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

      const sourceMessageId = params?.id;
      if (!sourceMessageId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const body = await req.json().catch(() => ({}));
      let targetUserIds: string[] = Array.isArray(body?.targetUserIds)
        ? body.targetUserIds
        : [];
      let targetConversationIds: string[] = Array.isArray(
        body?.targetConversationIds
      )
        ? body.targetConversationIds
        : [];

      if (!targetUserIds.length && !targetConversationIds.length) {
        return NextResponse.json(
          { message: "No targets" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // de-dup
      targetUserIds = Array.from(new Set(targetUserIds));
      targetConversationIds = Array.from(new Set(targetConversationIds));

      // 1) Load source message + membership check
      const src = await prisma.chatMessage.findUnique({
        where: { id: sourceMessageId },
        include: {
          conversation: {
            select: { id: true, participants: { select: { userId: true } } },
          },
          sender: { select: { id: true, name: true, image: true } },
        },
      });
      if (!src) {
        return NextResponse.json(
          { message: "Source not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      const isMember = src.conversation.participants.some(
        (p) => p.userId === me.id
      );
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // 2) Client policy: client → only forward to their assigned AM (user or that DM)
      const roleName = (me?.role ?? "").toLowerCase();
      if (roleName === "client") {
        const meClientId = me?.clientId ?? null;
        if (!meClientId) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }

        const client = await prisma.client.findUnique({
          where: { id: meClientId },
          select: { amId: true },
        });
        const amId = client?.amId ?? null;
        if (!amId) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }

        // filter user targets
        targetUserIds = targetUserIds.filter((uid) => uid === amId);

        // filter conversation targets to only the client↔AM DM
        if (targetConversationIds.length) {
          const convs = await prisma.conversation.findMany({
            where: { id: { in: targetConversationIds } },
            select: {
              id: true,
              type: true,
              participants: { select: { userId: true } },
            },
          });
          const allowed = convs
            .filter((c) => {
              const ids = new Set(c.participants.map((p) => p.userId));
              return (
                c.type === "dm" &&
                ids.size === 2 &&
                ids.has(me.id) &&
                ids.has(amId)
              );
            })
            .map((c) => c.id);
          targetConversationIds = targetConversationIds.filter((cid) =>
            allowed.includes(cid)
          );
        }

        if (!targetUserIds.length && !targetConversationIds.length) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
      }

      // 3) Compose forwarded payload
      const forwardedMeta = {
        forwardedFromMessageId: src.id,
        forwardedFromConversationId:
          (src as any).conversationId ?? src.conversation.id,
        forwardedById: me.id,
        originalSenderId: (src as any).senderId ?? src.sender?.id ?? null,
      };

      const prefix = `↪️ Forwarded${
        src.sender?.name ? ` from ${src.sender.name}` : ""
      }: `;
      const baseContent = (src as any).content ?? "";
      const content = `${prefix}${baseContent}`.trim();

      const results: { conversationId: string; messageId: string }[] = [];

      // helper to merge attachments safely
      const mergeAttachments = (existing: any, meta: any) => {
        try {
          const o = existing && typeof existing === "object" ? existing : {};
          return { ...o, _forwarded: meta };
        } catch {
          return { _forwarded: meta };
        }
      };

      // serializer for pusher payload
      const serialize = (m: any) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
        type: m.type,
        sender: m.sender,
        attachments: m.attachments,
        receipts: [],
      });

      // 4) Forward to target users (DMs)
      for (const uid of targetUserIds) {
        if (uid === me.id) continue;
        const dm = await getOrCreateDm(me.id, uid);
        const msg = await prisma.chatMessage.create({
          data: {
            conversationId: dm.id,
            senderId: me.id,
            type: (src as any).type,
            content,
            attachments: mergeAttachments(
              (src as any).attachments,
              forwardedMeta
            ),
          },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
        });
        results.push({ conversationId: dm.id, messageId: msg.id });
        await pusherServer.trigger(
          `presence-conversation-${dm.id}`,
          "message:new",
          serialize(msg)
        );
      }

      // 5) Forward to target conversations (must be a participant)
      for (const cid of targetConversationIds) {
        const membership = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: { conversationId: cid, userId: me.id },
          },
          select: { userId: true },
        });
        if (!membership) continue;

        const msg = await prisma.chatMessage.create({
          data: {
            conversationId: cid,
            senderId: me.id,
            type: (src as any).type,
            content,
            attachments: mergeAttachments(
              (src as any).attachments,
              forwardedMeta
            ),
          },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
        });
        results.push({ conversationId: cid, messageId: msg.id });
        await pusherServer.trigger(
          `presence-conversation-${cid}`,
          "message:new",
          serialize(msg)
        );
      }

      return NextResponse.json(
        { ok: true, forwarded: results },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("POST /api/chat/messages/[id]/forward error:", e);
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
  { permissions: ["chat.message.forward"] }
);
