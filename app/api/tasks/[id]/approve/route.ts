// app/api/tasks/[id]/approve/route.ts

import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Rating = "Excellent" | "Good" | "Average" | "Lazy";

const VALID_RATINGS: Rating[] = [
  "Excellent",
  "Good",
  "Average",
  "Lazy",
] as const;

function timerScoreFromRating(r: Rating): number {
  switch (r) {
    case "Excellent":
      return 70; // 70% of 100
    case "Good":
      return 60;
    case "Average":
      return 50;
    case "Lazy":
      return 40;
  }
}

function clampInt(n: unknown, min: number, max: number): number {
  const x = Number.parseInt(String(n ?? ""), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      // required
      performanceRating,
      // manual 6 metrics (each 0..5)
      keyword = 0,
      contentQuality = 0,
      image = 0,
      seo = 0,
      grammar = 0,
      humanization = 0,
      // optional meta
      reviewerId,
      notes,
    }: {
      performanceRating?: Rating;
      keyword?: number;
      contentQuality?: number;
      image?: number;
      seo?: number;
      grammar?: number;
      humanization?: number;
      reviewerId?: string;
      notes?: string;
    } = body ?? {};

    // ---- Validate rating ----
    if (!performanceRating || !VALID_RATINGS.includes(performanceRating)) {
      return NextResponse.json(
        {
          error:
            "Valid performanceRating is required (Excellent|Good|Average|Lazy).",
        },
        { status: 400 }
      );
    }

    // ---- Sanitize manual inputs (integers 0..5) ----
    const sKeyword = clampInt(keyword, 0, 5);
    const sContentQuality = clampInt(contentQuality, 0, 5);
    const sImage = clampInt(image, 0, 5);
    const sSeo = clampInt(seo, 0, 5);
    const sGrammar = clampInt(grammar, 0, 5);
    const sHumanization = clampInt(humanization, 0, 5);

    // ---- Compute scores ----
    const timerScore = timerScoreFromRating(performanceRating);
    const manualSum =
      sKeyword + sContentQuality + sImage + sSeo + sGrammar + sHumanization; // 0..30
    const total = Math.max(0, Math.min(100, timerScore + manualSum)); // 0..100

    // ---- Ensure task exists & grab assignee for notification ----
    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        assignedToId: true,
        assignmentId: true,
        templateSiteAssetId: true,
        assignedTo: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ---- Persist QC review into Task ----
    const qcPayload = {
      timerScore, // 40..70
      keyword: sKeyword, // 0..5
      contentQuality: sContentQuality,
      image: sImage,
      seo: sSeo,
      grammar: sGrammar,
      humanization: sHumanization,
      total, // 0..100
      reviewerId: reviewerId ?? null,
      reviewedAt: new Date().toISOString(),
      notes: typeof notes === "string" ? notes : null,
    };

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "qc_approved",
        performanceRating,
        qcReview: qcPayload, // JSON blob with all QC details
        qcTotalScore: total, // cached total for fast list/sort
        updatedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            category: true,
          },
        },
        client: { select: { id: true, name: true, company: true } },
        category: { select: { id: true, name: true } },
        assignment: {
          include: {
            template: {
              include: {
                package: { select: { name: true } },
              },
            },
          },
        },
        templateSiteAsset: { select: { name: true, type: true } },
      },
    });

    // ---- Notify assigned agent (optional but useful) ----
    if (existing.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: existing.assignedToId,
          taskId: existing.id,
          type: "performance",
          message: `${updatedTask.assignedTo?.name ?? "Your"} task "${
            existing.name
          }" has been QC approved. Rating: ${performanceRating}. Score: ${total}%.`,
          createdAt: new Date(),
        },
      });
    }

    // ---- 🚀 Auto-trigger posting task generation for QC tasks ----
    let postingResult: any = null;
    let postingTriggered = false;

    // Check if this is a task that should trigger posting
    // Includes: QC tasks, Asset Creation tasks, etc.
    const categoryName = existing.category?.name?.toLowerCase() || "";
    
    const shouldTriggerPosting =
      categoryName.includes("qc") ||
      categoryName.includes("quality") ||
      categoryName.includes("asset creation") ||
      categoryName.includes("social asset") ||
      categoryName.includes("web2") ||
      categoryName.includes("content writing") ||
      categoryName.includes("graphics");

    console.log("🔍 Posting Trigger Check:", {
      taskId: id,
      categoryName: existing.category?.name,
      shouldTriggerPosting,
      hasTemplateAsset: !!existing.templateSiteAssetId,
      hasAssignment: !!existing.assignmentId,
    });

    if (shouldTriggerPosting && existing.templateSiteAssetId && existing.assignmentId) {
      try {
        console.log(`🚀 Attempting to trigger posting for QC task ${id}...`);
        
        // Trigger posting task generation
        const response = await fetch(
          `${request.nextUrl.origin}/api/tasks/${id}/trigger-posting`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": reviewerId || "",
              "x-actor-id": reviewerId || "",
            },
            body: JSON.stringify({
              actorId: reviewerId,
              forceOverride: false,
            }),
          }
        );

        if (response.ok) {
          postingResult = await response.json();
          postingTriggered = true;
          console.log(
            `✅ Auto-triggered posting for QC task ${id}:`,
            postingResult.postingTasks?.length || 0,
            "tasks created"
          );
        } else {
          const errorData = await response.json();
          console.warn(
            `⚠️ Failed to auto-trigger posting for task ${id}:`,
            errorData.message || errorData.error
          );
        }
      } catch (error) {
        console.error("❌ Error auto-triggering posting:", error);
        // Don't fail the whole request if posting fails
      }
    } else if (shouldTriggerPosting) {
      console.warn(`⚠️ Task ${id} missing required data for posting:`, {
        hasTemplateAsset: !!existing.templateSiteAssetId,
        hasAssignment: !!existing.assignmentId,
      });
    }

    return NextResponse.json({
      ...updatedTask,
      autoTrigger: {
        shouldTriggerPosting,
        postingTriggered,
        postingResult: postingTriggered ? postingResult : null,
      },
    });
  } catch (error) {
    console.error("Error approving task:", error);
    return NextResponse.json(
      { error: "Failed to approve task" },
      { status: 500 }
    );
  }
}
