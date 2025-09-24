// app/api/clients/[id]/deletion-preview/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Exist?
    const exists = await prisma.client.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Assignments (ids) for this client
    const assignments = await prisma.assignment.findMany({
      where: { clientId: id },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);

    // Tasks (direct + via assignment)
    const directTasks = await prisma.task.findMany({
      where: { clientId: id },
      select: { id: true },
    });
    const assignmentTasks =
      assignmentIds.length > 0
        ? await prisma.task.findMany({
            where: { assignmentId: { in: assignmentIds } },
            select: { id: true },
          })
        : [];

    const allTaskIds = Array.from(
      new Set([...directTasks, ...assignmentTasks].map((t) => t.id))
    );

    // Children of tasks
    const [comments, reports, notifications] = await Promise.all([
      allTaskIds.length
        ? prisma.comment.count({ where: { taskId: { in: allTaskIds } } })
        : 0,
      allTaskIds.length
        ? prisma.report.count({ where: { taskId: { in: allTaskIds } } })
        : 0,
      allTaskIds.length
        ? prisma.notification.count({
            where: { taskId: { in: allTaskIds } },
          })
        : 0,
    ]);

    const [tasksCount, assignmentsCount, assignmentSiteAssetSettings] =
      await Promise.all([
        allTaskIds.length
          ? prisma.task.count({ where: { id: { in: allTaskIds } } })
          : 0,
        prisma.assignment.count({ where: { clientId: id } }),
        assignmentIds.length
          ? prisma.assignmentSiteAssetSetting.count({
              where: { assignmentId: { in: assignmentIds } },
            })
          : 0,
      ]);

    const [socialMedia, clientTeamMembers] = await Promise.all([
      prisma.socialMedia.count({ where: { clientId: id } }),
      prisma.clientTeamMember.count({ where: { clientId: id } }),
    ]);

    // Add any other client-owned models here as needed
    return NextResponse.json(
      {
        client: { id, name: exists.name },
        counts: {
          assignments: assignmentsCount,
          tasks: tasksCount,
          comments,
          reports,
          notifications,
          assignmentSiteAssetSettings,
          socialMedia,
          clientTeamMembers,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
