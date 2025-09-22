// app/api/chat/conversations/route.ts
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

// ✅ POST /api/chat/conversations → create
// permission: chat.conversation.create
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

      const {
        type = "dm",
        title,
        memberIds = [],
        clientId,
        teamId,
        assignmentId,
        taskId,
      } = (await req.json().catch(() => ({}))) as {
        type?:
          | "dm"
          | "group"
          | "client"
          | "team"
          | "assignment"
          | "task"
          | "support";
        title?: string | null;
        memberIds?: string[];
        clientId?: string | null;
        teamId?: string | null;
        assignmentId?: string | null;
        taskId?: string | null;
      };

      // sanitize members (array of strings), always include me
      const baseMembers = Array.isArray(memberIds)
        ? memberIds.filter(Boolean)
        : [];
      const uniqueMemberIds = Array.from(new Set([...baseMembers, me.id]));

      const roleName = (me?.role ?? "").toLowerCase();

      // Enforce: clients may only create a DM with their assigned AM
      if (roleName === "client") {
        const myClientId = me?.clientId ?? null;
        if (!myClientId) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const client = await prisma.client.findUnique({
          where: { id: myClientId },
          select: { amId: true },
        });
        const amId = client?.amId ?? null;

        const others = uniqueMemberIds.filter((id) => id !== me.id);
        const onlyAM = others.length === 1 && amId && others[0] === amId;

        if (type !== "dm" || !onlyAM) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
      }

      // Enforce: Agent may only create DM and cannot target AM/account manager or client
      if (roleName === "agent") {
        if (type !== "dm") {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const others = uniqueMemberIds.filter((id) => id !== me.id);
        if (others.length !== 1) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const otherId = others[0];
        const target = await prisma.user.findUnique({
          where: { id: otherId },
          include: { role: true },
        });
        const targetRole = target?.role?.name?.toLowerCase?.() || "";
        if (
          ["client", "am", "account manager", "account_manager"].includes(
            targetRole
          )
        ) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
      }

      // Enforce: AM may only create DM with allowed targets (admin/manager or AM's client)
      if (["am", "account manager", "account_manager"].includes(roleName)) {
        if (type !== "dm") {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const others = uniqueMemberIds.filter((id) => id !== me.id);
        if (others.length !== 1) {
          return NextResponse.json(
            { message: "Forbidden" },
            { status: 403, headers: NO_STORE_HEADERS }
          );
        }
        const otherId = others[0];
        const target = await prisma.user.findUnique({
          where: { id: otherId },
          include: { role: true },
        });
        if (!target) {
          return NextResponse.json(
            { message: "Invalid member" },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
        const targetRole = target.role?.name?.toLowerCase?.() || "";
        let allowed = targetRole === "admin" || targetRole === "manager";
        if (!allowed) {
          const tClientId = (target as any)?.clientId || null;
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

      const conv = await prisma.conversation.create({
        data: {
          type,
          title: title || null,
          createdById: me.id,
          clientId: clientId || null,
          teamId: teamId || null,
          assignmentId: assignmentId || null,
          taskId: taskId || null,
          participants: {
            create: uniqueMemberIds.map((uid) => ({
              userId: uid,
              role: uid === me.id ? "owner" : "member",
            })),
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });

      return NextResponse.json(conv, {
        status: 201,
        headers: NO_STORE_HEADERS,
      });
    } catch (e: any) {
      console.error("POST /api/chat/conversations error:", e);
      return NextResponse.json(
        {
          message: "Internal server error",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.conversation.create"] }
);

// ✅ GET /api/chat/conversations → my list
// permission: chat.conversation.read
export const GET = withAuth(
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

      const u = new URL(req.url);
      const takeRaw = Number(u.searchParams.get("take") || 30);
      const take = Math.max(1, Math.min(100, takeRaw)); // clamp 1..100
      const cursor = u.searchParams.get("cursor") || undefined;
      const filterType = (u.searchParams.get("type") || undefined) as
        | "dm"
        | "group"
        | "client"
        | "team"
        | "assignment"
        | "task"
        | "support"
        | undefined;
      const filterTeamId = u.searchParams.get("teamId") || undefined;

      // আমার পার্টিসিপেশন (pagination-friendly)
      const cps = await prisma.conversationParticipant.findMany({
        where: { userId: me.id },
        take,
        ...(cursor
          ? {
              skip: 1,
              cursor: {
                conversationId_userId: {
                  conversationId: cursor,
                  userId: me.id,
                },
              },
            }
          : {}),
        select: { conversationId: true, lastReadAt: true },
        orderBy: { joinedAt: "desc" },
      });

      if (!cps.length) {
        return NextResponse.json([], { headers: NO_STORE_HEADERS });
      }

      const convIds = cps.map((c) => c.conversationId);

      const conversations = await prisma.conversation.findMany({
        where: {
          id: { in: convIds },
          ...(filterType ? { type: filterType } : {}),
          ...(filterTeamId ? { teamId: filterTeamId } : {}),
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          messages: { take: 1, orderBy: { createdAt: "desc" } },
        },
      });

      const lastReadBy: Record<string, Date | null> = {};
      cps.forEach((c) => (lastReadBy[c.conversationId] = c.lastReadAt ?? null));

      // unread + last activity (১টা কনভ-এ ১টা কাউন্ট-কুয়েরি — চাইলে ব্যাচ অপটিমাইজ করা যাবে)
      const withUnread = await Promise.all(
        conversations.map(async (conv) => {
          const lastReadAt = lastReadBy[conv.id] ?? new Date(0);
          const unreadCount = await prisma.chatMessage.count({
            where: {
              conversationId: conv.id,
              createdAt: { gt: lastReadAt },
              senderId: { not: me.id },
              deletedAt: null,
            },
          });
          const lastMsgAt = conv.messages?.[0]?.createdAt || conv.updatedAt;
          return { ...conv, unreadCount, _lastActivityAt: lastMsgAt } as any;
        })
      );

      // সর্বশেষ অ্যাক্টিভিটি অনুযায়ী সাজানো
      withUnread.sort((a: any, b: any) => {
        const ta = new Date(a._lastActivityAt).getTime();
        const tb = new Date(b._lastActivityAt).getTime();
        return tb - ta;
      });

      // হেল্পার ফিল্ড বাদ
      const result = withUnread.map(
        ({ _lastActivityAt, ...rest }: any) => rest
      );

      return NextResponse.json(result, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("GET /api/chat/conversations error:", e);
      return NextResponse.json(
        {
          message: "Internal server error",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.conversation.read"] }
);
