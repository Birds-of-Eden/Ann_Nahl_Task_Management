// app/api/chat/conversations/[id]/typing/route.ts
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

// ✅ POST /api/chat/conversations/[id]/typing
// permission: chat.typing.write (ইচ্ছা করলে সিডে যোগ করুন)
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

      // presence channel এ typing ইভেন্ট
      await pusherServer.trigger(`presence-conversation-${id}`, "typing", {
        userId: me.id,
        name: me.name || me.email || "Someone",
      });

      return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
    } catch (e: any) {
      console.error("POST /api/chat/conversations/[id]/typing error:", e);
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
  { permissions: ["chat.typing.write"] }
);
