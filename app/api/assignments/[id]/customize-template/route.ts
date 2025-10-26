// app/api/assignments/[id]/customize-template/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  TaskStatus,
  TaskPriority,
  SiteAssetType,
  PeriodType,
} from "@prisma/client";
import { randomUUID } from "crypto";
import {
  authenticateUser,
  canModifyAssignment,
  getAuthErrorResponse,
} from "@/lib/auth-middleware";

/**
 * ONE-STEP SOLUTION: Clone template and sync assignment
 * 
 * This endpoint:
 * 1. Clones the current template (or specified template) for this specific client
 * 2. Updates the assignment to use the new custom template
 * 3. Allows adding new site assets to the custom template
 * 4. Generates tasks only for the NEW assets
 * 5. Does NOT affect existing tasks or other clients
 * 
 * POST /api/assignments/{assignmentId}/customize-template
 * Body: {
 *   newAssets?: Array<{ // New site assets to add
 *     type: SiteAssetType,
 *     name: string,
 *     customName?: string, // Optional custom name that overrides default name
 *     url?: string,
 *     description?: string,
 *     isRequired: boolean,
 *     defaultPostingFrequency?: number,
 *     defaultIdealDurationMinutes?: number
 *   }>,
 *   replacements?: Array<{ // Replace existing assets
 *     oldAssetId: number, // ID from current template
 *     newAssetName: string,
 *     newAssetType?: SiteAssetType,
 *     newAssetUrl?: string,
 *     newAssetDescription?: string,
 *     isRequired?: boolean,
 *     defaultPostingFrequency?: number,
 *     defaultIdealDurationMinutes?: number
 *   }>,
 *   customTemplateName?: string // Optional custom name for the new template
 *   idempotencyKey?: string // Optional key to prevent duplicate operations
 *   forceRecreate?: boolean // Force recreate even if idempotency key exists (default: false)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  try {
    // 🔒 AUTH CHECK: Authenticate and authorize user
    const authContext = await authenticateUser(request);
    
    if (!(await canModifyAssignment(authContext.userId, assignmentId))) {
      return NextResponse.json(
        { message: "You do not have permission to modify this assignment" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      newAssets = [],
      replacements = [],
      customTemplateName,
      idempotencyKey,
      forceRecreate = false,
    } = body as {
      newAssets?: Array<{
        type: SiteAssetType;
        name: string;
        customName?: string;  // Optional custom name
        url?: string;
        description?: string;
        isRequired: boolean;
        defaultPostingFrequency?: number;
        defaultIdealDurationMinutes?: number;
      }>;
      replacements?: Array<{
        oldAssetId: number;
        newAssetName: string;
        newAssetType?: SiteAssetType;
        newAssetUrl?: string;
        newAssetDescription?: string;
        isRequired?: boolean;
        defaultPostingFrequency?: number;
        defaultIdealDurationMinutes?: number;
      }>;
      customTemplateName?: string;
      idempotencyKey?: string;
      forceRecreate?: boolean;
    };

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
      // 1) Load current assignment
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          client: true,
          template: {
            include: {
              sitesAssets: true,
              templateTeamMembers: true,
            },
          },
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
          siteAssetSettings: true,
        },
      });

      if (!assignment) {
        throw new Error("ASSIGNMENT_NOT_FOUND");
      }

      if (!assignment.template) {
        throw new Error("NO_TEMPLATE_ATTACHED");
      }

      const sourceTemplate = assignment.template;
      const client = assignment.client;

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      // 1.5) 🔥 IDEMPOTENCY CHECK: Prevent duplicate customizations
      if (idempotencyKey && !forceRecreate) {
        // Check if this operation was already performed
        const existingLog = await tx.activityLog.findFirst({
          where: {
            entityType: "Assignment",
            entityId: assignmentId,
            action: "customize_template",
            details: {
              path: ["idempotencyKey"],
              equals: idempotencyKey,
            },
          },
          orderBy: { timestamp: "desc" },
        });

        if (existingLog) {
          // Operation already completed, return existing result
          const existingAssignment = await tx.assignment.findUnique({
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

          return {
            assignment: existingAssignment,
            skipped: true,
            reason: "Operation already completed (idempotency)",
            previousOperation: existingLog.timestamp,
          };
        }
      }

      // 2) Generate unique custom template name
      const baseName =
        customTemplateName ||
        `${sourceTemplate.name || "Template"} (Custom for ${client.name})`;
      let uniqueName = baseName;
      let counter = 1;

      while (
        await tx.template.findFirst({
          where: { name: uniqueName },
          select: { id: true },
        })
      ) {
        uniqueName = `${baseName} (${counter++})`;
      }

      // 3) Create custom template (clone)
      const customTemplate = await tx.template.create({
        data: {
          name: uniqueName,
          description: `Custom template for client: ${client.name}. Modified from: ${sourceTemplate.name}`,
          packageId: sourceTemplate.packageId || client.packageId || null,
          status: "active",
        },
      });

      // 4) Clone all existing SiteAssets from source template
      const clonedAssetMap = new Map<number, number>(); // oldId -> newId

      if (sourceTemplate.sitesAssets.length > 0) {
        for (const asset of sourceTemplate.sitesAssets) {
          const newAsset = await tx.templateSiteAsset.create({
            data: {
              templateId: customTemplate.id,
              type: asset.type,
              name: asset.name,
              url: asset.url || null,
              description: asset.description || null,
              isRequired: asset.isRequired,
              defaultPostingFrequency: asset.defaultPostingFrequency ?? null,
              defaultIdealDurationMinutes:
                asset.defaultIdealDurationMinutes ?? null,
            },
          });
          clonedAssetMap.set(asset.id, newAsset.id);
        }
      }

      // 5) Clone Template Team Members
      if (sourceTemplate.templateTeamMembers.length > 0) {
        await tx.templateTeamMember.createMany({
          data: sourceTemplate.templateTeamMembers.map((member) => ({
            templateId: customTemplate.id,
            agentId: member.agentId,
            role: member.role || null,
            teamId: member.teamId || null,
            assignedDate: member.assignedDate || null,
          })),
          skipDuplicates: true,
        });
      }

      // 🔥 5.5) CRITICAL: Migrate ALL AssignmentSiteAssetSettings from old → new asset IDs
      // This preserves client-specific frequency/duration overrides for ALL assets (not just replacements)
      const settingsMigrated: any[] = [];
      
      if (assignment.siteAssetSettings.length > 0) {
        for (const oldSetting of assignment.siteAssetSettings) {
          const oldAssetId = oldSetting.templateSiteAssetId;
          const newAssetId = clonedAssetMap.get(oldAssetId);

          if (newAssetId) {
            // Create new setting with same values but new asset ID
            await tx.assignmentSiteAssetSetting.create({
              data: {
                assignmentId: assignment.id,
                templateSiteAssetId: newAssetId, // ← NEW cloned asset ID
                requiredFrequency: oldSetting.requiredFrequency,
                period: oldSetting.period,
                idealDurationMinutes: oldSetting.idealDurationMinutes,
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

      // 6) Ensure task categories exist
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

      const now = new Date();
      const defaultDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const tasksCreated: any[] = [];
      const tasksArchived: any[] = [];
      const assetsAdded: any[] = [];
      const assetsReplaced: any[] = [];

      // 7) Handle REPLACEMENTS
      for (const replacement of replacements) {
        const oldAssetId = replacement.oldAssetId;
        const newAssetInClonedTemplate = clonedAssetMap.get(oldAssetId);

        if (!newAssetInClonedTemplate) {
          console.warn(`Old asset ${oldAssetId} not found in cloned template`);
          continue;
        }

        // Get the old asset from source to preserve type/settings if not specified
        const oldAsset = sourceTemplate.sitesAssets.find(
          (a) => a.id === oldAssetId
        );

        // Update the cloned asset with new values
        const updatedAsset = await tx.templateSiteAsset.update({
          where: { id: newAssetInClonedTemplate },
          data: {
            name: replacement.newAssetName,
            type: replacement.newAssetType || oldAsset?.type,
            url: replacement.newAssetUrl ?? oldAsset?.url,
            description:
              replacement.newAssetDescription ?? oldAsset?.description,
            isRequired:
              replacement.isRequired ?? oldAsset?.isRequired ?? false,
            defaultPostingFrequency:
              replacement.defaultPostingFrequency ??
              oldAsset?.defaultPostingFrequency,
            defaultIdealDurationMinutes:
              replacement.defaultIdealDurationMinutes ??
              oldAsset?.defaultIdealDurationMinutes,
          },
        });

        assetsReplaced.push({
          oldAssetId,
          newAssetId: updatedAsset.id,
          oldName: oldAsset?.name,
          newName: updatedAsset.name,
        });

        // Archive old tasks for this asset (using OLD asset ID from source template)
        const oldTasks = assignment.tasks.filter(
          (t) => t.templateSiteAssetId === oldAssetId
        );

        for (const task of oldTasks) {
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.cancelled,
              notes: `${task.notes || ""}\n\n[AUTO-ARCHIVED] Replaced by: ${updatedAsset.name}`,
            },
          });

          tasksArchived.push({
            taskId: task.id,
            taskName: task.name,
            oldAssetId,
            newAssetId: updatedAsset.id,
            reason: "replaced",
          });
        }

        // Create new task for replaced asset (using NEW asset ID from cloned template)
        const categoryName =
          CATEGORY_NAME_BY_TYPE[updatedAsset.type as SiteAssetType] ??
          "Other Task";
        const categoryId = categoryIdByName.get(categoryName) ?? null;

        const newTask = {
          id: randomUUID(),
          name: `${updatedAsset.name} Task`,
          assignmentId: assignment.id,
          clientId: assignment.clientId,
          templateSiteAssetId: updatedAsset.id, // Use NEW asset ID
          categoryId,
          dueDate: defaultDueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes: updatedAsset.defaultIdealDurationMinutes ?? 30,
          notes: `[REPLACEMENT] This replaces: ${oldAsset?.name || "old asset"}`,
        };

        await tx.task.create({ data: newTask });
        tasksCreated.push({
          taskId: newTask.id,
          taskName: newTask.name,
          assetId: updatedAsset.id,
          assetName: updatedAsset.name,
          type: "replacement",
        });

        // Update setting for replaced asset (already migrated, just update values)
        // Since we already migrated settings from old → new IDs, we update the NEW asset ID
        await tx.assignmentSiteAssetSetting.updateMany({
          where: {
            assignmentId: assignment.id,
            templateSiteAssetId: updatedAsset.id, // Use NEW asset ID (already migrated)
          },
          data: {
            requiredFrequency: updatedAsset.defaultPostingFrequency ?? null,
            idealDurationMinutes:
              updatedAsset.defaultIdealDurationMinutes ?? null,
          },
        });
      }

      // 8) Add NEW assets to custom template
      for (const newAssetData of newAssets) {
        // Use customName if provided, otherwise use default name
        const finalAssetName = newAssetData.customName?.trim() || newAssetData.name;
        
        const newAsset = await tx.templateSiteAsset.create({
          data: {
            templateId: customTemplate.id,
            type: newAssetData.type,
            name: finalAssetName,  // Use customName if provided
            url: newAssetData.url || null,
            description: newAssetData.description || null,
            isRequired: newAssetData.isRequired,
            defaultPostingFrequency:
              newAssetData.defaultPostingFrequency ?? 3,  // Default to 3 instead of null
            defaultIdealDurationMinutes:
              newAssetData.defaultIdealDurationMinutes ?? null,
          },
        });

        assetsAdded.push({
          assetId: newAsset.id,
          assetName: newAsset.name,
          assetType: newAsset.type,
          customNameUsed: !!newAssetData.customName,
        });

        // Create task for new asset
        const categoryName =
          CATEGORY_NAME_BY_TYPE[newAsset.type as SiteAssetType] ?? "Other Task";
        const categoryId = categoryIdByName.get(categoryName) ?? null;

        const newTask = {
          id: randomUUID(),
          name: `${newAsset.name} Task`,  // Will use the customName if it was provided
          assignmentId: assignment.id,
          clientId: assignment.clientId,
          templateSiteAssetId: newAsset.id,
          categoryId,
          dueDate: defaultDueDate,
          status: TaskStatus.pending,
          priority: TaskPriority.medium,
          idealDurationMinutes: newAsset.defaultIdealDurationMinutes ?? 30,
          notes: `[NEW ASSET] Added to custom template`,
        };

        await tx.task.create({ data: newTask });
        tasksCreated.push({
          taskId: newTask.id,
          taskName: newTask.name,
          assetId: newAsset.id,
          assetName: newAsset.name,
          type: "new",
        });

        // Create setting for new asset
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

      // 9) Update assignment to use custom template
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          templateId: customTemplate.id,
        },
      });

      // 10) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Assignment",
          entityId: assignmentId,
          userId: actorId,
          action: "customize_template",
          details: {
            originalTemplateId: sourceTemplate.id,
            originalTemplateName: sourceTemplate.name,
            customTemplateId: customTemplate.id,
            customTemplateName: customTemplate.name,
            clientId: client.id,
            clientName: client.name,
            tasksCreated: tasksCreated.length,
            tasksArchived: tasksArchived.length,
            assetsAdded: assetsAdded.length,
            assetsReplaced: assetsReplaced.length,
            settingsMigrated: settingsMigrated.length, // Track migrated settings
            idempotencyKey: idempotencyKey || null, // Store for idempotency check
            details: {
              tasksCreated,
              tasksArchived,
              assetsAdded,
              assetsReplaced,
              settingsMigrated, // Include migration details
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

    if (!result) {
      throw new Error("Transaction returned null result");
    }

    // Check if operation was skipped due to idempotency
    if ("skipped" in result && result.skipped) {
      return NextResponse.json(
        {
          message: "Operation already completed (idempotency check)",
          skipped: true,
          previousOperation: result.previousOperation,
          assignment: result.assignment,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Custom template created and assignment updated successfully",
        assignment: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    // Handle auth errors
    if (error?.message === "UNAUTHORIZED" || error?.message === "USER_NOT_FOUND" || error?.message === "FORBIDDEN") {
      const authError = getAuthErrorResponse(error);
      return NextResponse.json(
        { message: authError.message },
        { status: authError.status }
      );
    }

    if (error?.message === "ASSIGNMENT_NOT_FOUND") {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }
    if (error?.message === "NO_TEMPLATE_ATTACHED") {
      return NextResponse.json(
        { message: "Assignment has no template attached" },
        { status: 400 }
      );
    }
    if (error?.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }
    console.error("Customize template error:", error);
    return NextResponse.json(
      {
        message: "Failed to customize template",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
