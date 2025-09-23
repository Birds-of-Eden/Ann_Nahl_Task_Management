// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/clients - Get all clients
export async function GET(req: Request) {
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
      accountManager: { select: { id: true, name: true, email: true } }, // helpful
    },
  });

  return NextResponse.json(clients);
}

// POST /api/clients - Create new client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      birthdate,
      company,
      designation,
      location,

      // ⬇️ NEW fields
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

      // ⬇️ NEW field
      amId,
    } = body;

    // (Optional but recommended) enforce AM role server-side
    if (amId) {
      const am = await prisma.user.findUnique({
        where: { id: amId },
        include: { role: true },
      });
      if (!am || am.role?.name !== "am") {
        return NextResponse.json({ error: "amId is not an Account Manager" }, { status: 400 });
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

        // ⬇️ NEW fields saved
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
        avatar,             // still a String? in the schema
        progress,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,

        // ⬇️ NEW: link AM
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
        accountManager: { select: { id: true, name: true, email: true } }, // optional
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


// DELETE /api/clients?id=CLIENT_ID  (also accepts { id } in JSON body)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") ?? "";

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || "";
      } catch {
        /* ignore body parse errors */
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1) Find assignments & tasks for this client
      const assignments = await tx.assignment.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentIds = assignments.map((a) => a.id);

      const directTasks = await tx.task.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentTasks = assignmentIds.length
        ? await tx.task.findMany({
            where: { assignmentId: { in: assignmentIds } },
            select: { id: true },
          })
        : [];

      const allTaskIds = Array.from(
        new Set([...directTasks, ...assignmentTasks].map((t) => t.id))
      );

      // 2) Delete task children first
      if (allTaskIds.length) {
        await tx.comment.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.report.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.notification.deleteMany({
          where: { taskId: { in: allTaskIds } },
        });
      }

      // 3) Delete tasks
      if (allTaskIds.length) {
        await tx.task.deleteMany({ where: { id: { in: allTaskIds } } });
      }

      // 4) Delete assignment extras, then assignments
      if (assignmentIds.length) {
        await tx.assignmentSiteAssetSetting.deleteMany({
          where: { assignmentId: { in: assignmentIds } },
        });
        await tx.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
      }

      // 5) Other client-owned records
      await tx.socialMedia.deleteMany({ where: { clientId: id } });
      await tx.clientTeamMember.deleteMany({ where: { clientId: id } });

      // 6) Finally delete the client
      await tx.client.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}