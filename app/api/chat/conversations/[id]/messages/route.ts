// app/api/chat/conversations/[id]/messages/route.ts
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

// -------- helpers --------
function aggregateReactions(
  rows: { emoji: string; userId: string }[]
): { emoji: string; count: number; userIds: string[] }[] {
  const map = new Map<
    string,
    { emoji: string; count: number; userIds: string[] }
  >();
  for (const r of rows) {
    if (!map.has(r.emoji))
      map.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
    const row = map.get(r.emoji)!;
    row.count += 1;
    row.userIds.push(r.userId);
  }
  return Array.from(map.values());
}

// ================= GET: list messages (paginated) =================
// ?take=30&cursor=<oldestMessageIdFromPrevPage>
export const GET = withAuth(
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

      const conversationId = params?.id;
      if (!conversationId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // member check
      const isMember = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: me.id } },
        select: { userId: true },
      });
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      const url = new URL(req.url);
      const take = Math.min(
        Math.max(Number(url.searchParams.get("take") ?? 30), 1),
        100
      );
      const cursor = url.searchParams.get("cursor") ?? undefined;

      // newest -> oldest then reverse for ASC
      const items = await prisma.chatMessage.findMany({
        where: { conversationId, deletedAt: null },
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          reactions: { select: { emoji: true, userId: true } },
          receipts: {
            select: { userId: true, deliveredAt: true, readAt: true },
          },
        },
      });

      const nextCursor =
        items.length === take ? items[items.length - 1]?.id ?? null : null;

      const messages = items
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt,
          sender: m.sender,
          attachments: m.attachments,
          reactions: aggregateReactions(m.reactions),
          receipts: m.receipts ?? [],
        }));

      return NextResponse.json(
        { messages, nextCursor },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("GET /api/chat/conversations/[id]/messages error:", e);
      return NextResponse.json(
        {
          message: "Failed to fetch messages",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.message.read"] }
);

// ================= POST: create message =================
// Body: { type?: "text"|"file"|"image"|"system", content?: string, attachments?: any, replyToId?: string }
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

      const conversationId = params?.id;
      if (!conversationId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // member check
      const isMember = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: me.id } },
        select: { userId: true },
      });
      if (!isMember) {
        return NextResponse.json(
          { message: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      // Extra policy: Clients → only DM with assigned AM
      const roleName = (me as any)?.role?.toLowerCase?.() || ""; // session.user.role is a string in your callbacks
      if (roleName === "client") {
        const meClientId = (me as any)?.clientId || null;
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
        const amId = client?.amId || null;
        if (!amId) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { type: true, participants: { select: { userId: true } } },
        });
        const ids = new Set((conv?.participants ?? []).map((p) => p.userId));
        const isDM = conv?.type === "dm";
        const allowed =
          isDM && ids.size === 2 && ids.has(me.id) && ids.has(amId);
        if (!allowed) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
      }

      // Extra policy: AM → only DM to admin/manager or its own clients
      if (["am", "account manager", "account_manager"].includes(roleName)) {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            type: true,
            participants: {
              select: {
                user: {
                  select: {
                    id: true,
                    role: { select: { name: true } },
                    clientId: true,
                  },
                },
              },
            },
          },
        });
        const isDM = conv?.type === "dm";
        if (!isDM) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const others = (conv?.participants ?? [])
          .map((p) => (p as any).user)
          .filter((u: any) => u?.id !== me.id);
        if (others.length !== 1) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const other = others[0];
        const otherRole = other?.role?.name?.toLowerCase?.() || "";
        let allowed = otherRole === "admin" || otherRole === "manager";
        if (!allowed) {
          const tClientId = other?.clientId || null;
          if (tClientId) {
            const count = await prisma.client.count({
              where: { id: tClientId, amId: me.id },
            });
            allowed = count > 0;
          }
        }
        if (!allowed) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
      }

      const body = await req.json().catch(() => ({}));
      const type =
        (body?.type as "text" | "file" | "image" | "system") || "text";
      const content = (body?.content as string | undefined)?.trim() || "";
      const attachments = body?.attachments ?? null;
      const replyToId = (body?.replyToId as string | undefined) || undefined;

      if (type === "text" && !content) {
        return NextResponse.json(
          { message: "Content required" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      if (!["text", "file", "image", "system"].includes(type)) {
        return NextResponse.json(
          { message: "Invalid message type" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // Create message
      const created = await prisma.chatMessage.create({
        data: {
          conversationId,
          senderId: me.id,
          type,
          content: content || null,
          attachments,
          replyToId,
        },
        include: { sender: { select: { id: true, name: true, image: true } } },
      });

      const now = new Date();

      // Sender self-receipt (delivered+read)
      await prisma.messageReceipt.create({
        data: {
          messageId: created.id,
          userId: me.id,
          deliveredAt: now,
          readAt: now,
        },
      });

      const payload = {
        id: created.id,
        content: created.content,
        type: created.type,
        createdAt: created.createdAt,
        sender: created.sender,
        attachments: created.attachments,
        reactions: [] as { emoji: string; count: number; userIds: string[] }[],
        receipts: [{ userId: me.id, deliveredAt: now, readAt: now }],
      };

      // Realtime: new message
      await pusherServer.trigger(
        `presence-conversation-${conversationId}`,
        "message:new",
        payload
      );

      // Realtime: initial receipts (sender)
      await pusherServer.trigger(
        `presence-conversation-${conversationId}`,
        "receipt:update",
        {
          updates: [
            {
              messageId: created.id,
              userId: me.id,
              deliveredAt: now.toISOString(),
              readAt: now.toISOString(),
            },
          ],
        }
      );

      return NextResponse.json(
        { ok: true, message: payload },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("POST /api/chat/conversations/[id]/messages error:", e);
      return NextResponse.json(
        {
          ok: false,
          message: "Failed to send message",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.message.write"] }
);
