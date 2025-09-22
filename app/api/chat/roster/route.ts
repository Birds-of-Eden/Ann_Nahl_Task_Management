// app/api/chat/roster/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/authz";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
};

// GET /api/chat/roster → permission: chat.roster.read
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

      const { searchParams } = new URL(req.url);
      const q = (searchParams.get("q") || "").trim();

      // role string (session callback-এ আমরা string সেট করেছি)
      const roleName = (me?.role ?? "").toLowerCase();

      // ——— Client: শুধু নিজের assigned AM দেখবে
      if (roleName === "client") {
        const clientId = me?.clientId ?? null;
        if (!clientId) {
          return NextResponse.json(
            { online: [], offline: [], counts: { online: 0, offline: 0 }, q },
            { headers: NO_STORE_HEADERS }
          );
        }

        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { amId: true },
        });

        const amId = client?.amId ?? null;
        if (!amId) {
          return NextResponse.json(
            { online: [], offline: [], counts: { online: 0, offline: 0 }, q },
            { headers: NO_STORE_HEADERS }
          );
        }

        const am = await prisma.user.findFirst({
          where: {
            id: amId,
            status: "active",
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastSeenAt: true,
          },
        });

        const now = Date.now();
        const amRow = am
          ? {
              ...am,
              isOnline: !!(
                am.lastSeenAt &&
                now - new Date(am.lastSeenAt).getTime() <= ONLINE_WINDOW_MS
              ),
            }
          : null;

        const online = amRow && amRow.isOnline ? [amRow] : [];
        const offline = amRow && !amRow.isOnline ? [amRow] : [];

        return NextResponse.json(
          {
            online,
            offline,
            counts: { online: online.length, offline: offline.length },
            q,
          },
          { headers: NO_STORE_HEADERS }
        );
      }

      // ——— Agent: AM ও Client রোল হাইড করো
      if (roleName === "agent") {
        const users = await prisma.user.findMany({
          where: {
            id: { not: me.id },
            status: "active",
            // relation filter must use `is`
            NOT: {
              role: {
                is: {
                  name: {
                    in: ["client", "am", "account manager", "account_manager"],
                  },
                },
              },
            },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastSeenAt: true,
          },
          orderBy: { name: "asc" },
        });

        const now = Date.now();
        const rows = users.map((u) => ({
          ...u,
          isOnline: !!(
            u.lastSeenAt &&
            now - new Date(u.lastSeenAt).getTime() <= ONLINE_WINDOW_MS
          ),
        }));

        const online = rows.filter((r) => r.isOnline);
        const offline = rows.filter((r) => !r.isOnline);

        return NextResponse.json(
          {
            online,
            offline,
            counts: { online: online.length, offline: offline.length },
            q,
          },
          { headers: NO_STORE_HEADERS }
        );
      }

      // ——— AM: শুধু admins, managers, এবং নিজের ক্লায়েন্টদের দেখাও
      if (["am", "account manager", "account_manager"].includes(roleName)) {
        const clients = await prisma.client.findMany({
          where: { amId: me.id },
          select: { id: true },
        });
        const clientIds = clients.map((c) => c.id);

        const adminManagerUsers = await prisma.user.findMany({
          where: {
            id: { not: me.id },
            status: "active",
            role: { is: { name: { in: ["admin", "manager"] } } },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastSeenAt: true,
          },
        });

        const clientUsers = clientIds.length
          ? await prisma.user.findMany({
              where: {
                id: { not: me.id },
                status: "active",
                clientId: { in: clientIds },
                ...(q
                  ? {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    }
                  : {}),
              },
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                lastSeenAt: true,
              },
            })
          : [];

        // unique merge
        const map = new Map<string, any>();
        [...adminManagerUsers, ...clientUsers].forEach((u) => map.set(u.id, u));
        const users = Array.from(map.values());

        const now = Date.now();
        const rows = users.map((u) => ({
          ...u,
          isOnline: !!(
            u.lastSeenAt &&
            now - new Date(u.lastSeenAt).getTime() <= ONLINE_WINDOW_MS
          ),
        }));

        const online = rows.filter((r) => r.isOnline);
        const offline = rows.filter((r) => !r.isOnline);

        return NextResponse.json(
          {
            online,
            offline,
            counts: { online: online.length, offline: offline.length },
            q,
          },
          { headers: NO_STORE_HEADERS }
        );
      }

      // ——— ডিফল্ট: active users (নিজে বাদ), optional search
      const users = await prisma.user.findMany({
        where: {
          id: { not: me.id },
          status: "active",
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          lastSeenAt: true,
        },
        orderBy: { name: "asc" },
      });

      const now = Date.now();
      const rows = users.map((u) => ({
        ...u,
        isOnline: !!(
          u.lastSeenAt &&
          now - new Date(u.lastSeenAt).getTime() <= ONLINE_WINDOW_MS
        ),
      }));

      const online = rows.filter((r) => r.isOnline);
      const offline = rows.filter((r) => !r.isOnline);

      return NextResponse.json(
        {
          online,
          offline,
          counts: { online: online.length, offline: offline.length },
          q,
        },
        { headers: NO_STORE_HEADERS }
      );
    } catch (e: any) {
      console.error("GET /api/chat/roster error:", e);
      return NextResponse.json(
        {
          online: [],
          offline: [],
          counts: { online: 0, offline: 0 },
          q: "",
          error: e?.message ?? "Unknown error",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }
  },
  { permissions: ["chat.roster.read"] }
);
