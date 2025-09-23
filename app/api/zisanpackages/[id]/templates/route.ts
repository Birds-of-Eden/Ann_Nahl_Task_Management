/// app/api/zisanpackages/[id]/templates/route.ts

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templates = await prisma.template.findMany({
      where: {
        packageId: id,
      },
      include: {
        package: true, // ✅ এটি নতুনভাবে যোগ করুন
        templateTeamMembers: {
          include: {
            agent: true,
          },
        },
        sitesAssets: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch templates for this package" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { packageId: string } }
) {
  try {
    // Normalize the package id (handles URLs like /id-abc123)
    const packageId = params.packageId.replace(/^id-/, "");

    const { templateId } = await req.json().catch(() => ({} as any));
    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "templateId is required in request body" },
        { status: 400 }
      );
    }

    // Verify the template really belongs to this package
    const owned = await prisma.template.findFirst({
      where: { id: templateId, packageId },
      select: { id: true, name: true },
    });
    if (!owned) {
      return NextResponse.json(
        { error: "Template does not belong to this package" },
        { status: 403 }
      );
    }

    // Cascade delete – database will remove everything linked to this template
    await prisma.template.delete({ where: { id: templateId } });

    return NextResponse.json({
      success: true,
      deletedTemplateId: templateId,
      message: `Template "${owned.name ?? owned.id}" deleted successfully.`,
    });
  } catch (err) {
    console.error("Template delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
