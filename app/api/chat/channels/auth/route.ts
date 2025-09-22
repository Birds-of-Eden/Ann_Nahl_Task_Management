// app/api/chat/channels/auth/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher/server";
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

// pusher-js form-encoded body পাঠায় → text() + URLSearchParams
// permission: chat.presence.auth (আপনার সিড/পারমিশন নামের সাথে মিলিয়ে নিন)
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

      const raw = await req.text();
      const params = new URLSearchParams(raw);
      const socketId = params.get("socket_id") || "";
      const channelName = params.get("channel_name") || "";

      const m = channelName.match(/^presence-conversation-(.+)$/);
      const conversationId = m?.[1];

      if (!socketId || !channelName || !conversationId) {
        return NextResponse.json(
          { message: "Bad request" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      // মেম্বারশিপ যাচাই
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

      // lastSeen আপডেট
      await prisma.user.update({
        where: { id: me.id },
        data: { lastSeenAt: new Date() },
      });

      const presenceData = {
        user_id: me.id,
        user_info: { name: me.name, image: (me as any).image ?? null },
      };

      const auth = pusherServer.authenticate(
        socketId,
        channelName,
        presenceData
      );
      return new NextResponse(JSON.stringify(auth), {
        status: 200,
        headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS },
      });
    } catch (e: any) {
      console.error("POST /api/chat/channels/auth error:", e);
      return NextResponse.json(
        {
          message: "Internal server error",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.presence.auth"] }
);
