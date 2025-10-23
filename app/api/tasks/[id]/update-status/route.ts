// app/api/tasks/[id]/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";

/**
 * 🎯 Update Task Status (Manual Control)
 * 
 * PATCH /api/tasks/{taskId}/update-status
 * Body: { 
 *   status: TaskStatus,
 *   actorId?: string,
 *   notes?: string
 * }
 * 
 * Note: Posting task generation is MANUAL only.
 * Use /api/tasks/{taskId}/trigger-posting to create posting tasks.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const {
      status,
      actorId,
      notes,
    } = body as {
      status: TaskStatus;
      actorId?: string;
      notes?: string;
    };

    if (!status) {
      return NextResponse.json(
        { message: "status is required" },
        { status: 400 }
      );
    }

    // Validate status enum
    if (!Object.values(TaskStatus).includes(status)) {
      return NextResponse.json(
        { message: "Invalid status value" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load current task
      const currentTask = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          category: true,
          templateSiteAsset: true,
          assignment: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!currentTask) {
        throw new Error("TASK_NOT_FOUND");
      }

      const oldStatus = currentTask.status;

      // 2) Update task status
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status,
          notes: notes ? `${currentTask.notes || ""}\n\n${notes}` : currentTask.notes,
        },
        include: {
          category: true,
          templateSiteAsset: true,
          assignment: {
            include: {
              client: true,
            },
          },
        },
      });

      // 3) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Task",
          entityId: taskId,
          userId: actorId || null,
          action: "update_status",
          details: {
            taskId,
            taskName: currentTask.name,
            oldStatus,
            newStatus: status,
            assignmentId: currentTask.assignmentId,
            clientId: currentTask.clientId,
            clientName: currentTask.assignment?.client?.name,
          },
        },
      });

      return {
        task: updatedTask,
        statusChange: {
          from: oldStatus,
          to: status,
        },
      };
    });

    return NextResponse.json(
      {
        message: "Task status updated successfully",
        ...result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.message === "TASK_NOT_FOUND") {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }
    console.error("Update status error:", error);
    return NextResponse.json(
      {
        message: "Failed to update task status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/{taskId}/update-status
 * Get current task status and preview what auto-triggers would fire
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        category: true,
        templateSiteAsset: true,
        assignment: {
          include: {
            client: true,
            siteAssetSettings: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { message: "Task not found" },
        { status: 404 }
      );
    }

    const isQcTask =
      task.category?.name?.toLowerCase().includes("qc") ||
      task.category?.name?.toLowerCase().includes("quality");

    let postingPreview = null;
    if (isQcTask && task.templateSiteAssetId) {
      const assetSetting = task.assignment?.siteAssetSettings?.find(
        (s) => s.templateSiteAssetId === task.templateSiteAssetId
      );

      const requiredFrequency =
        assetSetting?.requiredFrequency ??
        task.templateSiteAsset?.defaultPostingFrequency ??
        4;

      postingPreview = {
        wouldTriggerPosting: task.status !== TaskStatus.completed,
        postingTasksToCreate: requiredFrequency,
        clientOverride: !!assetSetting,
      };
    }

    return NextResponse.json({
      task: {
        id: task.id,
        name: task.name,
        status: task.status,
        categoryName: task.category?.name,
      },
      isQcTask,
      autoTriggers: {
        postingPreview,
      },
    });
  } catch (error: any) {
    console.error("Get status error:", error);
    return NextResponse.json(
      {
        message: "Failed to get task status",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
