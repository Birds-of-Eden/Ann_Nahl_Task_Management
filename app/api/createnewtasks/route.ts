// app/api/createnewtasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

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
    const dueDateRaw: string | undefined = body?.dueDate;
    const siteAssetTypesRaw: string[] | undefined = body?.siteAssetTypes;
    console.log("[create-manual-tasks] Incoming:", {
      clientId,
      dueDateRaw,
      siteAssetTypesRaw,
    });

    // Validation
    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    // We always create a single cycle; ignore provided cycleCount

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

    const cycleCount = 1;

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

    // Find assignment for this client (need templateId to load template assets)
    const assignment = await prisma.assignment.findFirst({
      where: { clientId },
      orderBy: { assignedAt: "desc" },
      select: { id: true, templateId: true },
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
      image_optimization: "Image Optimization",
      aws_upload: "AWS Upload",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed.com",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      guest_posting: "Guest Posting",
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

    const typeLabels: Record<string, string> = {
      social_site: "Social Site",
      web2_site: "Web2 Site",
      other_asset: "Other Asset",
      graphics_design: "Graphics Design",
      image_optimization: "Image Optimization",
      aws_upload: "AWS Upload",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed.com",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      guest_posting: "Guest Posting",
    };
    // Load all template site assets for this assignment's template filtered by selected types
    if (!assignment.templateId) {
      return NextResponse.json(
        { message: "Assignment has no templateId; cannot resolve template assets" },
        { status: 400 }
      );
    }
    const templateAssets = await prisma.templateSiteAsset.findMany({
      where: {
        templateId: assignment.templateId,
        type: { in: siteAssetTypes as any },
      },
      select: {
        id: true,
        name: true,
        type: true,
        defaultIdealDurationMinutes: true,
      },
    });
    console.log("[create-manual-tasks] Template assets fetched:", templateAssets.length);

    // Build payloads ensuring unique names per asset by incrementing numeric suffix
    const payloads: Array<{
      id: string;
      name: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: string;
      assignment: { connect: { id: string } };
      client: { connect: { id: string } };
      category: { connect: { id: string } };
      templateSiteAsset: { connect: { id: number } };
      idealDurationMinutes?: number | null;
    }> = [];

    for (const asset of templateAssets) {
      const label = asset.name || typeLabels[asset.type as any] || String(asset.type);
      const prefix = `${label} -`;
      const existingForAsset = await prisma.task.findMany({
        where: {
          assignmentId: assignment.id,
          templateSiteAssetId: asset.id,
          name: { startsWith: prefix },
        },
        select: { name: true },
      });
      const nums = existingForAsset
        .map((t) => {
          const m = t.name.match(/-(\d+)\s*$/);
          return m ? Number(m[1]) : null;
        })
        .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      const name = `${label} -${next}`;
      console.log("[create-manual-tasks] Naming decision (asset):", { assetId: asset.id, label, next, name });

      const categoryId = categoryIdByType.get(asset.type as any)!;
      payloads.push({
        id: makeId(),
        name,
        status: "pending" as TaskStatus,
        priority: "medium" as TaskPriority,
        dueDate: baseDueDate.toISOString(),
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: categoryId } },
        templateSiteAsset: { connect: { id: asset.id } },
        idealDurationMinutes: asset.defaultIdealDurationMinutes ?? undefined,
      });
    }
    console.log("[create-manual-tasks] Payload count:", payloads.length);

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
    console.log("[create-manual-tasks] Created:", created.length);

    console.log("[create-manual-tasks] Debug logging: created tasks", created);

    return NextResponse.json(
      {
        message: `Created ${created.length} manual task(s)`,
        created: created.length,
        skipped: 0,
        assignmentId: assignment.id,
        tasks: created,
        runtime: "nodejs",
      },
      { status: 201 }
    );
  } catch (err) {
    console.log("[create-manual-tasks] Debug logging: error", err);
    return fail("POST.catch", err);
  }
}