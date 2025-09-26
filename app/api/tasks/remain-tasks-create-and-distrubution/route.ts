// app/api/tasks/remain-tasks-create-and-distrubution/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus, SiteAssetType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculateTaskDueDate, extractCycleNumber } from "@/utils/working-days";

// ---------- Constants ----------
const ALLOWED_ASSET_TYPES: SiteAssetType[] = [
  "social_site",
  "web2_site",
  "other_asset",
];
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";

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

function resolveCategoryFromType(assetType?: SiteAssetType | null): string {
  if (!assetType) return CAT_SOCIAL_ACTIVITY;
  if (assetType === "web2_site") return CAT_BLOG_POSTING;
  return CAT_SOCIAL_ACTIVITY;
}

function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
}

function computeRemainingMonths(dueDate: Date | null | undefined, now: Date, maxCap?: number): number {
  if (!dueDate) return maxCap && maxCap > 0 ? Math.min(1, maxCap) : 1;
  
  const d = new Date(dueDate);
  if (d < now) return 0;
  
  const yDiff = d.getFullYear() - now.getFullYear();
  const mDiff = d.getMonth() - now.getMonth();
  let months = yDiff * 12 + mDiff;
  
  if (d.getDate() >= now.getDate()) {
    months += 1;
  }
  
  if (months < 1) months = 1;
  if (typeof maxCap === "number" && maxCap > 0) {
    months = Math.min(months, Math.floor(maxCap));
  }
  
  return months;
}

