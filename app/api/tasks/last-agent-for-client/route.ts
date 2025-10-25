import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the last agent (assignedTo) who completed a task in Blog Posting or Social Activity for a client
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const category = searchParams.get("category");
    if (!clientId) {
      return NextResponse.json({ message: "clientId is required" }, { status: 400 });
    }

    console.log("[last-agent-for-client] params", { clientId, category });

    const preferredStatuses = ["completed", "qc_approved", "data_entered"] as const;

    // Build category aliases to improve matching
    function buildAliases(input?: string | null): string[] {
      if (!input) return [];
      const base = input.trim();
      const snake = base.toLowerCase().replace(/\s+/g, "_");
      const aliases = new Set<string>([base, snake]);
      // Known human-readable variants
      const map: Record<string, string[]> = {
        "social activity": ["Social Activity", "social_site", "Social", "Social Posting"],
        "blog posting": ["Blog Posting", "web2_site", "Blog"],
        "content studio": ["Content Studio", "content_studio"],
        "content writing": ["Content Writing", "content_writing"],
        "backlinks": ["Backlinks", "backlinks"],
        "image optimization": ["Image Optimization", "image_optimization"],
        "summary report": ["Summary Report", "summary_report"],
        "monitoring": ["Monitoring", "monitoring"],
        "review removal": ["Review Removal", "review_removal"],
        "completed com": ["Completed COM", "completed_com"],
        "youtube video optimization": ["YouTube Video Optimization", "youtube_video_optimization"],
        "guest posting": ["Guest Posting", "guest_posting"],
        "graphics design": ["Graphics Design", "graphics_design"],
        "social communication": ["Social Communication", "Social Activity", "social_site"],
      };
      const key = base.toLowerCase();
      for (const v of map[key] || []) aliases.add(v);
      return Array.from(aliases);
    }

    // 1) Try by category (if provided) with preferred statuses
    const aliases = buildAliases(category);
    let last = category
      ? await prisma.task.findFirst({
          where: {
            clientId,
            assignedToId: { not: null },
            status: { in: preferredStatuses as any },
            OR: aliases.length
              ? aliases.map((a) => ({
                  category: { is: { name: { equals: a, mode: "insensitive" } } },
                }))
              : [{ category: { is: { name: { equals: category!, mode: "insensitive" } } } }],
          },
          orderBy: [
            { completedAt: "desc" },
            { updatedAt: "desc" },
          ],
          select: {
            assignedTo: { select: { id: true, name: true, email: true } },
            category: { select: { id: true, name: true } },
            id: true,
            name: true,
            completedAt: true,
            status: true,
          },
        })
      : null;

    let matchedStrategy: string = last ? "category+preferredStatuses" : "";

    // 2) If not found, try without category with preferred statuses
    if (!last) {
      last = await prisma.task.findFirst({
        where: {
          clientId,
          assignedToId: { not: null },
          status: { in: preferredStatuses as any },
        },
        orderBy: [
          { completedAt: "desc" },
          { updatedAt: "desc" },
        ],
        select: {
          assignedTo: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          id: true,
          name: true,
          completedAt: true,
          status: true,
        },
      });
      matchedStrategy = last ? "anyCategory+preferredStatuses" : matchedStrategy;
    }

    // 3) Final fallback: any assigned task for the client, most recently updated
    if (!last) {
      last = await prisma.task.findFirst({
        where: {
          clientId,
          assignedToId: { not: null },
        },
        orderBy: [
          { updatedAt: "desc" },
        ],
        select: {
          assignedTo: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          id: true,
          name: true,
          completedAt: true,
          status: true,
        },
      });
      matchedStrategy = last ? "anyCategory+anyStatus(updatedAt)" : matchedStrategy;
    }

    // 4) Fallback to top client team member by completedTasks
    let teamAgent: { id: string; name: string | null; email: string | null } | null = null;
    if (!last) {
      const ctm = await prisma.clientTeamMember.findFirst({
        where: { clientId },
        orderBy: [
          { completedTasks: "desc" },
          { assignedDate: "desc" },
        ],
        select: {
          agent: { select: { id: true, name: true, email: true } },
        },
      });
      teamAgent = ctm?.agent ?? null;
      if (teamAgent) {
        matchedStrategy = "clientTeamMember(topCompletedTasks)";
      }
    }

    // 5) Fallback to client's account manager
    let amAgent: { id: string; name: string | null; email: string | null } | null = null;
    if (!last && !teamAgent) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { accountManager: { select: { id: true, name: true, email: true } } },
      });
      amAgent = client?.accountManager ?? null;
      if (amAgent) {
        matchedStrategy = "accountManager(amId)";
      }
    }

    console.log("[last-agent-for-client] result", {
      taskId: last?.id,
      completedAt: last?.completedAt,
      category: last?.category?.name,
      agentId: last?.assignedTo?.id,
      status: (last as any)?.status,
      matchedStrategy,
    });

    if (last?.assignedTo) {
      return NextResponse.json({ agent: last.assignedTo }, { status: 200 });
    }
    if (teamAgent) {
      return NextResponse.json({ agent: teamAgent }, { status: 200 });
    }
    if (amAgent) {
      return NextResponse.json({ agent: amAgent }, { status: 200 });
    }

    return NextResponse.json({ agent: null }, { status: 200 });
  } catch (err: any) {
    console.error("[last-agent-for-client] ERROR", err);
    return NextResponse.json({ message: err?.message || "Internal Error" }, { status: 500 });
  }
}
