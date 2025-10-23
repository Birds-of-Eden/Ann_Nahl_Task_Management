// app/api/assignments/[id]/regenerate-tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  TaskStatus,
  TaskPriority,
  SiteAssetType,
  PeriodType,
} from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Regenerate tasks for missing or new template assets in an assignment
 * This detects assets that don't have tasks yet and creates them
 * Useful after manually adding assets to a template
 * 
 * POST /api/assignments/{assignmentId}/regenerate-tasks
 * Body: {
 *   onlyMissing?: boolean (default: true) - Only create tasks for assets without tasks
 *   forceRecreate?: boolean (default: false) - Archive old and recreate all tasks
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      onlyMissing = true,
      forceRecreate = false,
    } = body as {
      onlyMissing?: boolean;
      forceRecreate?: boolean;
    };

    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    const CATEGORY_NAME_BY_TYPE: Record<SiteAssetType, string> = {
      social_site: "Social Asset Creation",
      web2_site: "Web 2.0 Asset Creation",
      other_asset: "Additional Asset Creation",
      graphics_design: "Graphics Design",
      image_optimization: "Image Optimization",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed Communication",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      guest_posting: "Guest Posting",
    };

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load assignment with template and existing tasks
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
            },
          },
          tasks: {
            where: {
              status: {
                notIn: [TaskStatus.cancelled],
              },
            },
            include: {
              templateSiteAsset: true,
            },
          },
          siteAssetSettings: true,
        },
      });

      if (!assignment) {
        throw new Error("ASSIGNMENT_NOT_FOUND");
      }

      if (!assignment.template) {
        throw new Error("NO_TEMPLATE_ATTACHED");
      }

      // 2) Ensure task categories exist
      const categoryNames = Array.from(
        new Set(Object.values(CATEGORY_NAME_BY_TYPE))
      );
      await Promise.all(
        categoryNames.map((name) =>
          tx.taskCategory.upsert({
            where: { name },
            create: { name },
            update: {},
          })
        )
      );

      const categories = await tx.taskCategory.findMany();
      const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

      // 3) Build set of assets that already have tasks
      const assetsWithTasks = new Set(
        assignment.tasks
          .filter((t) => t.templateSiteAssetId !== null)
          .map((t) => t.templateSiteAssetId)
      );

      const now = new Date();
      const defaultDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const tasksCreated: any[] = [];
      const tasksArchived: any[] = [];
      const settingsCreated: any[] = [];

      // 4) If forceRecreate, archive ALL existing tasks
      if (forceRecreate) {
        for (const task of assignment.tasks) {
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.cancelled,
              notes: `${task.notes || ""}\n\n[AUTO-ARCHIVED] Task regenerated`,
            },
          });
          tasksArchived.push({
            taskId: task.id,
            taskName: task.name,
            assetId: task.templateSiteAssetId,
          });
        }
        // Clear the set so all assets are treated as needing tasks
        assetsWithTasks.clear();
      }

      // 5) Create tasks for assets that need them
      const assetsToProcess = onlyMissing && !forceRecreate
        ? assignment.template.sitesAssets.filter(
            (asset) => !assetsWithTasks.has(asset.id)
          )
        : assignment.template.sitesAssets;

      for (const asset of assetsToProcess) {
        // Skip if already has task and onlyMissing is true
        if (onlyMissing && !forceRecreate && assetsWithTasks.has(asset.id)) {
          continue;
        }

        const categoryName =
          CATEGORY_NAME_BY_TYPE[asset.type as SiteAssetType] ?? "Other Task";
        const categoryId = categoryIdByName.get(categoryName) ?? null;

        const newTask = {
          id: randomUUID(),
          name: `${asset.name} Task`,
          assignmentId: assignment.id,
          clientId: assignment.clientId,
          templateSiteAssetId: asset.id,
          categoryId,
          dueDate: defaultDueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes: asset.defaultIdealDurationMinutes ?? 30,
          notes: forceRecreate
            ? "[REGENERATED] Task recreated"
            : "[GENERATED] Task created for missing asset",
        };

        await tx.task.create({ data: newTask });
        tasksCreated.push({
          taskId: newTask.id,
          taskName: newTask.name,
          assetId: asset.id,
          assetName: asset.name,
        });

        // Create or update setting if missing
        const existingSetting = assignment.siteAssetSettings.find(
          (s) => s.templateSiteAssetId === asset.id
        );

        if (!existingSetting) {
          await tx.assignmentSiteAssetSetting.create({
            data: {
              assignmentId: assignment.id,
              templateSiteAssetId: asset.id,
              requiredFrequency: asset.defaultPostingFrequency ?? null,
              period: PeriodType.monthly,
              idealDurationMinutes: asset.defaultIdealDurationMinutes ?? null,
            },
          });
          settingsCreated.push({
            assetId: asset.id,
            assetName: asset.name,
          });
        }
      }

      // 6) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Assignment",
          entityId: assignmentId,
          userId: actorId,
          action: "regenerate_tasks",
          details: {
            clientId: assignment.clientId,
            clientName: assignment.client?.name,
            templateId: assignment.template.id,
            templateName: assignment.template.name,
            onlyMissing,
            forceRecreate,
            tasksCreated: tasksCreated.length,
            tasksArchived: tasksArchived.length,
            settingsCreated: settingsCreated.length,
          },
        },
      });

      // Return updated assignment
      return await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
              templateTeamMembers: {
                include: {
                  agent: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
          tasks: {
            include: {
              assignedTo: true,
              category: true,
              templateSiteAsset: true,
            },
            orderBy: { createdAt: "desc" },
          },
          siteAssetSettings: {
            include: {
              templateSiteAsset: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: "Tasks regenerated successfully",
        assignment: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.message === "ASSIGNMENT_NOT_FOUND") {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }
    if (error?.message === "NO_TEMPLATE_ATTACHED") {
      return NextResponse.json(
        { message: "Assignment has no template attached" },
        { status: 400 }
      );
    }
    console.error("Regenerate tasks error:", error);
    return NextResponse.json(
      {
        message: "Failed to regenerate tasks",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