function getFrequency(opts: {
  required?: number | null | undefined;
  defaultFreq?: number | null | undefined;
}): number {
  const fromRequired = Number(opts.required);
  if (Number.isFinite(fromRequired) && fromRequired > 0)
    return Math.floor(fromRequired);
  const fromDefault = Number(opts.defaultFreq);
  if (Number.isFinite(fromDefault) && fromDefault > 0)
    return Math.floor(fromDefault);
  return 1;
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
  console.error(`[remain-tasks-create-and-distrubution] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

// Helper to find agent with most assignments for this client
async function findTopAgentForClient(clientId: string) {
  try {
    // Find the agent who has the most tasks assigned for this client
    const agentTaskCounts = await prisma.task.groupBy({
      by: ['assignedToId'],
      where: {
        clientId: clientId,
        assignedToId: { not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 1
    });

    if (agentTaskCounts.length > 0 && agentTaskCounts[0].assignedToId) {
      const topAgentId = agentTaskCounts[0].assignedToId;
      
      // Get agent details
      const agent = await prisma.user.findUnique({
        where: { id: topAgentId },
        select: { id: true, name: true, email: true }
      });
      
      return agent;
    }

    // If no agent found with existing tasks, find any available agent with specific roles
    const availableAgent = await prisma.user.findFirst({
      where: {
        role: {
          name: { in: ['agent', 'data_entry', 'staff'] }
        }
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: 'asc' }
    });

    return availableAgent;
  } catch (error) {
    console.error('Error finding top agent:', error);
    return null;
  }
}

// ---------- POST: create remaining tasks and distribute to top agent ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;

    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    // Find top agent for this client
    const topAgent = await findTopAgentForClient(clientId);
    if (!topAgent) {
      return NextResponse.json(
        { message: "No available agent found to assign tasks" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        package: { select: { totalMonths: true } },
        startDate: true,
        dueDate: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.dueDate) {
      return NextResponse.json(
        { message: "Client due date is required for future task generation" },
        { status: 400 }
      );
    }

    // Calculate remaining months
    const now = new Date();
    const remainingMonths = computeRemainingMonths(client.dueDate, now);

    if (remainingMonths === 0) {
      return NextResponse.json(
        { message: "Client due date has already passed. No future tasks to generate." },
        { status: 400 }
      );
    }

    const assignment = await prisma.assignment.findFirst({
      where: { clientId },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    
    if (!assignment) {
      return NextResponse.json(
        { message: "No existing assignment found for this client." },
        { status: 404 }
      );
    }

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        templateSiteAsset: {
          type: { in: ALLOWED_ASSET_TYPES }
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
        createdAt: true,
        templateSiteAsset: {
          select: { id: true, type: true, defaultPostingFrequency: true },
        },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json(
        { message: "No source tasks found to copy.", tasks: [] },
        { status: 200 }
      );
    }

    // QC gate - only use approved tasks
    const notApproved = sourceTasks.filter((t) => t.status !== "qc_approved");
    if (notApproved.length) {
      return NextResponse.json(
        {
          message: "All source tasks must be 'qc_approved' before creating posting tasks.",
          notApprovedTaskIds: notApproved.map((t) => t.id),
        },
        { status: 400 }
      );
    }

    // Per-asset frequency overrides
    const assetIds = Array.from(
      new Set(
        sourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => v !== undefined && v !== null)
      )
    );
    
    const settings = assetIds.length > 0
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: {
            assignmentId: assignment.id,
            templateSiteAssetId: { in: assetIds },
          },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
      
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings) {
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);
    }

    // Ensure categories
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

    const [socialCat, blogCat, scCat] = await Promise.all([
      ensureCategory(CAT_SOCIAL_ACTIVITY),
      ensureCategory(CAT_BLOG_POSTING),
      ensureCategory(CAT_SOCIAL_COMMUNICATION),
    ]);
    
    const categoryIdByName = new Map<string, string>([
      [socialCat.name, socialCat.id],
      [blogCat.name, blogCat.id],
      [scCat.name, scCat.id],
    ]);

    // Expand copies for remaining months
    const expandedCopies: {
      src: (typeof sourceTasks)[number];
      name: string;
      catName: string;
    }[] = [];

    const lastCycleDueByBase = new Map<string, Date>();

    for (const src of sourceTasks) {
      const assetType = src.templateSiteAsset?.type;
      const assetId = src.templateSiteAsset?.id;

      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });

      const catName = resolveCategoryFromType(assetType);
      const base = baseNameOf(src.name);

      const totalCopies = Math.max(0, Math.floor(freq * remainingMonths));
      if (totalCopies === 0) continue;
      
      for (let i = 1; i <= totalCopies; i++) {
        expandedCopies.push({ 
          src, 
          catName, 
          name: `${base} -${i}` 
        });
      }

      if (catName === CAT_SOCIAL_ACTIVITY) {
        const anchor = now;
        const lastDue = calculateTaskDueDate(anchor, totalCopies);
        lastCycleDueByBase.set(base, lastDue);
      }
    }

    // Check for existing tasks to avoid duplicates
    const namesToCheck = expandedCopies.map((e) => e.name);
    const existingCopies = namesToCheck.length > 0
      ? await prisma.task.findMany({
          where: {
            assignmentId: assignment.id,
            name: { in: namesToCheck },
            category: {
              name: {
                in: [CAT_SOCIAL_ACTIVITY, CAT_BLOG_POSTING, CAT_SOCIAL_COMMUNICATION],
              },
            },
          },
          select: { name: true },
        })
      : [];
    
    const skipNameSet = new Set(existingCopies.map((t) => t.name));

    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    // Create task payloads
    for (const item of expandedCopies) {
      if (skipNameSet.has(item.name)) continue;

      const src = item.src;
      const catId = categoryIdByName.get(item.catName);
      if (!catId) continue;

      const n = extractCycleNumber(item.name);
      const cycleNumber = Number.isFinite(n) && n > 0 ? n : 1;
      const anchor = now;
      const dueDate = calculateTaskDueDate(anchor, cycleNumber);

      payloads.push({
        id: makeId(),
        name: item.name,
        status: "pending" as TaskStatus,
        priority: src.priority,
        idealDurationMinutes: src.idealDurationMinutes ?? undefined,
        dueDate: dueDate.toISOString(),
        completionLink: src.completionLink ?? undefined,
        email: src.email ?? undefined,
        password: src.password ?? undefined,
        username: src.username ?? undefined,
        notes: src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        assignedTo: { connect: { id: topAgent.id } },
      });
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          message: "All remaining tasks already exist.",
          created: 0,
          skipped: namesToCheck.length,
          assignmentId: assignment.id,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Create tasks in transaction
    const created = await prisma.$transaction(
      payloads.map((data) =>
        prisma.task.create({
          data,
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            createdAt: true,
            dueDate: true,
            idealDurationMinutes: true,
            completionLink: true,
            email: true,
            password: true,
            username: true,
            notes: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            assignment: { select: { id: true } },
            category: { select: { id: true, name: true } },
            templateSiteAsset: {
              select: { id: true, name: true, type: true },
            },
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} remaining task(s) and assigned to ${topAgent.name}.`,
        created: created.length,
        skipped: skipNameSet.size,
        assignmentId: assignment.id,
        assignedTo: topAgent,
        tasks: created,
        remainingMonths,
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}