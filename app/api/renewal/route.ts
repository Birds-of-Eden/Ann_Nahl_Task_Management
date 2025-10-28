// ===============================================
// FILE: app/api/tasks/create-posting-tasks/renew/route.ts
// ===============================================
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calculateTaskDueDate, extractCycleNumber } from "@/utils/working-days";

// ---------- Constants (keep in sync with base route) ----------
const ALLOWED_ASSET_TYPES = [
  "social_site",
  "web2_site",
  "other_asset",
] as const;
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";

const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;
const PLATFORM_META: Record<
  "medium" | "tumblr" | "wordpress",
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

// ---------- Helpers (copied/kept consistent with base) ----------
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

function getFrequency(opts: { required?: number | null | undefined; defaultFreq?: number | null | undefined; }): number {
  const fromRequired = Number(opts.required);
  if (Number.isFinite(fromRequired) && fromRequired! > 0) return Math.floor(fromRequired);
  const fromDefault = Number(opts.defaultFreq);
  if (Number.isFinite(fromDefault) && fromDefault! > 0) return Math.floor(fromDefault);
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
  console.error(`[create-posting-tasks/renew] ${stage} ERROR:`, err);
  return NextResponse.json({ message: "Internal Server Error", stage, error: e }, { status: http });
}

function normalize(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

function matchPlatformFromWeb2Name(name: string): "medium" | "tumblr" | "wordpress" | null {
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
    templateSiteAsset?: { type: string | null } | null;
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
      map.set(p, { username, email, password, url, label: PLATFORM_META[p].label, idealDurationMinutes });
    }
  }
  return map;
}

