// app/api/tasks/create-posting-tasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculateTaskDueDate, extractCycleNumber } from "@/utils/working-days";

// ---------- Constants ----------
const ALLOWED_ASSET_TYPES = [
  "social_site",
  "web2_site",
  "other_asset",
] as const;
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";

// 👉 NEW
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;

// ---------- Helpers ----------
function normalizeTaskPriority(v: unknown): TaskPriority {
  switch (String(v ?? "").toLowerCase()) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "urgent":
      return "urgent";
    default:
      return "medium";
  }
}

function resolveCategoryFromType(assetType?: string): string {
  if (!assetType) return CAT_SOCIAL_ACTIVITY;
  if (assetType === "web2_site") return CAT_BLOG_POSTING;
  return CAT_SOCIAL_ACTIVITY; // social_site + other_asset
}

function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
}

function getFrequency(opts: {
  required?: number | null | undefined;
  defaultFreq?: number | null | undefined;
}): number {
  const fromRequired = Number(opts.required);
  if (Number.isFinite(fromRequired) && fromRequired! > 0)
    return Math.floor(fromRequired);
  const fromDefault = Number(opts.defaultFreq);
  if (Number.isFinite(fromDefault) && fromDefault! > 0)
    return Math.floor(fromDefault);
  return 1;
}

function countByStatus(tasks: { status: TaskStatus }[]) {
  const base: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
    paused: 0,
    data_entered: 0,
  };
  for (const t of tasks) base[t.status] += 1;
  return base;
}

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
  console.error(`[create-posting-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// Node 18+ has global crypto.randomUUID()
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

// ---------- GET: preview ----------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const templateIdRaw = searchParams.get("templateId") ?? undefined;
    const onlyType = searchParams.get("onlyType") ?? undefined;

    if (!clientId)
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );

    // Quick DB preflight (surfaces P1001/P1017 immediately)
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("GET.db-preflight", e);
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        package: { select: { totalMonths: true } },
      },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // months = normalized package months (min 1; capped to avoid accidents)
    const packageTotalMonthsRaw = Number(client.package?.totalMonths ?? 1);
    const packageTotalMonths =
      Number.isFinite(packageTotalMonthsRaw) && packageTotalMonthsRaw > 0
        ? Math.min(Math.floor(packageTotalMonthsRaw), 120)
        : 1;

    const templateId =
      templateIdRaw === "none" || templateIdRaw === "" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: {
        clientId,
        ...(templateIdRaw !== undefined
          ? { templateId: templateId ?? undefined }
          : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create one first.",
        },
        { status: 404 }
      );
    }

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        templateSiteAsset: {
          is: {
            ...(onlyType
              ? { type: onlyType as any }
              : { type: { in: ALLOWED_ASSET_TYPES as unknown as string[] } }),
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        templateSiteAsset: {
          select: { id: true, type: true, defaultPostingFrequency: true },
        },
      },
    });

    const countsByStatus = countByStatus(sourceTasks as any);
    const allApproved =
      sourceTasks.length > 0 &&
      sourceTasks.every((t) => t.status === "qc_approved");

    const assetIds = Array.from(
      new Set(
        sourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => typeof v === "number")
      )
    );
    const settings = assetIds.length
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: {
            assignmentId: assignment.id,
            templateSiteAssetId: { in: assetIds },
          },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings)
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);

    const tasks = sourceTasks.map((src) => {
      const assetId = src.templateSiteAsset?.id;
      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });
      const assetType = src.templateSiteAsset?.type;
      return {
        id: src.id,
        name: src.name,
        baseName: baseNameOf(src.name),
        status: src.status,
        priority: src.priority,
        assetType,
        // 👇 multiply original frequency by package months
        frequency: freq * packageTotalMonths,
        categoryName: resolveCategoryFromType(assetType),
      };
    });

    // --- NEW: Build Social Communication previews ---

    // social_site + other_asset: প্রতি অ্যাসেটে ১টা করে SC
    const scAssetSources = sourceTasks.filter((s) => {
      const t = s.templateSiteAsset?.type;
      return t === "social_site" || t === "other_asset";
    });

    const scFromAssets = scAssetSources.map((src) => ({
      id: `${src.id}::sc-asset`,
      name: `${baseNameOf(src.name) || "Social"} - ${CAT_SOCIAL_COMMUNICATION}`,
      baseName: baseNameOf(src.name) || "Social",
      status: src.status,
      priority: src.priority,
      assetType: (src.templateSiteAsset?.type ?? "other_asset") as
        | "social_site"
        | "other_asset",
      frequency: 1,
      categoryName: CAT_SOCIAL_COMMUNICATION,
    }));

    // ফিক্সড ৩টা web2 প্ল্যাটফর্ম (অবিকল আগের মতোই)
    const scFromWeb2Fixed = WEB2_FIXED_PLATFORMS.map((p) => ({
      id: `sc-web2-${p}`,
      name: `${
        p.charAt(0).toUpperCase() + p.slice(1)
      } - ${CAT_SOCIAL_COMMUNICATION}`,
      baseName: p.charAt(0).toUpperCase() + p.slice(1),
      status: "qc_approved" as TaskStatus,
      priority: "medium" as const,
      assetType: "web2_site" as const,
      frequency: 1,
      categoryName: CAT_SOCIAL_COMMUNICATION,
    }));

    // আগের + নতুন SC প্রিভিউ একসাথে
    const tasksWithSC = [...tasks, ...scFromAssets, ...scFromWeb2Fixed];

    const totalWillCreate = tasksWithSC.reduce(
      (acc, t) => acc + (t.frequency ?? 1),
      0
    );

    return NextResponse.json({
      message: "Preview of source tasks for copying.",
      assignmentId: assignment.id,
      tasks: tasksWithSC,
      countsByStatus,
      allApproved,
      totalWillCreate,
      packageTotalMonths, // 👈 added
      runtime: "nodejs",
    });
  } catch (err) {
    return fail("GET.catch", err);
  }
}