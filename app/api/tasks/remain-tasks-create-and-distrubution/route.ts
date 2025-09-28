// app/api/tasks/remain-tasks-create-and-distrubution/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus, SiteAssetType } from "@prisma/client";
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

// ================== WORKING-DAY HELPERS (15WD then +5WD) ==================
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sun/Sat
}

function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = new Date(startDate);
  let daysToAdd = workingDays;
  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) daysToAdd--;
  }
  return result;
}

/** Build full schedule up to 'end' (inclusive), then caller filters window. */
function buildSchedule(startDate: Date, end: Date): Date[] {
  const out: Date[] = [];
  const first = addWorkingDays(startDate, 15);
  if (first > end) return out;
  out.push(first);
  let cur = new Date(first);
  while (true) {
    const next = addWorkingDays(cur, 7);
    if (next > end) break;
    out.push(next);
    cur = next;
  }
  return out;
}

/** Stable 1-based index for names "Base -<idx>" under this cadence. */
function sequenceIndexFromStart(startDate: Date, target: Date): number {
  const first = addWorkingDays(startDate, 15);
  if (target < first) return 0;
  let idx = 1;
  let cur = new Date(first);
  while (true) {
    if (cur.getTime() === target.getTime()) return idx;
    const next = addWorkingDays(cur, 7);
    if (next > target) return idx; // safety
    idx++;
    cur = next;
  }
}

// ================== PLATFORM PARSING (same as other API) ==================
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

