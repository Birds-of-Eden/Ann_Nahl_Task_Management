export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus, SiteAssetType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { extractCycleNumber } from "@/utils/working-days";

// ================== CONSTANTS ==================
// Allow ALL asset types defined in prisma enum
const ALLOWED_ASSET_TYPES: SiteAssetType[] = [
  "social_site",
  "web2_site",
  "other_asset",
  "content_writing",
  "backlinks",
  "review_removal",
  "summary_report",
  "guest_posting",
];

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
const CAT_CONTENT_WRITING = "Content Writing";
const CAT_GUEST_POSTING = "Guest Posting";
const CAT_BACKLINKS = "Backlinks";
const CAT_REVIEW_REMOVAL = "Review Removal";
const CAT_SUMMARY_REPORT = "Summary Report";

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

// Simple mapping (no function) from SiteAssetType -> Category Name
const TYPE_TO_CATEGORY: Record<SiteAssetType, string> = {
  social_site: CAT_SOCIAL_ACTIVITY,
  web2_site: CAT_BLOG_POSTING,
  other_asset: CAT_SOCIAL_ACTIVITY,
  graphics_design: CAT_SOCIAL_ACTIVITY,
  image_optimization: CAT_SOCIAL_ACTIVITY,
  content_studio: CAT_CONTENT_WRITING,
  content_writing: CAT_CONTENT_WRITING,
  backlinks: CAT_BACKLINKS,
  completed_com: CAT_SOCIAL_COMMUNICATION,
  youtube_video_optimization: CAT_SOCIAL_ACTIVITY,
  monitoring: CAT_SUMMARY_REPORT,
  review_removal: CAT_REVIEW_REMOVAL,
  summary_report: CAT_SUMMARY_REPORT,
  guest_posting: CAT_GUEST_POSTING,
};

