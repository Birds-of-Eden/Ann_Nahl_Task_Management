// app/api/tasks/data-entry-reports/route.ts
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

// ---------- GET: data-entry-reports ----------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const pageSize = Number(searchParams.get("pageSize") ?? 100);
    const completedByUserId = searchParams.get("completedByUserId") ?? undefined;

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

    const rows = await prisma.task.findMany({
      where: {
        assignment: { clientId },
        ...(completedByUserId
          ? {
              // Prisma JSON filtering
              dataEntryReport: {
                path: ["completedByUserId"],
                equals: completedByUserId,
              } as any,
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        category: { select: { name: true } },
        dataEntryReport: true,
        completedAt: true,
        assignedTo: { select: { id: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: Math.max(1, Math.min(pageSize, 2000)),
    });

    // Map to data-entry oriented shape expected by the client panel
    const data = rows.map((t) => {
      const report: any = t.dataEntryReport ?? null;
      const dataEntryCompletedAt: string | null =
        (report?.completedBy as string) || null;
      const isCompletedByJson = Boolean(report?.completedByUserId);
      const dataEntryStatus = isCompletedByJson ? "completed" : "pending";
      return {
        id: t.id,
        name: t.name,
        taskPriority: t.priority,
        taskStatus: t.status,
        categoryName: t.category?.name ?? null,
        dataEntryReport: report,
        dataEntryStatus,
        dataEntryCompletedAt,
        assignedToId: t.assignedTo?.id ?? null,
      };
    });

    // Aggregations
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const d of data) {
      byStatus[d.dataEntryStatus] = (byStatus[d.dataEntryStatus] || 0) + 1;
      byPriority[d.taskPriority] = (byPriority[d.taskPriority] || 0) + 1;
    }

    return NextResponse.json({
      message: "Data Entry reports",
      data,
      counts: {
        total: data.length,
        completed: byStatus["completed"] ?? 0,
        byStatus,
        byPriority,
      },
      runtime: "nodejs",
    });
  } catch (err) {
    return fail("GET.catch", err);
  }
}