// app/api/templates/[id]/clone-for-client/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Clone a template specifically for a client, creating a custom version
 * POST /api/templates/{templateId}/clone-for-client
 * Body: { clientId, customName? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceTemplateId } = await params;

  try {
    const body = await request.json();
    const { clientId, customName } = body as {
      clientId: string;
      customName?: string;
    };

    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Load source template with all relations
      const source = await tx.template.findUnique({
        where: { id: sourceTemplateId },
        include: {
          sitesAssets: true,
          templateTeamMembers: true,
          package: { select: { id: true, name: true } },
        },
      });

      if (!source) {
        throw new Error("TEMPLATE_NOT_FOUND");
      }

      // 2) Load client info
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, packageId: true },
      });

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      // 3) Generate unique custom template name
      const baseName =
        customName || `${source.name || "Template"} (Custom for ${client.name})`;
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

      // 4) Create the custom template
      const customTemplate = await tx.template.create({
        data: {
          name: uniqueName,
          description: `Custom template for client: ${client.name}. Cloned from: ${source.name}`,
          packageId: source.packageId || client.packageId || null,
          status: "active",
        },
      });

      // 5) Clone all SiteAssets
      if (source.sitesAssets.length > 0) {
        await tx.templateSiteAsset.createMany({
          data: source.sitesAssets.map((asset) => ({
            templateId: customTemplate.id,
            type: asset.type,
            name: asset.name,
            url: asset.url || null,
            description: asset.description || null,
            isRequired: asset.isRequired,
            defaultPostingFrequency: asset.defaultPostingFrequency ?? null,
            defaultIdealDurationMinutes: asset.defaultIdealDurationMinutes ?? null,
          })),
        });
      }

      // 6) Clone Template Team Members
      if (source.templateTeamMembers.length > 0) {
        await tx.templateTeamMember.createMany({
          data: source.templateTeamMembers.map((member) => ({
            templateId: customTemplate.id,
            agentId: member.agentId,
            role: member.role || null,
            teamId: member.teamId || null,
            assignedDate: member.assignedDate || null,
          })),
          skipDuplicates: true,
        });
      }

      // 7) Activity log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Template",
          entityId: customTemplate.id,
          userId: actorId,
          action: "clone_for_client",
          details: {
            sourceTemplateId,
            sourceTemplateName: source.name,
            clientId: client.id,
            clientName: client.name,
            clonedAssets: source.sitesAssets.length,
            clonedTeamMembers: source.templateTeamMembers.length,
          },
        },
      });

      // Return the new template with all relations
      return await tx.template.findUnique({
        where: { id: customTemplate.id },
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
          package: true,
        },
      });
    });

    return NextResponse.json(
      {
        message: "Template cloned successfully for client",
        template: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === "TEMPLATE_NOT_FOUND") {
      return NextResponse.json(
        { message: "Source template not found" },
        { status: 404 }
      );
    }
    if (error?.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }
    console.error("Clone template for client error:", error);
    return NextResponse.json(
      {
        message: "Failed to clone template for client",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
