// app/api/clients/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

// --- helpers ---
function coerceSocialMedia(input: any): any[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input;
  return [];
}

async function computeClientProgress(clientId: string) {
  // সব টাস্ক নিয়ে groupBy করে কাউন্ট
  const grouped = await prisma.task.groupBy({
    by: ["status"],
    where: { clientId },
    _count: { _all: true },
  });

  // স্কিমার সব স্ট্যাটাস জিরো-ইনিশিয়ালাইজ
  const base: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    paused: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
    data_entered: 0,
  };

  for (const row of grouped) {
    base[row.status] = row._count._all;
  }

  const total =
    base.pending +
    base.in_progress +
    base.completed +
    base.overdue +
    base.cancelled +
    base.reassigned +
    base.qc_approved;

  const progress = total > 0 ? Math.round((base.completed / total) * 100) : 0;

  return {
    progress,
    taskCounts: {
      total,
      completed: base.completed,
      pending: base.pending,
      in_progress: base.in_progress,
      overdue: base.overdue,
      cancelled: base.cancelled,
      reassigned: base.reassigned,
      qc_approved: base.qc_approved,
    },
  };
}

async function recalcAndStoreClientProgress(clientId: string) {
  const { progress, taskCounts } = await computeClientProgress(clientId);
  // Use updateMany to avoid throwing P2025 if the client does not exist.
  const result = await prisma.client.updateMany({
    where: { id: clientId },
    data: { progress },
  });
  if (result.count === 0) {
    console.warn(
      `recalcAndStoreClientProgress: No client found to update for id=${clientId}`
    );
  }
  return { progress, taskCounts };
}

// Optional: amId server-side role guard
async function assertIsAMOrNull(amId: string | null | undefined) {
  if (!amId) return;
  const am = await prisma.user.findUnique({
    where: { id: amId },
    include: { role: true },
  });
  if (!am || am.role?.name !== "am") {
    throw new Error("amId is not an Account Manager (role 'am').");
  }
}

// --- GET ---
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // সর্বশেষ প্রগ্রেস DB-তে আপডেট করে নিন
    const fresh = await recalcAndStoreClientProgress(id);

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        package: true,
        // AM সম্পর্ক দেখাতে
        accountManager: { include: { role: true } },
        teamMembers: {
          include: {
            agent: { include: { role: true } },
            team: true,
          },
        },
        tasks: {
          include: {
            assignedTo: { include: { role: true } },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: {
                    agent: { include: { role: true } },
                    team: true,
                  },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: { include: { assignedTo: true, templateSiteAsset: true } },
          },
        },
      },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // রেসপন্সে fresh progress + taskCounts + socialMedias (derived from JSON socialMedia) যুক্ত করে পাঠাই
    const socialMedias = Array.isArray((client as any).socialMedia)
      ? ((client as any).socialMedia as any[])
      : [];
    return NextResponse.json({
      ...client,
      socialMedias,
      progress: fresh.progress,
      taskCounts: fresh.taskCounts,
    });
  } catch (error) {
    console.error(`Error fetching client ${id}:`, error);
    return NextResponse.json(
      { message: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

// --- PUT ---
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      birthdate,
      gender,
      company,
      designation,
      location,
      website,
      website2,
      website3,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      // progress - ক্লায়েন্ট থেকে নেবো না; আমরা নিজেই রিক্যালকুলেট করবো
      status,
      packageId,
      startDate,
      dueDate,

      articleTopics,

      // ⬇️ নতুন ফিল্ডগুলো (contact/credentials + AM)
      email,
      phone,
      password,
      recoveryEmail,
      amId,
      // ⬇️ Arbitrary JSON key/value pairs
      otherField,
      socialMedia,
    } = body;

    // amId server-side validation (role must be 'am') — allow null to clear
    const amIdValue =
      typeof amId === "string" && amId.trim().length > 0 ? amId : null;
    await assertIsAMOrNull(amIdValue);

    // আপডেট (progress বাদ)
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : undefined,
        gender,
        company,
        designation,
        location,

        // নতুন ফিল্ডগুলো সংরক্ষণ
        email,
        phone,
        // Persist articleTopics JSON if provided
        articleTopics: articleTopics
          ? JSON.parse(JSON.stringify(articleTopics))
          : undefined,
        password,
        recoveryEmail,

        website,
        website2,
        website3,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,

        // AM রিলেশন আপডেট
        amId: amIdValue, // null হলে unlink হবে

        // Persist arbitrary JSON if provided
        otherField: otherField ?? undefined,
        socialMedia:
          coerceSocialMedia(socialMedia) === undefined
            ? undefined
            : JSON.parse(JSON.stringify(coerceSocialMedia(socialMedia))),
      } as any,
      include: {
        package: true,
        accountManager: { include: { role: true } }, // AM দেখাতে
        teamMembers: {
          include: {
            agent: { include: { role: true } },
            team: true,
          },
        },
        tasks: {
          include: {
            assignedTo: { include: { role: true } },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: {
                    agent: { include: { role: true } },
                    team: true,
                  },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: { include: { assignedTo: true, templateSiteAsset: true } },
          },
        },
      },
    });

    // আপডেটের পর progress রিক্যালকুলেট করে DB-তে লিখে নিন
    const fresh = await recalcAndStoreClientProgress(id);

    return NextResponse.json({
      ...updated,
      progress: fresh.progress,
      taskCounts: fresh.taskCounts,
    });
  } catch (error) {
    console.error(`Error updating client ${id}:`, error);
    // AM invalid হলে 400 দেওয়া হোক
    const message =
      error instanceof Error ? error.message : "Failed to update client";
    const status = message.includes("Account Manager") ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}