// ================== ASSIGNEE: pick Top Agent ==================
async function findTopAgentForClient(clientId: string) {
  try {
    const agentTaskCounts = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: { clientId, assignedToId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });

    if (agentTaskCounts.length > 0 && agentTaskCounts[0].assignedToId) {
      const topAgentId = agentTaskCounts[0].assignedToId!;
      const agent = await prisma.user.findUnique({
        where: { id: topAgentId },
        select: { id: true, name: true, email: true },
      });
      if (agent) return agent;
    }

    // Fallback (agent/data_entry/staff)
    const available = await prisma.user.findFirst({
      where: { role: { name: { in: ["agent", "data_entry", "staff"] } } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    return available;
  } catch (error) {
    console.error("Error finding top agent:", error);
    return null;
  }
}

// ================== POST: create remaining (after today) → dueDate ==================
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
      return NextResponse.json({ message: "clientId is required" }, { status: 400 });
    }

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    // Assign to Top Agent
    const topAgent = await findTopAgentForClient(clientId);
    if (!topAgent) {
      return NextResponse.json(
        { message: "No available agent found to assign tasks" },
        { status: 400 }
      );
    }

    // Dates
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, startDate: true, dueDate: true },
    });
    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });
    if (!client.startDate) return NextResponse.json({ message: "Client start date is required" }, { status: 400 });
    if (!client.dueDate) return NextResponse.json({ message: "Client due date is required" }, { status: 400 });

    const startDate = new Date(client.startDate);
    const dueDate = new Date(client.dueDate);

    // Build full schedule up to dueDate, then filter strictly AFTER today 00:00
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const fullSchedule = buildSchedule(startDate, dueDate);
    const remainingSchedule = fullSchedule.filter((d) => d.getTime() > todayMidnight.getTime());

    if (remainingSchedule.length === 0) {
      return NextResponse.json(
        {
          message: "No remaining occurrences after today (already generated).",
          created: 0,
          remainingDates: 0,
          assignedTo: topAgent,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Assignment & source
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

    // Source tasks (must be qc_approved), optionally filter by type
    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        status: "qc_approved",
        templateSiteAsset: {
          is: {
            ...(onlyType ? { type: onlyType } : { type: { in: ALLOWED_ASSET_TYPES } }),
          },
        },
      },
      select: {
        id: true,
        name: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        templateSiteAsset: {
          select: { id: true, type: true, name: true, defaultPostingFrequency: true },
        },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json(
        { message: "No qc_approved source tasks found to copy.", created: 0, tasks: [] },
        { status: 200 }
      );
    }

    // Ensure categories
    const ensureCategory = async (name: string) => {
      const found = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
      if (found) return found;
      try {
        return await prisma.taskCategory.create({ data: { name }, select: { id: true, name: true } });
      } catch {
        const again = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
        if (again) return again;
        throw new Error(`Failed to ensure category: ${name}`);
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

    // Web2 creds for SC
    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    // Build future items for the *remaining* window
    type FutureItem = {
      src: (typeof sourceTasks)[number];
      catName: string;
      base: string;
      name: string;
      dueDate: Date;
      seqIndex: number;
    };

    const future: FutureItem[] = [];
    for (const src of sourceTasks) {
      const catName = resolveCategoryFromType(src.templateSiteAsset?.type);
      const base = baseNameOf(src.name);
      for (const d of remainingSchedule) {
        const seq = sequenceIndexFromStart(startDate, d);
        future.push({
          src,
          catName,
          base,
          name: `${base} -${seq}`,
          dueDate: d,
          seqIndex: seq,
        });
      }
    }

    if (future.length === 0) {
      return NextResponse.json(
        {
          message: "No future tasks to create for the remaining schedule.",
          created: 0,
          assignedTo: topAgent,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Skip duplicates (by name, within categories)
    const namesToCheck = Array.from(new Set(future.map((f) => f.name)));
    const existingTasks = namesToCheck.length
      ? await prisma.task.findMany({
          where: {
            assignmentId: assignment.id,
            name: { in: namesToCheck },
            category: {
              name: { in: [CAT_SOCIAL_ACTIVITY, CAT_BLOG_POSTING, CAT_SOCIAL_COMMUNICATION] },
            },
          },
          select: { name: true },
        })
      : [];
    const skipNameSet = new Set(existingTasks.map((t) => t.name));

    // Payloads
    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    // Create Social/Blog items for remaining dates
    for (const item of future) {
      if (skipNameSet.has(item.name)) continue;
      const catId = categoryIdByName.get(item.catName);
      if (!catId) continue;

      payloads.push({
        id: makeId(),
        name: item.name,
        status: "pending" as TaskStatus,
        priority: overridePriority ?? item.src.priority,
        idealDurationMinutes: item.src.idealDurationMinutes ?? undefined,
        dueDate: item.dueDate.toISOString(),
        completionLink: item.src.completionLink ?? undefined,
        email: item.src.email ?? undefined,
        password: item.src.password ?? undefined,
        username: item.src.username ?? undefined,
        notes: item.src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        assignedTo: { connect: { id: topAgent.id } }, // ✅ Top Agent
      });
    }

    // Social Communication (one per social base) aligned to latest created date in this run
    const createdDates = future
      .filter((f) => !skipNameSet.has(f.name))
      .map((f) => f.dueDate.getTime());
    const latestDue = createdDates.length
      ? new Date(Math.max(...createdDates))
      : remainingSchedule[remainingSchedule.length - 1];

    const socialBases = Array.from(
      new Set(
        sourceTasks
          .filter((s) => s.templateSiteAsset?.type === "social_site")
          .map((s) => baseNameOf(s.name) || "Social")
      )
    );

    // Avoid duplicate SC
    const scNames = socialBases.map((b) => `${b} - ${CAT_SOCIAL_COMMUNICATION}`);
    const web2SCNames = WEB2_FIXED_PLATFORMS.filter((p) => web2PlatformCreds.get(p)).map(
      (p) => `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`
    );

    const scExisting = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        name: { in: [...scNames, ...web2SCNames] },
        category: { name: CAT_SOCIAL_COMMUNICATION },
      },
      select: { name: true },
    });
    const scSkip = new Set(scExisting.map((t) => t.name));

    const scCatId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION);

    if (scCatId) {
      // per-base SC
      for (const base of socialBases) {
        const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;

        const src = sourceTasks.find(
          (s) => s.templateSiteAsset?.type === "social_site" && baseNameOf(s.name) === base
        );
        const priority = overridePriority ?? (src?.priority ?? "medium");

        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority,
          dueDate: latestDue.toISOString(),
          completionLink: src?.completionLink ?? undefined,
          email: src?.email ?? undefined,
          password: src?.password ?? undefined,
          username: src?.username ?? undefined,
          notes: src?.notes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
          assignedTo: { connect: { id: topAgent.id } }, // ✅ Top Agent
        });
      }

      // Web2 fixed SC
      for (const p of WEB2_FIXED_PLATFORMS) {
        const creds = web2PlatformCreds.get(p);
        if (!creds) continue;

        const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;

        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority: overridePriority ?? "medium",
          dueDate: latestDue.toISOString(),
          username: creds.username,
          email: creds.email,
          password: creds.password,
          completionLink: creds.url,
          idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
          assignedTo: { connect: { id: topAgent.id } }, // ✅ Top Agent
        });
      }
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          message: "All remaining tasks already exist.",
          created: 0,
          remainingDates: remainingSchedule.length,
          assignedTo: topAgent,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Persist
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
            templateSiteAsset: { select: { id: true, name: true, type: true } },
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} remaining task(s) and assigned to ${topAgent.name}.`,
        created: created.length,
        remainingDates: remainingSchedule.length,
        assignedTo: topAgent,
        assignmentId: assignment.id,
        cadence: "first at startDate + 15 working days, then every +5 working days",
        tasks: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