function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
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
  console.error(`[create-dataentry-posting-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// ================== DATE HELPERS (trimmed; no cycle/cadence calc) ==================
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function normalizeStr(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}
function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalizeStr(name);
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

// ================== ASSIGNEE PICKER (unchanged) ==================
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

    const availableAgent = await prisma.user.findFirst({
      where: { role: { name: { in: ["agent", "data_entry", "staff"] } } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });

    return availableAgent;
  } catch (error) {
    console.error("Error finding top agent:", error);
    return null;
  }
}

// ================== POST ==================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const counts: Record<string, number> | undefined = body?.counts; // legacy: category -> count
    const countsByType: Partial<Record<SiteAssetType, number>> | undefined = body?.countsByType; // new: type -> count
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

    // Assignee (UI performs actual assignment after creation)
    const topAgent = await findTopAgentForClient(clientId);
    // (We don't use topAgent here for assignment; your UI distributes to data_entry. Keeping it only for response context.)

    // Client existence
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    // ================== SIMPLE COUNTS-BASED CREATION (derive from template site assets) ==================
    // ================== NEW: TYPE-COUNTS-BASED CREATION ==================
    if (countsByType && typeof countsByType === "object" && Object.keys(countsByType).length > 0) {
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

      // Fetch qc_approved template source tasks for ONLY the requested types
      const requestedTypes = Object.entries(countsByType)
        .filter(([_, v]) => Number(v || 0) > 0)
        .map(([k]) => k as SiteAssetType);

      if (requestedTypes.length === 0) {
        return NextResponse.json(
          { message: "No non-zero counts provided.", created: 0, tasks: [] },
          { status: 200 }
        );
      }

      const sourceTasks = await prisma.task.findMany({
        where: {
          assignmentId: assignment.id,
          status: "qc_approved",
          templateSiteAsset: { is: { type: { in: requestedTypes } } },
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
          templateSiteAsset: { select: { type: true, name: true } },
        },
      });

      if (!sourceTasks.length) {
        return NextResponse.json(
          { message: "No qc_approved source tasks found to copy.", created: 0, tasks: [] },
          { status: 200 }
        );
      }

      // Ensure categories for all types we might use
      const catNames = Array.from(new Set(requestedTypes.map((t) => TYPE_TO_CATEGORY[t])));
      const ensured = await Promise.all(
        catNames.map((n) =>
          prisma.taskCategory.upsert({
            where: { name: n },
            update: {},
            create: { name: n },
            select: { id: true, name: true },
          })
        )
      );
      const categoryIdByName = new Map<string, string>(ensured.map((c) => [c.name, c.id] as const));

      // Group sources by type
      const byType = new Map<SiteAssetType, typeof sourceTasks>();
      for (const s of sourceTasks) {
        const t = s.templateSiteAsset?.type as SiteAssetType | undefined;
        if (!t) continue;
        const arr = byType.get(t) ?? [];
        arr.push(s);
        byType.set(t, arr);
      }

      const payloads: Parameters<typeof prisma.task.create>[0]["data"][] = [];

      for (const t of requestedTypes) {
        const count = Number(countsByType[t] || 0);
        if (count <= 0) continue;
        const srcList = byType.get(t) ?? [];
        if (!srcList.length) continue;
        const catName = TYPE_TO_CATEGORY[t];
        const catId = categoryIdByName.get(catName);
        if (!catId) continue;

        // Build a map of next cycle index per base by checking existing tasks
        const bases = Array.from(new Set(srcList.map((s) => baseNameOf(s.name))));
        const nextIndexByBase = new Map<string, number>();
        if (bases.length > 0) {
          const existing = await prisma.task.findMany({
            where: {
              clientId,
              category: { is: { name: catName } },
              name: { in: bases.map((b) => `${b} - 1`).concat(bases.map((b) => `${b}`)) },
            },
            select: { name: true },
          });
          // Also fetch all tasks for these bases (startsWith) to capture any cycle number
          const existingAll = await prisma.task.findMany({
            where: {
              clientId,
              category: { is: { name: catName } },
              OR: bases.map((b) => ({ name: { startsWith: `${b} -` } })),
            },
            select: { name: true },
          });
          const combined = [...existing, ...existingAll];
          for (const b of bases) {
            const related = combined.filter((t) => t.name === b || t.name.startsWith(`${b} -`));
            const maxCycle = related.reduce((max, t) => {
              const n = extractCycleNumber(t.name);
              return Number.isFinite(n) && n > max ? n : max;
            }, 0);
            nextIndexByBase.set(b, Math.max(1, maxCycle + 1));
          }
        }

        for (let i = 0; i < count; i++) {
          const src = srcList[i % srcList.length];
          const base = baseNameOf(src.name);
          const start = nextIndexByBase.get(base) ?? 1;
          const name = `${base} - ${start + i}`;
          payloads.push({
            id: makeId(),
            name,
            status: "pending" as TaskStatus,
            priority: src.priority as TaskPriority,
            idealDurationMinutes: src.idealDurationMinutes ?? undefined,
            completionLink: src.completionLink ?? undefined,
            email: src.email ?? undefined,
            password: src.password ?? undefined,
            username: src.username ?? undefined,
            notes: src.notes ?? undefined,
            assignment: { connect: { id: assignment.id } },
            client: { connect: { id: clientId } },
            category: { connect: { id: catId } },
          });
        }
      }

      if (!payloads.length) {
        return NextResponse.json(
          { message: "No matching template types or zero counts provided.", created: 0, tasks: [] },
          { status: 200 }
        );
      }

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
          message: `Created ${created.length} task(s) successfully from template types.`,
          created: created.length,
          tasks: created,
        },
        { status: 201 }
      );
    }

    // ================== LEGACY: CATEGORY-COUNTS-BASED CREATION ==================
    if (counts && typeof counts === "object") {
      // Find latest assignment first
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

      // Fetch qc_approved template source tasks
      const sourceTasks = await prisma.task.findMany({
        where: {
          assignmentId: assignment.id,
          status: "qc_approved",
          templateSiteAsset: { isNot: null },
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
          templateSiteAsset: { select: { type: true, name: true } },
        },
      });

      if (!sourceTasks.length) {
        return NextResponse.json(
          { message: "No qc_approved source tasks found to copy.", created: 0, tasks: [] },
          { status: 200 }
        );
      }

      // Ensure categories used by templates
      const ALL_CATEGORY_NAMES = [
        CAT_SOCIAL_ACTIVITY,
        CAT_BLOG_POSTING,
        CAT_SOCIAL_COMMUNICATION,
        CAT_CONTENT_WRITING,
        CAT_GUEST_POSTING,
        CAT_BACKLINKS,
        CAT_REVIEW_REMOVAL,
        CAT_SUMMARY_REPORT,
      ];
      const ensured = await Promise.all(
        ALL_CATEGORY_NAMES.map((n) =>
          prisma.taskCategory.upsert({
            where: { name: n },
            update: {},
            create: { name: n },
            select: { id: true, name: true },
          })
        )
      );
      const categoryIdByName = new Map<string, string>(
        ensured.map((c) => [c.name, c.id] as const)
      );

      // Group sources by category via TYPE_TO_CATEGORY
      const byCategory = new Map<string, typeof sourceTasks>();
      for (const s of sourceTasks) {
        const t = s.templateSiteAsset?.type as SiteAssetType | undefined;
        const cat = t ? TYPE_TO_CATEGORY[t] : CAT_SOCIAL_ACTIVITY;
        const arr = byCategory.get(cat) ?? [];
        arr.push(s);
        byCategory.set(cat, arr);
      }

      const payloads: Parameters<typeof prisma.task.create>[0]["data"][] = [];

      for (const [catNameRaw, countRaw] of Object.entries(counts)) {
        const count = Number(countRaw || 0);
        if (count <= 0) continue;

        const catName = catNameRaw; // UI should send names matching resolved categories
        const srcList = byCategory.get(catName) ?? [];
        const catId = categoryIdByName.get(catName);
        if (!catId) continue;
        if (!srcList.length) continue;

        // Build a map of next cycle index per base by checking existing tasks for this category
        const bases = Array.from(new Set(srcList.map((s) => baseNameOf(s.name))));
        const nextIndexByBase = new Map<string, number>();
        if (bases.length > 0) {
          const existing = await prisma.task.findMany({
            where: {
              clientId,
              category: { is: { name: catName } },
              OR: bases.map((b) => ({ name: { startsWith: b } })),
            },
            select: { name: true },
          });
          for (const b of bases) {
            const related = existing.filter((t) => t.name === b || t.name.startsWith(`${b} -`));
            const maxCycle = related.reduce((max, t) => {
              const n = extractCycleNumber(t.name);
              return Number.isFinite(n) && n > max ? n : max;
            }, 0);
            nextIndexByBase.set(b, Math.max(1, maxCycle + 1));
          }
        }

        for (let i = 0; i < count; i++) {
          const src = srcList[i % srcList.length];
          const base = baseNameOf(src.name);
          const start = nextIndexByBase.get(base) ?? 1;
          const name = `${base} - ${start + i}`;
          payloads.push({
            id: makeId(),
            name,
            status: "pending" as TaskStatus,
            priority: src.priority as TaskPriority,
            idealDurationMinutes: src.idealDurationMinutes ?? undefined,
            completionLink: src.completionLink ?? undefined,
            email: src.email ?? undefined,
            password: src.password ?? undefined,
            username: src.username ?? undefined,
            notes: src.notes ?? undefined,
            assignment: { connect: { id: assignment.id } },
            client: { connect: { id: clientId } },
            category: { connect: { id: catId } },
          });
        }
      }

      if (!payloads.length) {
        return NextResponse.json(
          { message: "No matching template categories or zero counts provided.", created: 0, tasks: [] },
          { status: 200 }
        );
      }

      const created = await prisma.$transaction(
        payloads.map((data) => prisma.task.create({
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
        }))
      );

      return NextResponse.json(
        {
          message: `Created ${created.length} task(s) successfully from templates.`,
          created: created.length,
          tasks: created,
        },
        { status: 201 }
      );
    }

    // If neither payload provided
    return NextResponse.json(
      { message: "Provide countsByType (preferred) or counts.", created: 0, tasks: [] },
      { status: 400 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
