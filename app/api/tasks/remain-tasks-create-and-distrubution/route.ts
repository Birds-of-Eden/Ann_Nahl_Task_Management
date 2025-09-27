// app/api/tasks/remain-tasks-create-and-distrubution/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type {
  TaskPriority,
  TaskStatus,
  SiteAssetType,
} from "@prisma/client";
import prisma from "@/lib/prisma";

// ================== CONSTANTS ==================
const ALLOWED_ASSET_TYPES: SiteAssetType[] = [
  "social_site",
  "web2_site",
  "other_asset",
];

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";

const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;
const PLATFORM_META: Record<
  (typeof WEB2_FIXED_PLATFORMS)[number],
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

// ================== SMALL UTILS ==================
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

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
  return String(name).replace(/\s*-\s*\d+$/i, "").trim();
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

// ================== WORKING-DAY CADENCE (7WD for ALL cycles including cycle-1) ==================
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addWorkingDays(startDate: Date, workingDays: number): Date {
  let result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workingDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

function calculateTaskDueDate(startDate: Date, cycleNumber: number): Date {
  // ALL cycles (including cycle 1) = 7 working days × cycleNumber from start date
  const workingDays = 7 * cycleNumber;
  return addWorkingDays(startDate, workingDays);
}

function countCyclesUntil(start: Date | null, targetDate: Date): number {
  if (!start) return 0;
  if (targetDate < start) return 0;
  
  let cycleCount = 0;
  
  while (true) {
    cycleCount++;
    const nextDue = calculateTaskDueDate(start, cycleCount);
    
    if (nextDue > targetDate) {
      return cycleCount - 1;
    }
  }
}

// ================== FREQUENCY & CREDENTIALS ==================
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

function normalize(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalize(name);
  if (/\bmedium\b/.test(n)) return "medium";
  if (/\btumblr\b/.test(n)) return "tumblr";
  if (/\bwordpress\b/.test(n) || /\bword\s*press\b/.test(n)) return "wordpress";
  return null;
}

function collectWeb2PlatformSources(
  srcTasks: {
    name: string;
    username: string | null;
    email: string | null;
    password: string | null;
    completionLink: string | null;
    templateSiteAsset?: { type: SiteAssetType | null } | null;
    idealDurationMinutes?: number | null;
  }[]
) {
  const map = new Map<
    "medium" | "tumblr" | "wordpress",
    {
      username: string;
      email: string;
      password: string;
      url: string;
      label: string;
      idealDurationMinutes?: number | null;
    }
  >();

  for (const t of srcTasks) {
    if (t.templateSiteAsset?.type !== "web2_site") continue;
    const p = matchPlatformFromWeb2Name(t.name);
    if (!p) continue;

    const username = t.username ?? "";
    const email = t.email ?? "";
    const password = t.password ?? "";
    const url = t.completionLink ?? "";
    const idealDurationMinutes = t.idealDurationMinutes ?? null;

    if (!username || !email || !password || !url) continue;

    if (!map.has(p)) {
      map.set(p, {
        username,
        email,
        password,
        url,
        label: PLATFORM_META[p].label,
        idealDurationMinutes,
      });
    }
  }
  return map;
}

// ================== ASSIGNEE PICKER ==================
async function findTopAgentForClient(clientId: string) {
  try {
    // Find agent with most tasks for this client
    const agentTaskCounts = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: { 
        clientId, 
        assignedToId: { not: null } 
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });

    if (agentTaskCounts.length > 0 && agentTaskCounts[0].assignedToId) {
      const topAgentId = agentTaskCounts[0].assignedToId;
      const agent = await prisma.user.findUnique({
        where: { id: topAgentId },
        select: { id: true, name: true, email: true },
      });
      if (agent) return agent;
    }

    // Fallback to any available agent with specified roles
    const availableAgent = await prisma.user.findFirst({
      where: { 
        role: { 
          name: { in: ["agent", "data_entry", "staff"] } 
        } 
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });

    return availableAgent;
  } catch (error) {
    console.error("Error finding top agent:", error);
    return null;
  }
}

// ================== POST: Create tasks from TODAY → dueDate ==================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const onlyType: SiteAssetType | undefined = body?.onlyType;
    const overridePriority = body?.priority
      ? normalizeTaskPriority(body?.priority)
      : undefined;

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

    // Find top agent for assignment
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
        startDate: true,
        dueDate: true,
      },
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }
    
    if (!client.dueDate) {
      return NextResponse.json(
        { message: "Client due date is required for future task generation" },
        { status: 400 }
      );
    }

    if (!client.startDate) {
      return NextResponse.json(
        { message: "Client start date is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const campaignStart = new Date(client.startDate);
    const dueDate = new Date(client.dueDate);

    // Calculate cycles from start to today and start to dueDate
    const cyclesUpToToday = countCyclesUntil(campaignStart, now);
    const totalCycles = countCyclesUntil(campaignStart, dueDate);
    
    // Future cycles = cycles from (today + 1) to dueDate
    const futureCycles = Math.max(0, totalCycles - cyclesUpToToday);

    if (futureCycles === 0) {
      return NextResponse.json(
        {
          message: "No future cycles remain between today and due date.",
          created: 0,
          futureCycles: 0,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Find latest assignment
    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: {
        clientId,
        ...(templateId !== undefined ? { templateId: templateId ?? undefined } : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { message: "No existing assignment found for this client." },
        { status: 404 }
      );
    }

    // Get source tasks (QC approved only)
    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        templateSiteAsset: {
          is: {
            ...(onlyType ? { type: onlyType } : { type: { in: ALLOWED_ASSET_TYPES } }),
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
        createdAt: true,
        templateSiteAsset: {
          select: { id: true, type: true, defaultPostingFrequency: true },
        },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json(
        { message: "No source tasks found to copy.", created: 0, tasks: [] },
        { status: 200 }
      );
    }

    // QC gate - enforce approved tasks only
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

    // Get frequency overrides
    const assetIds = Array.from(
      new Set(
        sourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => v !== undefined && v !== null)
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
    for (const s of settings) {
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);
    }

    // Ensure categories exist
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

    // Build web2 credentials map
    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    // ========= EXPAND FUTURE TASKS =========
    const expandedCopies: {
      src: (typeof sourceTasks)[number];
      name: string;
      catName: string;
      cycleNumber: number; // Global cycle number continuing from campaign start
    }[] = [];

    // Track last due dates per base for Social Communication
    const lastDueByBase = new Map<string, Date>();

    for (const src of sourceTasks) {
      const assetType = src.templateSiteAsset?.type;
      const assetId = src.templateSiteAsset?.id;

      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });

      const futureCopies = Math.max(0, Math.floor(freq * futureCycles));
      if (futureCopies === 0) continue;

      const base = baseNameOf(src.name);
      const catName = resolveCategoryFromType(assetType);

      // Create future tasks with continuous cycle numbering
      for (let i = 1; i <= futureCopies; i++) {
        const cycleNumber = cyclesUpToToday + i; // Continue from where we left off
        expandedCopies.push({
          src,
          catName,
          cycleNumber,
          name: `${base} -${cycleNumber}`,
        });
      }

      // Store last due date for Social Activity bases
      if (catName === CAT_SOCIAL_ACTIVITY && futureCopies > 0) {
        const lastCycle = cyclesUpToToday + futureCopies;
        const lastDue = calculateTaskDueDate(campaignStart, lastCycle);
        lastDueByBase.set(base, lastDue);
      }
    }

    if (expandedCopies.length === 0) {
      return NextResponse.json(
        {
          message: "No future tasks to create for the remaining cycles.",
          created: 0,
          futureCycles,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // ========= CHECK FOR EXISTING TASKS =========
    const scAssetNames = sourceTasks
      .filter((s) => s.templateSiteAsset?.type === "social_site")
      .map((s) => `${baseNameOf(s.name) || "Social"} - ${CAT_SOCIAL_COMMUNICATION}`);

    const scWeb2Names = WEB2_FIXED_PLATFORMS
      .filter((p) => web2PlatformCreds.get(p))
      .map((p) => `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`);

    const namesToCheck = Array.from(
      new Set([
        ...expandedCopies.map((e) => e.name),
        ...scAssetNames,
        ...scWeb2Names,
      ])
    );

    const existingTasks = namesToCheck.length > 0
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

    const skipNameSet = new Set(existingTasks.map((t) => t.name));

    // ========= CREATE TASK PAYLOADS =========
    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    // 1) Social Activity / Blog Posting tasks
    for (const item of expandedCopies) {
      if (skipNameSet.has(item.name)) continue;

      const src = item.src;
      const catId = categoryIdByName.get(item.catName);
      if (!catId) continue;

      const dueDate = calculateTaskDueDate(campaignStart, item.cycleNumber);

      payloads.push({
        id: makeId(),
        name: item.name,
        status: "pending" as TaskStatus,
        priority: overridePriority ?? src.priority,
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

    // 2) Social Communication from social_site assets
    for (const src of sourceTasks) {
      if (src.templateSiteAsset?.type !== "social_site") continue;

      const base = baseNameOf(src.name) || "Social";
      const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION}`;
      if (skipNameSet.has(scName)) continue;

      const assetId = src.templateSiteAsset?.id;
      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });
      
      const futureCopies = Math.max(0, Math.floor(freq * futureCycles));
      if (futureCopies === 0) continue;

      let dueDate = lastDueByBase.get(base);
      if (!dueDate) {
        const lastCycle = cyclesUpToToday + futureCopies;
        dueDate = calculateTaskDueDate(campaignStart, lastCycle);
      }

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION);
      if (!catId) continue;

      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? src.priority,
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

    // 3) Social Communication for fixed Web2 platforms
    const maxSocialDue = Array.from(lastDueByBase.values())
      .sort((a, b) => b.getTime() - a.getTime())[0] || 
      calculateTaskDueDate(campaignStart, cyclesUpToToday + 1);

    for (const p of WEB2_FIXED_PLATFORMS) {
      const creds = web2PlatformCreds.get(p);
      if (!creds) continue;

      const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
      if (skipNameSet.has(scName)) continue;

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION);
      if (!catId) continue;

      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? "medium",
        dueDate: maxSocialDue.toISOString(),
        username: creds.username,
        email: creds.email,
        password: creds.password,
        completionLink: creds.url,
        idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        assignedTo: { connect: { id: topAgent.id } },
      });
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          message: "All future tasks already exist.",
          created: 0,
          skipped: namesToCheck.length,
          assignmentId: assignment.id,
          futureCycles,
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
        message: `Created ${created.length} future task(s) for cycles ${cyclesUpToToday + 1} to ${totalCycles} and assigned to ${topAgent.name}.`,
        created: created.length,
        skipped: skipNameSet.size,
        assignmentId: assignment.id,
        assignedTo: topAgent,
        futureCycles,
        cyclesRange: `${cyclesUpToToday + 1} to ${totalCycles}`,
        cadence: "7 working days per cycle (all cycles)",
        tasks: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}