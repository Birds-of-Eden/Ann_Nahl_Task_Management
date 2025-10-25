// app/api/assignments/[id]/sync-template/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  TaskStatus,
  TaskPriority,
  SiteAssetType,
  PeriodType,
} from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Sync assignment with a new/updated template
 * Detects new and replaced SiteAssets
 * Creates tasks for new assets
 * Archives tasks for replaced assets
 * 
 * POST /api/assignments/{assignmentId}/sync-template
 * Body: { 
 *   newTemplateId: string,
 *   replacements?: Array<{ oldAssetId: number, newAssetId: number }>,
 *   autoArchiveOld?: boolean (default: true)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    const body = await request.json();
    const {
      newTemplateId,
      replacements = [],
      autoArchiveOld = true,
      commonAssetMappings = [],
    } = body as {
      newTemplateId: string;
      replacements?: Array<{ oldAssetId: number; newAssetId: number }>;
      autoArchiveOld?: boolean;
      commonAssetMappings?: Array<{ oldAssetId: number; newAssetId: number }>;
    };

    if (!newTemplateId) {
      return NextResponse.json(
        { message: "newTemplateId is required" },
        { status: 400 }
      );
    }

    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    const CATEGORY_NAME_BY_TYPE: Record<SiteAssetType, string> = {
      social_site: "Social Asset Creation",
      web2_site: "Web 2.0 Asset Creation",
      other_asset: "Additional Asset Creation",
      graphics_design: "Graphics Design",
      image_optimization: "Image Optimization",
      content_studio: "Content Studio",
      content_writing: "Content Writing",
      backlinks: "Backlinks",
      completed_com: "Completed Communication",
      youtube_video_optimization: "YouTube Video Optimization",
      monitoring: "Monitoring",
      review_removal: "Review Removal",
      summary_report: "Summary Report",
      guest_posting: "Guest Posting",
    };

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load current assignment with existing data
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
            },
          },
          siteAssetSettings: true,
          tasks: {
            where: {
              status: {
                notIn: [TaskStatus.cancelled],
              },
            },
            include: {
              templateSiteAsset: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new Error("ASSIGNMENT_NOT_FOUND");
      }

      // 2) Load new template with its assets
      const newTemplate = await tx.template.findUnique({
        where: { id: newTemplateId },
        include: {
          sitesAssets: true,
        },
      });

      if (!newTemplate) {
        throw new Error("TEMPLATE_NOT_FOUND");
      }

      // 3) Ensure task categories exist
      const categoryNames = Array.from(
        new Set(Object.values(CATEGORY_NAME_BY_TYPE))
      );
      await Promise.all(
        categoryNames.map((name) =>
          tx.taskCategory.upsert({
            where: { name },
            create: { name },
            update: {},
          })
        )
      );

      const categories = await tx.taskCategory.findMany();
      const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

      // 4) Build a map of existing templateSiteAssetIds for this assignment
      const existingAssetIds = new Set(
        assignment.siteAssetSettings.map((s) => s.templateSiteAssetId)
      );

      // 5) Identify NEW assets (not in existing)
      const newAssets = newTemplate.sitesAssets.filter(
        (asset) => !existingAssetIds.has(asset.id)
      );

      // 6) Build replacement map
      const replacementMap = new Map(
        replacements.map((r) => [r.oldAssetId, r.newAssetId])
      );

      const now = new Date();
      const defaultDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const tasksCreated: any[] = [];
      const tasksArchived: any[] = [];
      const settingsCreated: any[] = [];
      const settingsMigrated: any[] = [];

      // 7) Handle REPLACEMENTS: Archive old tasks and create new ones
      for (const [oldAssetId, newAssetId] of replacementMap.entries()) {
        // Find the new asset details
        const newAsset = newTemplate.sitesAssets.find(
          (a) => a.id === newAssetId
        );
        if (!newAsset) {
          console.warn(`Replacement asset ${newAssetId} not found in new template`);
          continue;
        }

        // Archive old tasks for this asset
        if (autoArchiveOld) {
          const oldTasks = assignment.tasks.filter(
            (t) => t.templateSiteAssetId === oldAssetId
          );

          for (const task of oldTasks) {
            await tx.task.update({
              where: { id: task.id },
              data: {
                status: TaskStatus.cancelled,
                notes: `${task.notes || ""}\n\n[AUTO-ARCHIVED] Replaced by new asset: ${newAsset.name}`,
              },
            });

            tasksArchived.push({
              taskId: task.id,
              taskName: task.name,
              oldAssetId,
              newAssetId,
              reason: "replaced",
            });
          }
        }

        // Create new task for replacement asset
        const categoryName =
          CATEGORY_NAME_BY_TYPE[newAsset.type as SiteAssetType] ?? "Other Task";
        const categoryId = categoryIdByName.get(categoryName) ?? null;

        const newTask = {
          id: randomUUID(),
          name: `${newAsset.name} Task`,
          assignmentId: assignment.id,
          clientId: assignment.clientId,
          templateSiteAssetId: newAsset.id,
          categoryId,
          dueDate: defaultDueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes: newAsset.defaultIdealDurationMinutes ?? 30,
          notes: `[REPLACEMENT] This replaces old asset ID: ${oldAssetId}`,
        };

        await tx.task.create({ data: newTask });
        tasksCreated.push({
          taskId: newTask.id,
          taskName: newTask.name,
          assetId: newAsset.id,
          assetName: newAsset.name,
          type: "replacement",
        });

        // Create/update setting for new asset
        const existingSetting = await tx.assignmentSiteAssetSetting.findFirst({
          where: {
            assignmentId: assignment.id,
            templateSiteAssetId: newAsset.id,
          },
        });

        if (existingSetting) {
          await tx.assignmentSiteAssetSetting.update({
            where: { id: existingSetting.id },
            data: {
              requiredFrequency: newAsset.defaultPostingFrequency ?? null,
              idealDurationMinutes: newAsset.defaultIdealDurationMinutes ?? null,
            },
          });
        } else {
          await tx.assignmentSiteAssetSetting.create({
            data: {
              assignmentId: assignment.id,
              templateSiteAssetId: newAsset.id,
              requiredFrequency: newAsset.defaultPostingFrequency ?? null,
              period: PeriodType.monthly,
              idealDurationMinutes: newAsset.defaultIdealDurationMinutes ?? null,
            },
          });
        }

        settingsCreated.push({
          assetId: newAsset.id,
          assetName: newAsset.name,
          type: "replacement",
        });
      }

      // 8) Handle NEW assets: Create tasks and settings
      for (const asset of newAssets) {
        // Skip if this asset is already part of a replacement
        if (Array.from(replacementMap.values()).includes(asset.id)) {
          continue;
        }

        const categoryName =
          CATEGORY_NAME_BY_TYPE[asset.type as SiteAssetType] ?? "Other Task";
        const categoryId = categoryIdByName.get(categoryName) ?? null;

        const newTask = {
          id: randomUUID(),
          name: `${asset.name} Task`,
          assignmentId: assignment.id,
          clientId: assignment.clientId,
          templateSiteAssetId: asset.id,
          categoryId,
          dueDate: defaultDueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes: asset.defaultIdealDurationMinutes ?? 30,
          notes: `[NEW ASSET] Added to existing assignment`,
        };

        await tx.task.create({ data: newTask });
        tasksCreated.push({
          taskId: newTask.id,
          taskName: newTask.name,
          assetId: asset.id,
          assetName: asset.name,
          type: "new",
        });

        // Create setting for new asset
        await tx.assignmentSiteAssetSetting.create({
          data: {
            assignmentId: assignment.id,
            templateSiteAssetId: asset.id,
            requiredFrequency: asset.defaultPostingFrequency ?? null,
            period: PeriodType.monthly,
            idealDurationMinutes: asset.defaultIdealDurationMinutes ?? null,
          },
        });

        settingsCreated.push({
          assetId: asset.id,
          assetName: asset.name,
          type: "new",
        });
      }

      // 8.5) 🔥 CRITICAL: Migrate settings for COMMON assets (not replaced, not new)
      // When switching to a completely different template, preserve client overrides for common assets
      if (commonAssetMappings.length > 0) {
        for (const mapping of commonAssetMappings) {
          const { oldAssetId, newAssetId } = mapping;

          // Find existing setting for old asset
          const oldSetting = assignment.siteAssetSettings.find(
            (s) => s.templateSiteAssetId === oldAssetId
          );

          // Only migrate if we have an existing setting with client overrides
          if (oldSetting) {
            // Create setting for new asset with same values
            await tx.assignmentSiteAssetSetting.create({
              data: {
                assignmentId: assignment.id,
                templateSiteAssetId: newAssetId, // ← new template's asset ID
                requiredFrequency: oldSetting.requiredFrequency, // ← preserve
                period: oldSetting.period, // ← preserve
                idealDurationMinutes: oldSetting.idealDurationMinutes, // ← preserve
              },
            });

            settingsMigrated.push({
              oldAssetId,
              newAssetId,
              requiredFrequency: oldSetting.requiredFrequency,
              period: oldSetting.period,
            });
          }
        }
      }

      // 9) Update assignment with new templateId
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          templateId: newTemplateId,
        },
      });

      // 10) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Assignment",
          entityId: assignmentId,
          userId: actorId,
          action: "sync_template",
          details: {
            oldTemplateId: assignment.templateId,
            newTemplateId,
            clientId: assignment.clientId,
            clientName: assignment.client?.name,
            tasksCreated: tasksCreated.length,
            tasksArchived: tasksArchived.length,
            settingsCreated: settingsCreated.length,
            settingsMigrated: settingsMigrated.length, // ← Track migrated settings
            replacements: replacements.length,
            commonAssetMappings: commonAssetMappings.length,
            details: {
              tasksCreated,
              tasksArchived,
              settingsCreated,
              settingsMigrated, // ← Include migration details
            },
          },
        },
      });

      // Return updated assignment
      return await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
              templateTeamMembers: {
                include: {
                  agent: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
          tasks: {
            include: {
              assignedTo: true,
              category: true,
              templateSiteAsset: true,
            },
            orderBy: { createdAt: "desc" },
          },
          siteAssetSettings: {
            include: {
              templateSiteAsset: true,
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        message: "Assignment synced successfully with new template",
        assignment: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.message === "ASSIGNMENT_NOT_FOUND") {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }
    if (error?.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { message: "New template not found" },
        { status: 404 }
      );
    }
    console.error("Sync template error:", error);
    return NextResponse.json(
      {
        message: "Failed to sync template",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
