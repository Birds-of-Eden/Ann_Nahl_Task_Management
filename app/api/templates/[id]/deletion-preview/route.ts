// app/api/templates/[id]/deletion-preview/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;

    const tpl = await prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    });
    if (!tpl)
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );

    // Assignment IDs for this template
    const assignments = await prisma.assignment.findMany({
      where: { templateId: templateId },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);

    // Tasks associated via assignments or via template site assets
    const tasksViaAssignments = assignmentIds.length
      ? await prisma.task.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: { id: true },
        })
      : [];

    // Tasks via template site assets relation (if you use task.templateSiteAssetId)
    const tsa = await prisma.templateSiteAsset.findMany({
      where: { templateId: templateId },
      select: { id: true },
    });
    const tsaIds = tsa.map((x) => x.id);
    const tasksViaAssets = tsaIds.length
      ? await prisma.task.findMany({
          where: { templateSiteAssetId: { in: tsaIds } as any },
          select: { id: true },
        })
      : [];

    const allTaskIds = Array.from(
      new Set([...tasksViaAssignments, ...tasksViaAssets].map((t) => t.id))
    );

    const [
      tasksCount,
      siteAssetsCount,
      teamMembersCount,
      assignmentsCount,
      settingsCount,
      commentsCount,
      reportsCount,
      notificationsCount,
    ] = await Promise.all([
      allTaskIds.length
        ? prisma.task.count({ where: { id: { in: allTaskIds } } })
        : 0,
      prisma.templateSiteAsset.count({ where: { templateId } }),
      prisma.templateTeamMember.count({ where: { templateId } }),
      prisma.assignment.count({ where: { templateId } }),
      prisma.assignmentSiteAssetSetting.count({
        where: {
          OR: [
            { assignment: { templateId } },
            { templateSiteAsset: { templateId } },
          ],
        },
      }),
      allTaskIds.length
        ? prisma.comment.count({ where: { taskId: { in: allTaskIds } } })
        : 0,
      allTaskIds.length
        ? prisma.report.count({ where: { taskId: { in: allTaskIds } } })
        : 0,
      allTaskIds.length
        ? prisma.notification.count({ where: { taskId: { in: allTaskIds } } })
        : 0,
    ]);

    return NextResponse.json({
      template: { id: tpl.id, name: tpl.name },
      counts: {
        siteAssets: siteAssetsCount,
        templateTeamMembers: teamMembersCount,
        assignments: assignmentsCount,
        tasks: tasksCount,
        assignmentSiteAssetSettings: settingsCount,
        comments: commentsCount,
        reports: reportsCount,
        notifications: notificationsCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