// --- post ---
// --- POST --- (upgrade with migration + auto posting task creation)
import { headers } from "next/headers";
// import type { TaskStatus } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "upgrade") {
      return NextResponse.json(
        {
          message:
            "Unsupported action. Use { action: 'upgrade', newPackageId, createAssignments, migrateCompleted, createPostingTasks }",
        },
        { status: 400 }
      );
    }

    const newPackageId = String(body?.newPackageId || "").trim();
    const createAssignments = body?.createAssignments ?? true; // default: true
    const migrateCompleted = body?.migrateCompleted ?? true; // ✅ NEW (default: true)
    const createPostingTasks = body?.createPostingTasks ?? true; // ✅ NEW (default: true)

    if (!newPackageId) {
      return NextResponse.json(
        { message: "newPackageId is required" },
        { status: 400 }
      );
    }

    // validate client & package presence + capture old package & assignments
    const [clientRow, pkgRow] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, packageId: true },
      }),
      prisma.package.findUnique({
        where: { id: newPackageId },
        select: { id: true },
      }),
    ]);
    if (!clientRow)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    if (!pkgRow)
      return NextResponse.json(
        { message: "Package not found" },
        { status: 404 }
      );

    const oldPackageId = clientRow.packageId ?? null;

    // পুরনো প্যাকেজের assignments (মাইগ্রেশনের জন্য টাস্ক তুলতে লাগবে)
    const oldAssignments = oldPackageId
      ? await prisma.assignment.findMany({
          where: { clientId, template: { packageId: oldPackageId } },
          select: { id: true },
        })
      : [];
    const oldAssignmentIds = oldAssignments.map((a) => a.id);

    console.log(
      `[Client Upgrade] clientId=${clientId} -> packageId=${newPackageId}, createAssignments=${createAssignments}, migrateCompleted=${migrateCompleted}, createPostingTasks=${createPostingTasks}`
    );

    // 1) প্যাকেজ বদল + (ঐচ্ছিক) নতুন assignments (NOT EXISTS guard)
    await prisma.$transaction(async (tx) => {
      // client.packageId আপডেট
      await tx.$executeRaw`
        UPDATE "Client"
        SET "packageId" = ${newPackageId}
        WHERE "id" = ${clientId};
      `;

      if (createAssignments) {
        await tx.$executeRaw`
          INSERT INTO "Assignment" ("id", "templateId", "clientId", "assignedAt", "status")
          SELECT gen_random_uuid(), t."id", ${clientId}, now(), 'active'
          FROM "Template" t
          WHERE t."packageId" = ${newPackageId}
            AND NOT EXISTS (
              SELECT 1 FROM "Assignment" a
              WHERE a."templateId" = t."id" AND a."clientId" = ${clientId}
            );
        `;
      }

      // best-effort activity log
      try {
        await tx.activityLog.create({
          data: {
            id: crypto.randomUUID(),
            entityType: "Client",
            entityId: clientId,
            userId: null,
            action: "upgrade_package",
            details: { newPackageId, createdAssignments: !!createAssignments },
          },
        });
      } catch {}
    });

    // নতুন প্যাকেজের assignments (মাইগ্রেটেড টাস্ক attach করার জন্য)
    const newAssignments = await prisma.assignment.findMany({
      where: { clientId, template: { packageId: newPackageId } },
      select: { id: true },
      orderBy: { assignedAt: "desc" },
    });
    const targetAssignmentId = newAssignments[0]?.id ?? null;

    // 2) ✅ পুরনো প্যাকেজের done টাস্ক → নতুন প্যাকেজে কপি (status/fields same)
    let migratedCount = 0;
    if (migrateCompleted && oldAssignmentIds.length && targetAssignmentId) {
      const DONE_STATUSES: TaskStatus[] = [
        "completed",
        "qc_approved",
        "data_entered",
      ];

      const oldDoneTasks = await prisma.task.findMany({
        where: {
          assignmentId: { in: oldAssignmentIds },
          status: { in: DONE_STATUSES },
        },
        select: {
          name: true,
          status: true,
          priority: true,
          idealDurationMinutes: true,
          dueDate: true,
          completedAt: true,
          completionLink: true,
          email: true,
          password: true,
          username: true,
          notes: true,
          category: { select: { id: true, name: true } },
        },
      });

      if (oldDoneTasks.length) {
        // নতুন অ্যাসাইনমেন্টে ডুপ্লিকেট নাম + ক্যাটাগরিতে আগেই আছে কি না চেক
        const names = Array.from(new Set(oldDoneTasks.map((t) => t.name)));
        const existing = await prisma.task.findMany({
          where: {
            assignmentId: targetAssignmentId,
            name: { in: names },
          },
          select: { name: true },
        });
        const existingNames = new Set(existing.map((e) => e.name));

        const createPayloads = oldDoneTasks
          .filter((t) => !existingNames.has(t.name))
          .map((t) => ({
            id: `task_migr_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2)}`,
            name: t.name, // same name; চাইলে "(migrated)" suffix দিতে পারেন
            status: t.status,
            priority: t.priority,
            idealDurationMinutes: t.idealDurationMinutes ?? undefined,
            dueDate: t.dueDate ?? undefined,
            completedAt: t.completedAt ?? undefined,
            completionLink: t.completionLink ?? undefined,
            email: t.email ?? undefined,
            password: t.password ?? undefined,
            username: t.username ?? undefined,
            notes: t.notes
              ? `${t.notes}\n\n[migrated-from-old-package]`
              : "[migrated-from-old-package]",
            assignment: { connect: { id: targetAssignmentId } },
            client: { connect: { id: clientId } },
            ...(t.category?.id
              ? { category: { connect: { id: t.category.id } } }
              : undefined),
          }));

        if (createPayloads.length) {
          await prisma.$transaction((tx) =>
            Promise.all(createPayloads.map((data) => tx.task.create({ data })))
          );
          migratedCount = createPayloads.length;
        }
      }
    }

    // 3) ✅ একই রুলে নতুন posting tasks অটো-ক্রিয়েট (বিদ্যমান রুটকে সার্ভার-টু-সার্ভার কল)
    // 3) ✅ NEW: শুধু non-common site-asset গুলোর জন্য posting tasks অটো-ক্রিয়েট
    let createdPosting = 0;
    if (createPostingTasks) {
      try {
        // old/new প্যাকেজের TemplateSiteAsset তুলুন (name+type দিয়ে common নির্ণয়)
        const [oldAssets, newAssets] = await Promise.all([
          oldPackageId
            ? prisma.templateSiteAsset.findMany({
                where: { template: { packageId: oldPackageId } },
                select: { id: true, name: true, type: true },
              })
            : Promise.resolve(
                [] as { id: number; name: string | null; type: string | null }[]
              ),
          prisma.templateSiteAsset.findMany({
            where: { template: { packageId: newPackageId } },
            select: { id: true, name: true, type: true },
          }),
        ]);

        const norm = (s: string | null | undefined) =>
          String(s ?? "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        const keyOf = (a: { name: string | null; type: string | null }) =>
          `${norm(a.type)}::${norm(a.name)}`;

        const oldKeys = new Set(oldAssets.map(keyOf));
        const newOnlyAssetIds = newAssets
          .filter((a) => !oldKeys.has(keyOf(a)))
          .map((a) => a.id);

        if (newOnlyAssetIds.length) {
          const headersList = await headers();
          const host = headersList.get("host");
          const url = `${
            process.env.NEXT_PUBLIC_APP_URL ?? `http://${host}`
          }/api/tasks/create-posting-tasks`;
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId,
              // 👉 শুধু non-common asset গুলো অন্তর্ভুক্ত করলাম
              includeAssetIds: newOnlyAssetIds,
            }),
          });
          const j = await resp.json().catch(() => ({}));
          if (resp.ok) {
            createdPosting = Number(j?.created ?? 0);
          } else {
            console.warn("[create-posting-tasks] failed:", j?.message);
          }
        } else {
          console.log("[create-posting-tasks] skipped: no non-common assets");
        }
      } catch (e) {
        console.warn("[create-posting-tasks] call error:", e);
      }
    }

    // fresh progress
    const fresh = await recalcAndStoreClientProgress(clientId);

    // upgraded snapshot
    const upgraded = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        package: true,
        accountManager: { include: { role: true } },
        teamMembers: {
          include: { agent: { include: { role: true } }, team: true },
        },
        tasks: {
          include: {
            assignedTo: { include: { role: true } },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: { agent: { include: { role: true } }, team: true },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: { include: { assignedTo: true, templateSiteAsset: true } },
          },
        },
      },
    });

    return NextResponse.json({
      message: "Client upgraded & migrated successfully",
      stats: {
        migratedCompletedFromOldPackage: migratedCount,
        createdPostingTasks: createdPosting,
      },
      client: {
        ...upgraded,
        progress: fresh.progress,
        taskCounts: fresh.taskCounts,
      },
    });
  } catch (error) {
    console.error(
      `[Client Upgrade] clientId=${(await params).id} failed:`,
      error
    );
    return NextResponse.json(
      { message: "Failed to upgrade client" },
      { status: 500 }
    );
  }
}
