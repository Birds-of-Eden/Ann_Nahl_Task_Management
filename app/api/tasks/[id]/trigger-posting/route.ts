// app/api/tasks/[id]/trigger-posting/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TaskStatus, TaskPriority, PeriodType } from "@prisma/client";
import { randomUUID } from "crypto";
import { calculateTaskDueDate, extractCycleNumber } from "@/utils/working-days";

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

  console.log(`📥 Trigger-posting called for task: ${taskId}`);

  try {
    const body = await request.json().catch(() => ({}));
    const { actorId, forceOverride = false } = body as {
      actorId?: string;
      forceOverride?: boolean;
    };

    console.log(`📝 Request body:`, { actorId, forceOverride });

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load the QC task with full context + package info
      const qcTask = await tx.task.findUnique({
        where: { id: taskId },
        include: {
          assignment: {
            include: {
              client: {
                include: {
                  package: {
                    select: { totalMonths: true },
                  },
                },
              },
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
        console.error(`❌ Task not found: ${taskId}`);
        throw new Error("TASK_NOT_FOUND");
      }

      console.log(`✅ Task loaded:`, {
        id: qcTask.id,
        name: qcTask.name,
        status: qcTask.status,
        category: qcTask.category?.name,
        templateSiteAssetId: qcTask.templateSiteAssetId,
        assignmentId: qcTask.assignmentId,
      });

      // Verify this is a task that should generate posting tasks
      const taskCategoryName = qcTask.category?.name?.toLowerCase() || "";

      const shouldGeneratePosting =
        taskCategoryName.includes("qc") ||
        taskCategoryName.includes("quality") ||
        taskCategoryName.includes("asset creation") ||
        taskCategoryName.includes("social asset") ||
        taskCategoryName.includes("web2") ||
        taskCategoryName.includes("content writing") ||
        taskCategoryName.includes("graphics");

      console.log(
        `🔍 Should generate posting: ${shouldGeneratePosting} (category: ${qcTask.category?.name})`
      );

      if (!shouldGeneratePosting) {
        throw new Error("NOT_ELIGIBLE_FOR_POSTING");
      }

      // Verify QC task is approved/completed
      const isApproved =
        qcTask.status === TaskStatus.completed ||
        qcTask.status === ("qc_approved" as any) ||
        (qcTask.status as string)?.toLowerCase().includes("approved");

      console.log(`✓ Is approved: ${isApproved} (status: ${qcTask.status})`);

      if (!isApproved) {
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

      // 🆕 Get package totalMonths for multiplication
      const packageMonthsRaw = Number(
        qcTask.assignment?.client?.package?.totalMonths ?? 1
      );
      const packageMonths =
        Number.isFinite(packageMonthsRaw) && packageMonthsRaw > 0
          ? Math.min(Math.floor(packageMonthsRaw), 120)
          : 1;

      // 🆕 Total tasks = frequency × package months (same as regular system)
      const totalTasksToCreate = Math.max(1, requiredFrequency * packageMonths);

      console.log(`📊 Posting settings:`, {
        requiredFrequency,
        packageMonths,
        totalTasksToCreate,
        idealDurationMinutes,
        period,
        hasClientOverride: !!assetSetting,
      });

      // 3) Check if posting tasks already exist (check Social Activity/Blog Posting)
      if (!forceOverride) {
        const existingPostingTasks = await tx.task.findMany({
          where: {
            assignmentId: qcTask.assignmentId,
            templateSiteAssetId: qcTask.templateSiteAssetId,
            category: {
              name: {
                in: ["Social Activity", "Blog Posting"],
              },
            },
            status: {
              notIn: [TaskStatus.cancelled],
            },
          },
        });

        console.log(
          `🔍 Existing posting tasks: ${existingPostingTasks.length}`
        );

        if (existingPostingTasks.length > 0) {
          console.log(`⏭️ Skipping: Posting tasks already exist`);
          return {
            message: "Posting tasks already exist for this asset",
            existingTasks: existingPostingTasks,
            skipped: true,
          };
        }
      } else {
        console.log(`🔄 Force override enabled, will create anyway`);
      }

      // 4) 🆕 Resolve category based on asset type (same as regular system)
      const assetType = qcTask.templateSiteAsset?.type;
      const categoryName =
        assetType === "web2_site" ? "Blog Posting" : "Social Activity";

      console.log(`🔍 Asset Type Detection:`, {
        assetId: qcTask.templateSiteAssetId,
        assetName: qcTask.templateSiteAsset?.name,
        assetType: assetType,
        resolvedCategory: categoryName,
      });

      // Ensure category exists
      const ensureCategory = async (name: string) => {
        const found = await tx.taskCategory.findFirst({
          where: { name },
          select: { id: true, name: true },
        });
        if (found) {
          console.log(`✅ Found existing category: ${name} (${found.id})`);
          return found;
        }
        try {
          const created = await tx.taskCategory.create({
            data: { name },
            select: { id: true, name: true },
          });
          console.log(`✅ Created new category: ${name} (${created.id})`);
          return created;
        } catch (e) {
          console.warn(`⚠️ Category creation failed, retrying find for: ${name}`);
          const again = await tx.taskCategory.findFirst({
            where: { name },
            select: { id: true, name: true },
          });
          if (again) return again;
          throw e;
        }
      };

      const postingCategory = await ensureCategory(categoryName);

      console.log(`✅ Category resolved: ${categoryName} (ID: ${postingCategory.id})`);

      // 5) 🆕 Generate posting tasks: frequency × package months
      // Use source task creation time as anchor (same as regular system)
      const anchor = qcTask.createdAt || new Date();
      const postingTasks = [];

      console.log(`🚀 Creating ${totalTasksToCreate} posting tasks (${requiredFrequency}/month × ${packageMonths} months)...`);
      console.log(`📅 Using working-days calculation: 1st cycle=10 days, subsequent=+5 days each`);

      for (let i = 0; i < totalTasksToCreate; i++) {
        // 🆕 Calculate due date using working-days utility (same as regular system)
        const cycleNumber = i + 1;
        const dueDate = calculateTaskDueDate(anchor, cycleNumber);

        const taskName = `${qcTask.templateSiteAsset?.name || "Asset"} -${cycleNumber}`;
        
        const newTask = {
          id: randomUUID(),
          name: taskName,
          assignmentId: qcTask.assignmentId,
          clientId: qcTask.clientId,
          templateSiteAssetId: qcTask.templateSiteAssetId,
          categoryId: postingCategory.id,  // ✅ This should be Social Activity or Blog Posting
          dueDate: dueDate.toISOString(),  // Convert to ISO string for Prisma
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes,
          notes: `[AUTO-GENERATED] Triggered by QC Task: ${
            qcTask.name
          }\nFrequency: ${requiredFrequency}/${period} × ${packageMonths} months = ${totalTasksToCreate} tasks\nCycle: ${cycleNumber}\nDue Date: Calculated using working-days (excludes weekends)\nClient Override: ${
            assetSetting ? "Yes" : "No (using default)"
          }`,
        };

        const created = await tx.task.create({ data: newTask });
        postingTasks.push(created);
        
        // Verify category was set correctly
        const verifyCategory = await tx.taskCategory.findUnique({
          where: { id: created.categoryId || "" },
          select: { name: true },
        });
        
        console.log(`  ✅ Created: ${created.name} | Category: ${verifyCategory?.name || "Unknown"} | ID: ${created.id}`);
      }

      console.log(
        `🎉 Successfully created ${postingTasks.length} posting tasks!`
      );

      // 6) Update QC task with note about posting generation
      await tx.task.update({
        where: { id: taskId },
        data: {
          notes: `${
            qcTask.notes || ""
          }\n\n[POSTING TRIGGERED] Generated ${totalTasksToCreate} posting tasks at ${new Date().toISOString()}\nCategory: ${categoryName}\nUsing working-days calculation`,
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
            assetType: qcTask.templateSiteAsset?.type,
            assignmentId: qcTask.assignmentId,
            clientId: qcTask.clientId,
            clientName: qcTask.assignment?.client?.name,
            postingTasksCreated: postingTasks.length,
            requiredFrequency,
            packageMonths,
            totalTasks: totalTasksToCreate,
            category: categoryName,  // ✅ Log which category was used
            period,
            dueDateCalculation: "working-days",  // ✅ Log calculation method
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
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
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
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
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
          qcTask.status === TaskStatus.completed && existingPostingTasks === 0,
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
