// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/clients - Get all clients (with clientUserId attached)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get("packageId");
    const amId = searchParams.get("amId");

    const clients = await prisma.client.findMany({
      where: {
        packageId: packageId || undefined,
        amId: amId || undefined,
      },
      include: {
        socialMedias: true,
        accountManager: { select: { id: true, name: true, email: true } },
        // (optional) include other relations if you need them in the grid:
        // package: { select: { id: true, name: true } },
        // tasks: true,
      },
    });

    if (clients.length === 0) {
      return NextResponse.json([]);
    }

    // Map each client to its primary client-role user (if any)
    const clientIds = clients.map((c) => c.id);
    const clientUsers = await prisma.user.findMany({
      where: {
        clientId: { in: clientIds },
        role: { name: "client" }, // only client-role users
      },
      select: { id: true, clientId: true },
    });

    // If multiple users exist for a single client, pick the first we encounter (can be customized)
    const clientIdToUserId = new Map<string | number, string>();
    for (const u of clientUsers) {
      const key = u.clientId as unknown as string | number;
      if (!clientIdToUserId.has(key)) {
        clientIdToUserId.set(key, String(u.id));
      }
    }

    const result = clients.map((c) => ({
      ...c,
      // Attach the linked client-role user id (or null)
      clientUserId: clientIdToUserId.get(c.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create new client (kept from your version, unchanged)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      birthdate,
      company,
      designation,
      location,

      // NEW fields
      email,
      phone,
      password,
      recoveryEmail,

      website,
      website2,
      website3,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      startDate,
      dueDate,
      socialLinks = [],

      // NEW field
      amId,
    } = body;

    // (Optional but recommended) enforce AM role server-side
    if (amId) {
      const am = await prisma.user.findUnique({
        where: { id: amId },
        include: { role: true },
      });
      if (!am || am.role?.name !== "am") {
        return NextResponse.json(
          { error: "amId is not an Account Manager" },
          { status: 400 }
        );
      }
    }

    const normalizePlatform = (input: unknown): string => {
      const raw = String(input ?? "").trim();
      return raw || "OTHER";
    };

    const client = await prisma.client.create({
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : undefined,
        company,
        designation,
        location,

        // NEW fields saved
        email,
        phone,
        password,
        recoveryEmail,

        website,
        website2,
        website3,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar, // still a String? in the schema
        progress,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,

        // NEW: link AM
        amId: amId || undefined,

        socialMedias: {
          create: Array.isArray(socialLinks)
            ? socialLinks
                .filter((l: any) => l && l.platform && l.url)
                .map((l: any) => ({
                  platform: normalizePlatform(l.platform) as any,
                  url: l.url as string,
                  username: l.username ?? null,
                  email: l.email ?? null,
                  phone: l.phone ?? null,
                  password: l.password ?? null,
                  notes: l.notes ?? null,
                }))
            : [],
        },
      } as any,
      include: {
        socialMedias: true,
        accountManager: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
