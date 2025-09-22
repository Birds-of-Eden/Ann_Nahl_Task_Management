// app/api/chat/unread-count/route.ts

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

// permission: chat.read
export const GET = withAuth(
  async (_req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const me = session?.user as any | null;
      if (!me?.id) {
        return NextResponse.json(
          { count: 0 },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      // আমি যে কনভারসেশনে আছি + আমার lastReadAt
      const parts = await prisma.conversationParticipant.findMany({
        where: { userId: me.id },
        select: { conversationId: true, lastReadAt: true },
      });

      if (!parts.length) {
        return NextResponse.json({ count: 0 }, { headers: NO_STORE_HEADERS });
      }

      // প্রতি কনভারসেশনের unread → sum
      const counts = await Promise.all(
        parts.map((p) =>
          prisma.chatMessage.count({
            where: {
              conversationId: p.conversationId,
              deletedAt: null,
              NOT: { senderId: me.id }, // নিজের মেসেজ বাদ
              ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
            },
          })
        )
      );

      const total = counts.reduce((a, b) => a + b, 0);
      return NextResponse.json({ count: total }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("GET /api/chat/unread-count error:", e);
      // ফেইল হলে 0 রিটার্ন করলেও পারেন; এখানে 500 দিচ্ছি যাতে ডিবাগ করা যায়
      return NextResponse.json(
        { count: 0, error: e?.message ?? "Unknown error" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.read"] }
);
