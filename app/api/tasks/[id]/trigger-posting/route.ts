// app/api/tasks/[id]/trigger-posting/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskStatus, TaskPriority, PeriodType } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * 🎯 QC Approved → Posting Task Generation Trigger
 * 
 * When a QC task is approved, this generates posting tasks based on:
 * - Client-specific requiredFrequency (from AssignmentSiteAssetSetting)
 * - Fallback to template default if no client override
 * 
 * POST /api/tasks/{taskId}/trigger-posting
 * Body: { 
 *   actorId?: string,
 *   forceOverride?: boolean (regenerate even if already exists)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { actorId, forceOverride = false } = body as {
      actorId?: string;
      forceOverride?: boolean;
    };

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load the QC task with full context
      const qcTask = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          assignment: {
            include: {
              client: true,
              siteAssetSettings: {
                where: {
                  // Filter to this specific asset
                  templateSiteAssetId: undefined, // Will be set below
                },
              },
            },
          },
          templateSiteAsset: true,
          category: true,
        },
      });

      if (!qcTask) {
        throw new Error("TASK_NOT_FOUND");
      }

      // Verify this is a QC task
      if (!qcTask.category?.name?.toLowerCase().includes("qc")) {
        throw new Error("NOT_A_QC_TASK");
      }

      // Verify QC task is approved/completed
      if (qcTask.status !== TaskStatus.completed) {
        throw new Error("QC_NOT_APPROVED");
      }

      if (!qcTask.templateSiteAssetId) {
        throw new Error("NO_ASSET_LINKED");
      }

      if (!qcTask.assignmentId) {
        throw new Error("NO_ASSIGNMENT_LINKED");
      }

      // 2) Get client-specific settings for this asset
      const assetSetting = await tx.assignmentSiteAssetSetting.findFirst({
        where: {
          assignmentId: qcTask.assignmentId,
          templateSiteAssetId: qcTask.templateSiteAssetId,
        },
      });

      // Determine posting frequency
      const requiredFrequency =
        assetSetting?.requiredFrequency ??
        qcTask.templateSiteAsset?.defaultPostingFrequency ??
        4; // fallback default

      const idealDurationMinutes =
        assetSetting?.idealDurationMinutes ??
        qcTask.templateSiteAsset?.defaultIdealDurationMinutes ??
        30;

      const period = assetSetting?.period ?? PeriodType.monthly;

      // 3) Check if posting tasks already exist (unless forceOverride)
      if (!forceOverride) {
        const existingPostingTasks = await tx.task.findMany({
          where: {
            assignmentId: qcTask.assignmentId,
            templateSiteAssetId: qcTask.templateSiteAssetId,
            category: {
              name: {
                contains: "posting",
                mode: "insensitive",
              },
            },
            status: {
              notIn: [TaskStatus.cancelled],
            },
          },
        });

        if (existingPostingTasks.length > 0) {
          return {
            message: "Posting tasks already exist for this asset",
            existingTasks: existingPostingTasks,
            skipped: true,
          };
        }
      }

      // 4) Ensure Posting category exists
      const postingCategory = await tx.taskCategory.upsert({
        where: { name: "Posting" },
        create: { name: "Posting" },
        update: {},
      });

      // 5) Generate posting tasks based on requiredFrequency
      const now = new Date();
      const postingTasks = [];

      for (let i = 0; i < requiredFrequency; i++) {
        const dueDate = new Date(now);
        
        // Spread posting tasks throughout the period
        if (period === PeriodType.monthly) {
          // Monthly: spread across 30 days
          const daysOffset = Math.floor((30 / requiredFrequency) * i);
          dueDate.setDate(now.getDate() + daysOffset);
        } else if (period === PeriodType.weekly) {
          // Weekly: spread across 7 days
          const daysOffset = Math.floor((7 / requiredFrequency) * i);
          dueDate.setDate(now.getDate() + daysOffset);
        }

        const newTask = {
          id: randomUUID(),
          name: `${qcTask.templateSiteAsset?.name || "Asset"} - Posting ${i + 1}/${requiredFrequency}`,
          assignmentId: qcTask.assignmentId,
          clientId: qcTask.clientId,
          templateSiteAssetId: qcTask.templateSiteAssetId,
          categoryId: postingCategory.id,
          dueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes,
          notes: `[AUTO-GENERATED] Triggered by QC Task: ${qcTask.name}\nFrequency: ${requiredFrequency}/${period}\nClient Override: ${assetSetting ? "Yes" : "No (using default)"}`,
        };

        const created = await tx.task.create({ data: newTask });
        postingTasks.push(created);
      }

      // 6) Update QC task with note about posting generation
      await tx.task.update({
        where: { id: taskId },
        data: {
          notes: `${qcTask.notes || ""}\n\n[POSTING TRIGGERED] Generated ${requiredFrequency} posting tasks at ${now.toISOString()}`,
        },
      });

      // 7) Activity log
      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "Task",
          entityId: taskId,
          userId: actorId || null,
          action: "trigger_posting",
          details: {
            qcTaskId: taskId,
            qcTaskName: qcTask.name,
            assetId: qcTask.templateSiteAssetId,
            assetName: qcTask.templateSiteAsset?.name,
            assignmentId: qcTask.assignmentId,
            clientId: qcTask.clientId,
            clientName: qcTask.assignment?.client?.name,
            postingTasksCreated: postingTasks.length,
            requiredFrequency,
            period,
            clientSpecificOverride: !!assetSetting,
            taskIds: postingTasks.map((t) => t.id),
          },
        },
      });

      return {
        message: `Successfully generated ${postingTasks.length} posting tasks`,
        qcTask: {
          id: qcTask.id,
          name: qcTask.name,
        },
        postingTasks: postingTasks.map((t) => ({
          id: t.id,
          name: t.name,
          dueDate: t.dueDate,
        })),
        settings: {
          requiredFrequency,
          period,
          idealDurationMinutes,
          clientOverride: !!assetSetting,
        },
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error?.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }
    if (error?.message === "NOT_A_QC_TASK") {
      return NextResponse.json(
        { message: "Task is not a QC task" },
        { status: 400 }
      );
    }
    if (error?.message === "QC_NOT_APPROVED") {
      return NextResponse.json(
        { message: "QC task is not approved/completed" },
        { status: 400 }
      );
    }
    if (error?.message === "NO_ASSET_LINKED") {
      return NextResponse.json(
        { message: "Task has no linked site asset" },
        { status: 400 }
      );
    }
    if (error?.message === "NO_ASSIGNMENT_LINKED") {
      return NextResponse.json(
        { message: "Task has no linked assignment" },
        { status: 400 }
      );
    }
    console.error("Trigger posting error:", error);
    return NextResponse.json(
      {
        message: "Failed to trigger posting tasks",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/{taskId}/trigger-posting
 * Preview what posting tasks would be generated (without actually creating them)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const qcTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignment: {
          include: {
            client: true,
            siteAssetSettings: true,
          },
        },
        templateSiteAsset: true,
        category: true,
      },
    });

    if (!qcTask) {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }

    if (!qcTask.templateSiteAssetId) {
      return NextResponse.json(
        { message: "Task has no linked site asset" },
        { status: 400 }
      );
    }

    const assetSetting = qcTask.assignment?.siteAssetSettings?.find(
      (s) => s.templateSiteAssetId === qcTask.templateSiteAssetId
    );

    const requiredFrequency =
      assetSetting?.requiredFrequency ??
      qcTask.templateSiteAsset?.defaultPostingFrequency ??
      4;

    const period = assetSetting?.period ?? PeriodType.monthly;

    const existingPostingTasks = await prisma.task.count({
      where: {
        assignmentId: qcTask.assignmentId,
        templateSiteAssetId: qcTask.templateSiteAssetId,
        category: {
          name: {
            contains: "posting",
            mode: "insensitive",
          },
        },
        status: {
          notIn: [TaskStatus.cancelled],
        },
      },
    });

    return NextResponse.json({
      qcTask: {
        id: qcTask.id,
        name: qcTask.name,
        status: qcTask.status,
        isQcTask: qcTask.category?.name?.toLowerCase().includes("qc"),
      },
      preview: {
        postingTasksToCreate: requiredFrequency,
        requiredFrequency,
        period,
        clientOverride: !!assetSetting,
        existingPostingTasks,
        canTrigger:
          qcTask.status === TaskStatus.completed &&
          existingPostingTasks === 0,
      },
    });
  } catch (error: any) {
    console.error("Preview posting error:", error);
    return NextResponse.json(
      {
        message: "Failed to preview posting tasks",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
