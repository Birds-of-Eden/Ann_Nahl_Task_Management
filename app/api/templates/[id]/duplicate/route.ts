// app/api/templates/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceTemplateId } = await params;

  try {
    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    const duplicated = await prisma.$transaction(async (tx) => {
      // 1) Load source template with relations we want to clone
      const source = await tx.template.findUnique({
        where: { id: sourceTemplateId },
        include: {
          sitesAssets: true,
          templateTeamMembers: true,
          package: { select: { id: true, name: true } },
          _count: {
            select: { sitesAssets: true, templateTeamMembers: true },
          },
        },
      });

      if (!source) {
        throw new Error("NOT_FOUND");
      }

      // 2) Make a unique copy name: "Copy of <name>" (add suffix if needed)
      const baseName = source.name?.trim() || "Untitled Template";
      const copyBase = `Copy of ${baseName}`;
      let copyName = copyBase;

      // ensure uniqueness within same package
      let i = 2;
      while (
        await tx.template.findFirst({
          where: { name: copyName, packageId: source.packageId || undefined },
          select: { id: true },
        })
      ) {
        copyName = `${copyBase} (${i++})`;
      }

      // 3) Create the new template (status -> draft by default)
      const newTemplate = await tx.template.create({
        data: {
          name: copyName,
          description: source.description || null,
          packageId: source.packageId || null,
          status: "draft",
        },
      });

      // 4) Clone Sites/Assets
      if (source.sitesAssets.length > 0) {
        await tx.templateSiteAsset.createMany({
          data: source.sitesAssets.map((s) => ({
            // id is autoincrement; don't copy
            templateId: newTemplate.id,
            type: s.type,
            name: s.name,
            url: s.url || null,
            description: s.description || null,
            isRequired: s.isRequired,
            defaultPostingFrequency: s.defaultPostingFrequency ?? null,
            defaultIdealDurationMinutes: s.defaultIdealDurationMinutes ?? null,
          })),
        });
      }

      // 5) Clone Template Team Members (keep same agent/team relations)
      if (source.templateTeamMembers.length > 0) {
        // Note: composite PK is (templateId, agentId), so safe to reuse agentId
        await tx.templateTeamMember.createMany({
          data: source.templateTeamMembers.map((m) => ({
            templateId: newTemplate.id,
            agentId: m.agentId,
            role: m.role || null,
            teamId: m.teamId || null, // keep same team link; Team isn't deleted by design
            assignedDate: m.assignedDate || null,
          })),
          skipDuplicates: true, // in case of weird duplicates
        });
      }

      // 6) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Template",
          entityId: newTemplate.id,
          userId: actorId,
          action: "duplicate",
          details: {
            fromTemplateId: sourceTemplateId,
            name: newTemplate.name,
            packageId: newTemplate.packageId ?? null,
            clonedCounts: {
              sitesAssets: source._count.sitesAssets,
              templateTeamMembers: source._count.templateTeamMembers,
            },
          },
        },
      });

      return newTemplate;
    });

    return NextResponse.json(
      {
        message: "Template duplicated",
        template: duplicated,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 }
      );
    }
    console.error("Duplicate template error:", error);
    return NextResponse.json(
      { message: "Failed to duplicate template" },
      { status: 500 }
    );
  }
}
