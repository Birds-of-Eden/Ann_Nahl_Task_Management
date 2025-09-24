/// app/api/zisanpackages/[id]/templates/route.ts

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// export async function GET(
//   _: Request,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const { id: packageId } = await params;

//     // 1) Load templates with _count
//     const templates = await prisma.template.findMany({
//       where: { packageId },
//       include: {
//         package: true,
//         templateTeamMembers: { include: { agent: true } },
//         sitesAssets: true,
//         _count: {
//           select: {
//             sitesAssets: true,
//             templateTeamMembers: true,
//             assignments: true, // <-- for "Assignments" count
//           },
//         },
//       },
//       orderBy: { name: "asc" },
//     });

//     // 2) for each template, find DISTINCT clients assigned via assignments
//     const enriched = await Promise.all(
//       templates.map(async (t) => {
//         // DISTINCT client ids for this template
//         const groups = await prisma.assignment.groupBy({
//           by: ["clientId"],
//           where: { templateId: t.id, clientId: { not: null } },
//         });

//         const clientIds = groups
//           .map((g) => g.clientId)
//           .filter((cid): cid is string => Boolean(cid));

//         // fetch minimal client info to show on card
//         const clients =
//           clientIds.length > 0
//             ? await prisma.client.findMany({
//                 where: { id: { in: clientIds } },
//                 select: {
//                   id: true,
//                   name: true,
//                   company: true,
//                   avatar: true,
//                   status: true,
//                 },
//               })
//             : [];

//         return {
//           ...t,
//           assignedClients: clients,
//           assignedClientsCount: clients.length,
//         };
//       })
//     );

//     return NextResponse.json(enriched);
//   } catch (error) {
//     return NextResponse.json(
//       { error: "Failed to fetch templates for this package" },
//       { status: 500 }
//     );
//   }
// }

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: packageId } = await params;

    // 1) Load templates with _count
    const templates = await prisma.template.findMany({
      where: { packageId },
      include: {
        package: true,
        templateTeamMembers: { include: { agent: true } },
        sitesAssets: true,
        _count: {
          select: {
            sitesAssets: true,
            templateTeamMembers: true,
            assignments: true, // <-- for "Assignments" count
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // 2) for each template, find DISTINCT clients assigned via assignments
    const enriched = await Promise.all(
      templates.map(async (t) => {
        // DISTINCT client ids for this template
        const groups = await prisma.assignment.groupBy({
          by: ["clientId"],
          where: { templateId: t.id, clientId: { not: null } },
        });

        const clientIds = groups
          .map((g) => g.clientId)
          .filter((cid): cid is string => Boolean(cid));

        // fetch minimal client info to show on card
        const clients =
          clientIds.length > 0
            ? await prisma.client.findMany({
                where: { id: { in: clientIds } },
                select: {
                  id: true,
                  name: true,
                  company: true,
                  avatar: true,
                  status: true,
                },
              })
            : [];

        // NEW: tasksCount (ONLY tasks under assignments of this template)
        const tasksCount = await prisma.task.count({
          where: { assignment: { templateId: t.id } },
        });

        return {
          ...t,
          assignedClients: clients,
          assignedClientsCount: clients.length,
          tasksCount, // 👈 add this
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch templates for this package:", error);
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
