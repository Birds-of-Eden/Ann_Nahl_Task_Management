// app/api/clients/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

// --- helpers ---
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
        socialMedias: true,
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

    // রেসপন্সে fresh progress + taskCounts যুক্ত করে পাঠাই
    return NextResponse.json({
      ...client,
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
      } as any,
      include: {
        socialMedias: true,
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
// --- POST --- (upgrade with template-scoped non-common assets & done-task migration)
import { headers } from "next/headers";

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
            "Unsupported action. Use { action: 'upgrade', newPackageId, templateId?, createAssignments?, migrateCompleted?, createPostingTasks? }",
        },
        { status: 400 }
      );
    }

    const newPackageId = String(body?.newPackageId || "").trim();
    const selectedTemplateId: string | null =
      typeof body?.templateId === "string" && body?.templateId.trim()
        ? body.templateId.trim()
        : null;

    const createAssignments: boolean = body?.createAssignments ?? true; // default: true
    const migrateCompleted: boolean = body?.migrateCompleted ?? true; // default: true
    const createPostingTasks: boolean = body?.createPostingTasks ?? true; // default: true

    if (!newPackageId) {
      return NextResponse.json(
        { message: "newPackageId is required" },
        { status: 400 }
      );
    }

    // validate client & package presence, and capture oldPackageId
    const clientRow = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, packageId: true },
    });
    if (!clientRow) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }
    const oldPackageId = clientRow.packageId;

    const pkg = await prisma.package.findUnique({
      where: { id: newPackageId },
      select: { id: true },
    });
    if (!pkg) {
      return NextResponse.json(
        { message: "Package not found" },
        { status: 404 }
      );
    }

    console.log(
      `[Client Upgrade] clientId=${clientId} oldPackageId=${
        oldPackageId ?? "null"
      } -> newPackageId=${newPackageId} templateId=${
        selectedTemplateId ?? "null"
      } createAssignments=${createAssignments} migrateCompleted=${migrateCompleted} createPostingTasks=${createPostingTasks}`
    );

    // --- 1) Update client package & (optionally) create assignments for new package templates
    await prisma.$transaction(async (tx) => {
      // 1.a) update client -> new package
      await tx.$executeRaw`
        UPDATE "Client"
        SET "packageId" = ${newPackageId}
        WHERE "id" = ${clientId};
      `;

      // 1.b) create assignments (if opted-in)
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

      // 1.c) activity log (best-effort)
      try {
        await tx.activityLog.create({
          data: {
            id: crypto.randomUUID(),
            entityType: "Client",
            entityId: clientId,
            userId: null,
            action: "upgrade_package",
            details: {
              newPackageId,
              templateId: selectedTemplateId,
              createdAssignments: !!createAssignments,
            },
          },
        });
      } catch {
        /* ignore */
      }
    });

    // --- 2) (Option) Migrate done tasks from old package → into a target new assignment
    // We copy: completed/qc_approved/data_entered — keep status/fields; skip duplicate names in target
    if (migrateCompleted && oldPackageId) {
      try {
        // old assignments under old package
        const oldAssignments = await prisma.assignment.findMany({
          where: { clientId, template: { packageId: oldPackageId } },
          select: { id: true },
        });
        const oldAssignmentIds = oldAssignments.map((a) => a.id);
        if (oldAssignmentIds.length) {
          // target assignment: selected template if provided; else newest under new package
          let targetAssignment = selectedTemplateId
            ? await prisma.assignment.findFirst({
                where: { clientId, templateId: selectedTemplateId },
                orderBy: { assignedAt: "desc" },
                select: { id: true },
              })
            : await prisma.assignment.findFirst({
                where: { clientId, template: { packageId: newPackageId } },
                orderBy: { assignedAt: "desc" },
                select: { id: true },
              });

          // if not found (e.g. createAssignments=false), create one against selected template (if provided)
          if (!targetAssignment && selectedTemplateId) {
            targetAssignment = await prisma.assignment.create({
              data: {
                clientId,
                templateId: selectedTemplateId,
                status: "active",
                assignedAt: new Date(),
              },
              select: { id: true },
            });
          }

          if (targetAssignment) {
            // fetch existing task names in target (avoid duplicates by name)
            const existingNames = await prisma.task.findMany({
              where: { assignmentId: targetAssignment.id },
              select: { name: true },
            });
            const nameSkip = new Set(existingNames.map((t) => t.name));

            // fetch done tasks from old package
            const doneStatuses: TaskStatus[] = [
              "completed",
              "qc_approved",
              "data_entered",
            ];
            const oldDone = await prisma.task.findMany({
              where: {
                assignmentId: { in: oldAssignmentIds },
                status: { in: doneStatuses },
              },
              select: {
                name: true,
                status: true,
                priority: true,
                idealDurationMinutes: true,
                dueDate: true,
                completionLink: true,
                email: true,
                password: true,
                username: true,
                notes: true,
                categoryId: true,
              },
              take: 2000, // safety cap
            });

            if (oldDone.length) {
              const payloads: Prisma.TaskCreateArgs["data"][] = [];
              for (const src of oldDone) {
                if (!src.name || nameSkip.has(src.name)) continue;
                payloads.push({
                  id: `task_migrate_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2)}`,
                  name: src.name,
                  status: src.status,
                  priority: src.priority,
                  idealDurationMinutes: src.idealDurationMinutes ?? undefined,
                  dueDate: src.dueDate ?? undefined,
                  completionLink: src.completionLink ?? undefined,
                  email: src.email ?? undefined,
                  password: src.password ?? undefined,
                  username: src.username ?? undefined,
                  notes: src.notes ?? undefined,
                  client: { connect: { id: clientId } },
                  assignment: { connect: { id: targetAssignment.id } },
                  ...(src.categoryId
                    ? { category: { connect: { id: src.categoryId } } }
                    : {}),
                });
              }

              if (payloads.length) {
                // chunk create to avoid big transactions (simple batching)
                const chunk = 100;
                for (let i = 0; i < payloads.length; i += chunk) {
                  const slice = payloads.slice(i, i + chunk);
                  // transaction-per-chunk
                  await prisma.$transaction(
                    slice.map((data) =>
                      prisma.task.create({
                        data,
                        select: { id: true },
                      })
                    )
                  );
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Migration] Copy done tasks failed:", e);
      }
    }

    // --- 3) Auto-create posting tasks ONLY for non-common assets of the SELECTED TEMPLATE
    let createdPosting = 0;
    if (createPostingTasks) {
      try {
        // old vs new-scoped assets
        const [oldAssets, newScopedAssets] = await Promise.all([
          oldPackageId
            ? prisma.templateSiteAsset.findMany({
                where: { template: { packageId: oldPackageId } },
                select: { id: true, name: true, type: true },
              })
            : Promise.resolve(
                [] as { id: number; name: string | null; type: string | null }[]
              ),
          prisma.templateSiteAsset.findMany({
            where: {
              template: selectedTemplateId
                ? { id: selectedTemplateId } // template-scoped
                : { packageId: newPackageId }, // fallback: whole new package
            },
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
        const newOnlyAssetIds = newScopedAssets
          .filter((a) => !oldKeys.has(keyOf(a)))
          .map((a) => a.id);

        if (newOnlyAssetIds.length) {
          const base =
            process.env.NEXT_PUBLIC_APP_URL ??
            process.env.APP_URL ??
            `http://${headers().get("host")}`;
          const resp = await fetch(`${base}/api/tasks/create-posting-tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId,
              templateId: selectedTemplateId ?? undefined, // optional pass-through
              includeAssetIds: newOnlyAssetIds, // only non-common assets
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

    // --- 4) fresh client + progress
    const freshProgress = await (async () => {
      try {
        // reuse your compute & persist
        const grouped = await prisma.task.groupBy({
          by: ["status"],
          where: { clientId },
          _count: { _all: true },
        });

        const baseCounts: Record<TaskStatus, number> = {
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
        for (const row of grouped) baseCounts[row.status] = row._count._all;

        const total =
          baseCounts.pending +
          baseCounts.in_progress +
          baseCounts.completed +
          baseCounts.overdue +
          baseCounts.cancelled +
          baseCounts.reassigned +
          baseCounts.qc_approved;

        const progress =
          total > 0 ? Math.round((baseCounts.completed / total) * 100) : 0;

        await prisma.client.update({
          where: { id: clientId },
          data: { progress },
          select: { id: true },
        });

        return {
          progress,
          taskCounts: {
            total,
            completed: baseCounts.completed,
            pending: baseCounts.pending,
            in_progress: baseCounts.in_progress,
            overdue: baseCounts.overdue,
            cancelled: baseCounts.cancelled,
            reassigned: baseCounts.reassigned,
            qc_approved: baseCounts.qc_approved,
          },
        };
      } catch {
        return { progress: 0, taskCounts: null as any };
      }
    })();

    const upgraded = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        socialMedias: true,
        package: true,
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

    return NextResponse.json({
      message: "Client upgraded successfully",
      createdPosting,
      client: {
        ...upgraded,
        progress: freshProgress.progress,
        taskCounts: freshProgress.taskCounts,
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