const makeId = () => `task_${Date.now()}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

// -------------- POST (Renewal) --------------
// Body: { clientId: string; templateId?: string | "none"; renewalDate: string (ISO); onlyType?: string; includeAssetIds?: number[]; excludeAssetIds?: number[]; priority?: TaskPriority }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const renewalDateISO: string | undefined = body?.renewalDate; // REQUIRED
    const onlyType: string | undefined = body?.onlyType;

    const includeAssetIds = Array.isArray(body?.includeAssetIds)
      ? body?.includeAssetIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined;
    const excludeAssetIds = Array.isArray(body?.excludeAssetIds)
      ? body?.excludeAssetIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined;

    if (!clientId) return NextResponse.json({ message: "clientId is required" }, { status: 400 });
    if (!renewalDateISO) return NextResponse.json({ message: "renewalDate is required (ISO string)" }, { status: 400 });

    // DB preflight
    try { await prisma.$queryRaw`SELECT 1`; } catch (e) { return fail("POST.db-preflight", e); }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        package: { select: { totalMonths: true } },
      },
    });
    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    const monthsRaw = Number(client.package?.totalMonths ?? 1);
    const months = Number.isFinite(monthsRaw) && monthsRaw > 0 ? Math.min(Math.floor(monthsRaw), 120) : 1;

    const renewalDate = new Date(renewalDateISO);
    if (Number.isNaN(renewalDate.getTime())) return NextResponse.json({ message: "renewalDate is invalid" }, { status: 400 });

    // Compute new cycle end date (client.dueDate) as renewalDate + months
    const dueDate = new Date(renewalDate);
    dueDate.setMonth(dueDate.getMonth() + months);

    // Persist renewalDate, dueDate, renewalCount++ now (before creating tasks)
    await prisma.client.update({
      where: { id: clientId },
      data: {
        renewalDate,
        dueDate,
        renewalCount: { increment: 1 },
      },
      select: { id: true },
    });

    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: { clientId, ...(templateId !== undefined ? { templateId: templateId ?? undefined } : {}) },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json({ message: "No existing assignment found for this client. Please create one first." }, { status: 404 });
    }

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        templateSiteAsset: {
          is: {
            ...(onlyType ? { type: onlyType as any } : { type: { in: ALLOWED_ASSET_TYPES as unknown as string[] } }),
            ...(includeAssetIds && includeAssetIds.length ? { id: { in: includeAssetIds as any } } : {}),
            ...(excludeAssetIds && excludeAssetIds.length ? { id: { notIn: excludeAssetIds as any } } : {}),
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
        templateSiteAsset: { select: { id: true, type: true, defaultPostingFrequency: true } },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json({ message: "No source tasks found to copy.", tasks: [] }, { status: 200 });
    }

    // QC gate (keep same as base behavior)
    const notApproved = sourceTasks.filter((t) => t.status !== "qc_approved");
    if (notApproved.length) {
      return NextResponse.json({
        message: "All source tasks must be 'qc_approved' before creating posting tasks for renewal.",
        notApprovedTaskIds: notApproved.map((t) => t.id),
        countsByStatus: countByStatus(sourceTasks as any),
      }, { status: 400 });
    }

    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    // per-asset overrides
    const assetIds = Array.from(new Set(sourceTasks.map((s) => s.templateSiteAsset?.id).filter((v): v is number => typeof v === "number")));
    const settings = assetIds.length
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: { assignmentId: assignment.id, templateSiteAssetId: { in: assetIds } },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings) requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);

    // Ensure categories
    const ensureCategory = async (name: string) => {
      const found = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
      if (found) return found;
      try {
        return await prisma.taskCategory.create({ data: { name }, select: { id: true, name: true } });
      } catch (e) {
        const again = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
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

    // Expand copies for renewed window (anchor = renewalDate)
    const expandedCopies: { src: (typeof sourceTasks)[number]; name: string; catName: string }[] = [];
    const lastCycleDueByBase = new Map<string, Date>();

    for (const src of sourceTasks) {
      const assetType = src.templateSiteAsset?.type;
      const assetId = src.templateSiteAsset?.id;
      const freq = getFrequency({ required: assetId ? requiredByAssetId.get(assetId) : undefined, defaultFreq: src.templateSiteAsset?.defaultPostingFrequency });
      const catName = resolveCategoryFromType(assetType);
      const base = baseNameOf(src.name);
      const totalCopies = Math.max(1, freq * months);

      for (let i = 1; i <= totalCopies; i++) {
        expandedCopies.push({ src, catName, name: `${base} -${i}` });
      }

      if (catName === CAT_SOCIAL_ACTIVITY) {
        const lastDue = calculateTaskDueDate(renewalDate, totalCopies);
        lastCycleDueByBase.set(base, lastDue);
      }
    }

    // Prep dedupe names (existing)
    const scNamesFromAssets = sourceTasks
      .filter((s) => {
        const t = s.templateSiteAsset?.type;
        return t === "social_site" || t === "other_asset";
      })
      .map((s) => `${baseNameOf(s.name) || "Social"} - ${CAT_SOCIAL_COMMUNICATION}`);
    const scNamesFromWeb2 = WEB2_FIXED_PLATFORMS.map((p) => `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`);

    const namesToCheck = Array.from(new Set([...expandedCopies.map((e) => e.name), ...scNamesFromAssets, ...scNamesFromWeb2]));
    const existingCopies = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        name: { in: namesToCheck },
        category: { is: { name: { in: [CAT_SOCIAL_ACTIVITY, CAT_BLOG_POSTING, CAT_SOCIAL_COMMUNICATION] } } },
      },
      select: { name: true },
    });
    const skipNameSet = new Set(existingCopies.map((t) => t.name));

    const overridePriority = body?.priority ? normalizeTaskPriority(body?.priority) : undefined;

    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    // 1) Social Activity + Blog Posting (anchor/due dates derived from renewalDate)
    for (const item of expandedCopies) {
      if (skipNameSet.has(item.name)) continue;
      const src = item.src;
      const catId = categoryIdByName.get(item.catName)!;
      const n = extractCycleNumber(item.name);
      const cycleNumber = Number.isFinite(n) && n > 0 ? n : 1;
      const dueDate = calculateTaskDueDate(renewalDate, cycleNumber);

      payloads.push({
        id: makeId(),
        name: item.name,
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
      } as TaskCreate);
    }

    // 2) Social Communication from assets (1 per social/other asset), due = base last social posting due
    for (const src of sourceTasks) {
      const t = src.templateSiteAsset?.type;
      if (t !== "social_site" && t !== "other_asset") continue;
      const base = baseNameOf(src.name) || "Social";
      const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION}`;
      if (skipNameSet.has(scName)) continue;
      let dueDate = lastCycleDueByBase.get(base);
      if (!dueDate) {
        const assetId = src.templateSiteAsset?.id;
        const freq = getFrequency({ required: assetId ? requiredByAssetId.get(assetId) : undefined, defaultFreq: src.templateSiteAsset?.defaultPostingFrequency });
        const totalCopies = Math.max(1, freq * months);
        dueDate = calculateTaskDueDate(renewalDate, totalCopies);
      }
      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
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
      } as TaskCreate);
    }

    // 3) Social Communication for fixed Web2 (guarded by creds), due = max of lastCycleDueByBase
    const maxLastSocialDue = Array.from(lastCycleDueByBase.values()).sort((a, b) => a.getTime() - b.getTime()).pop() ?? calculateTaskDueDate(renewalDate, 1);

    for (const p of WEB2_FIXED_PLATFORMS) {
      const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
      if (skipNameSet.has(scName)) continue;
      const creds = web2PlatformCreds.get(p);
      if (!creds) continue;
      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? "medium",
        dueDate: maxLastSocialDue.toISOString(),
        username: creds.username,
        email: creds.email,
        password: creds.password,
        completionLink: creds.url,
        idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
      } as TaskCreate);
    }

    if (!payloads.length) {
      return NextResponse.json({
        message: "All copies already exist under 'Social Activity' / 'Blog Posting' / 'Social Communication' for renewed window.",
        created: 0,
        skipped: namesToCheck.length,
        assignmentId: assignment.id,
        tasks: [],
        renewalDate,
        dueDate,
      }, { status: 200 });
    }

    const created = await prisma.$transaction((tx) => Promise.all(payloads.map((data) => tx.task.create({
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
        assignment: { select: { id: true } },
        category: { select: { id: true, name: true } },
        templateSiteAsset: { select: { id: true, name: true, type: true } },
      },
    }))));

    return NextResponse.json({
      message: `Created ${created.length} task(s) for renewal across Social Activity, Blog Posting, and Social Communication.`,
      created: created.length,
      assignmentId: assignment.id,
      tasks: created,
      renewalDate,
      dueDate,
      runtime: "nodejs",
    }, { status: 201 });
  } catch (err) {
    return fail("POST.catch", err);
  }
}