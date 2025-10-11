// app/api/createnewtasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculateTaskDueDate } from "@/utils/working-days";

// Node 18+ has global crypto.randomUUID()
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

function safeErr(err: unknown) {
  const anyErr = err as any;
  return {
    name: anyErr?.name ?? null,
    code: anyErr?.code ?? null,
    message: anyErr?.message ?? String(anyErr),
    meta: anyErr?.meta ?? null,
  };
}

function fail(stage: string, err: unknown, http = 500) {
  const e = safeErr(err);
  console.error(`[create-manual-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// POST: create manual tasks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const cycleCountRaw: number | undefined = body?.cycleCount;
    const dueDateRaw: string | undefined = body?.dueDate;
    const siteAssetTypesRaw: string[] | undefined = body?.siteAssetTypes;

    // Validation
    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    if (!cycleCountRaw || cycleCountRaw < 1 || cycleCountRaw > 100) {
      return NextResponse.json(
        { message: "cycleCount must be between 1 and 100" },
        { status: 400 }
      );
    }

    if (!dueDateRaw) {
      return NextResponse.json(
        { message: "dueDate is required" },
        { status: 400 }
      );
    }

    if (!siteAssetTypesRaw || siteAssetTypesRaw.length === 0) {
      return NextResponse.json(
        { message: "At least one site asset type must be selected" },
        { status: 400 }
      );
    }

    const cycleCount = Math.floor(cycleCountRaw);
    const baseDueDate = new Date(dueDateRaw);
    const siteAssetTypes = siteAssetTypesRaw;

    if (Number.isNaN(baseDueDate.getTime())) {
      return NextResponse.json(
        { message: "Invalid dueDate format" },
        { status: 400 }
      );
    }

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    // Find assignment for this client
    const assignment = await prisma.assignment.findFirst({
      where: { clientId },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create an assignment first.",
        },
        { status: 404 }
      );
    }

    // Ensure categories for each site asset type
    const categoryMappings: Record<string, string> = {
      social_site: "Social Activity",
      web2_site: "Blog Posting",
      other_asset: "Social Activity",
      graphics_design: "Graphics Design",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed.com",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      monthly_report: "Monthly Report",
    };

    const ensureCategory = async (name: string) => {
      const found = await prisma.taskCategory.findFirst({
        where: { name },
        select: { id: true, name: true },
      });
      if (found) return found;
      try {
        return await prisma.taskCategory.create({
          data: { name },
          select: { id: true, name: true },
        });
      } catch (e) {
        const again = await prisma.taskCategory.findFirst({
          where: { name },
          select: { id: true, name: true },
        });
        if (again) return again;
        throw e;
      }
    };

    // Create categories for all selected site asset types
    const categoryPromises = siteAssetTypes.map(type =>
      ensureCategory(categoryMappings[type] || "General")
    );
    const categories = await Promise.all(categoryPromises);
    const categoryIdByType = new Map(
      siteAssetTypes.map((type, index) => [type, categories[index].id])
    );

    // Generate task names to check for duplicates
    const taskNames: string[] = [];
    const typeLabels: Record<string, string> = {
      social_site: "Social Site",
      web2_site: "Web2 Site",
      other_asset: "Other Asset",
      graphics_design: "Graphics Design",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed.com",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      monthly_report: "Monthly Report",
    };

    for (const type of siteAssetTypes) {
      const label = typeLabels[type] || type;
      for (let i = 1; i <= cycleCount; i++) {
        taskNames.push(`${label} -${i}`);
      }
    }

    // Check for existing tasks with these names
    const existingTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        name: { in: taskNames },
      },
      select: { name: true },
    });

    const skipNameSet = new Set(existingTasks.map((t) => t.name));
    const tasksToCreate: Array<{
      name: string;
      siteAssetType: string;
      cycleNumber: number;
    }> = [];

    for (const type of siteAssetTypes) {
      const label = typeLabels[type] || type;
      for (let i = 1; i <= cycleCount; i++) {
        const taskName = `${label} -${i}`;
        if (!skipNameSet.has(taskName)) {
          tasksToCreate.push({
            name: taskName,
            siteAssetType: type,
            cycleNumber: i,
          });
        }
      }
    }

    if (tasksToCreate.length === 0) {
      return NextResponse.json(
        {
          message: "All manual tasks already exist",
          created: 0,
          skipped: taskNames.length,
          assignmentId: assignment.id,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Create the tasks
    const payloads = tasksToCreate.map(({ name, siteAssetType, cycleNumber }) => {
      // Calculate due date for each cycle
      let dueDate: Date;

      if (cycleNumber === 1) {
        // First cycle uses the selected due date exactly
        dueDate = baseDueDate;
      } else {
        // Subsequent cycles are 5 working days apart from the first cycle
        dueDate = calculateTaskDueDate(baseDueDate, cycleNumber);
      }

      return {
        id: makeId(),
        name,
        status: "pending" as TaskStatus,
        priority: "medium" as TaskPriority,
        dueDate: dueDate.toISOString(),
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: categoryIdByType.get(siteAssetType)! } },
      };
    });

    // Create tasks in a transaction
    const created = await prisma.$transaction((tx) =>
      Promise.all(
        payloads.map((data) =>
          tx.task.create({
            data,
            select: {
              id: true,
              name: true,
              status: true,
              priority: true,
              createdAt: true,
              dueDate: true,
              assignment: { select: { id: true } },
              category: { select: { id: true, name: true } },
            },
          })
        )
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} manual task(s)`,
        created: created.length,
        skipped: skipNameSet.size,
        assignmentId: assignment.id,
        tasks: created,
        runtime: "nodejs",
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}