// app/api/zisanpackages/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/logActivity";
import { diffChanges, sanitizePackage } from "@/utils/audit";

// ✅ GET Package by ID (no audit)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            clients: true,
            templates: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json(pkg);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

// ✅ PUT - Update Package (with audit log)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const body = await req.json();
    const { name, description } = body;
    const actorId =
      (typeof body.actorId === "string" && body.actorId) ||
      (typeof (req.headers.get("x-actor-id") || "") === "string" &&
        (req.headers.get("x-actor-id") as string)) ||
      null;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.package.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const pkg = await tx.package.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined
            ? { description: description || null }
            : {}),
        },
      });

      // diff only changed fields
      const changes = diffChanges(
        sanitizePackage(existing),
        sanitizePackage(pkg),
        ["updatedAt", "createdAt"]
      );

      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Package",
          entityId: pkg.id,
          userId: actorId,
          action: "update",
          details: { changes },
        },
      });

      return pkg;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    console.error("Update failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ✅ DELETE - Delete Package (with audit log)
// export async function DELETE(
//   req: NextRequest,
//   context: { params: Promise<{ id: string }> }
// ) {
//   const { id } = await context.params;

//   try {
//     const actorId =
//       (typeof (req.nextUrl.searchParams.get("actorId") || "") === "string" &&
//         (req.nextUrl.searchParams.get("actorId") as string)) ||
//       (typeof (req.headers.get("x-actor-id") || "") === "string" &&
//         (req.headers.get("x-actor-id") as string)) ||
//       null;

//     const ok = await prisma.$transaction(async (tx) => {
//       const existing = await tx.package.findUnique({ where: { id } });
//       if (!existing) {
//         throw new Error("NOT_FOUND");
//       }

//       const count = await tx.package.findUnique({
//         where: { id },
//         select: {
//           _count: { select: { clients: true, templates: true } },
//         },
//       });

//       if (count && (count._count.clients > 0 || count._count.templates > 0)) {
//         throw new Error("HAS_RELATIONS");
//       }

//       await tx.package.delete({ where: { id } });

//       await tx.activityLog.create({
//         data: {
//           id: crypto.randomUUID(),
//           entityType: "Package",
//           entityId: existing.id,
//           userId: actorId,
//           action: "delete",
//           details: {
//             name: existing.name,
//             description: existing.description ?? null,
//           },
//         },
//       });

//       return true;
//     });

//     return NextResponse.json({ message: "Package deleted successfully." });
//   } catch (error: any) {
//     if (error?.message === "NOT_FOUND") {
//       return NextResponse.json(
//         { error: "Package not found." },
//         { status: 404 }
//       );
//     }
//     if (error?.message === "HAS_RELATIONS") {
//       return NextResponse.json(
//         { error: "Cannot delete a package with related clients or templates." },
//         { status: 409 }
//       );
//     }
//     console.error("Delete error:", error);
//     return NextResponse.json(
//       { error: "Failed to delete package." },
//       { status: 500 }
//     );
//   }
// }

// export async function DELETE(
//   request: Request,
//   { params }: { params: { id: string } }
// ) {
//   const packageId = params.id;

//   try {
//     const headerActor = request.headers.get("x-actor-id");
//     const actorId =
//       (typeof headerActor === "string" && headerActor) || null;

//     // Ensure package exists
//     const existing = await prisma.package.findUnique({
//       where: { id: packageId },
//       select: { id: true, name: true },
//     });

//     if (!existing) {
//       return NextResponse.json(
//         { error: "Package not found" },
//         { status: 404 }
//       );
//     }

//     // 👇 Agay (before) ekta log — jate bujha jai je ei handler e dhukse
//     console.log(`[Package DELETE] Etai kaj korche !!! Starting cascade delete for packageId=${packageId}, actorId=${actorId}`);

//     await prisma.$transaction(async (tx) => {
//       // ===================== CASCADE DELETE (SQL) =====================
//       // 1. Delete all comments tied to tasks within this package
//       await tx.$executeRaw`
//         DELETE FROM "Comment"
//         WHERE "taskId" IN (
//           SELECT t."id"
//           FROM "Task" t
//           JOIN "Assignment" a ON a."id" = t."assignmentId"
//           JOIN "Template" tp ON tp."id" = a."templateId"
//           WHERE tp."packageId" = ${packageId}
//         );
//       `;

//       // 2. Delete all reports tied to tasks within this package
//       await tx.$executeRaw`
//         DELETE FROM "Report"
//         WHERE "taskId" IN (
//           SELECT t."id"
//           FROM "Task" t
//           JOIN "Assignment" a ON a."id" = t."assignmentId"
//           JOIN "Template" tp ON tp."id" = a."templateId"
//           WHERE tp."packageId" = ${packageId}
//         );
//       `;

//       // 3. Delete all notifications tied to tasks within this package
//       await tx.$executeRaw`
//         DELETE FROM "Notification"
//         WHERE "taskId" IN (
//           SELECT t."id"
//           FROM "Task" t
//           JOIN "Assignment" a ON a."id" = t."assignmentId"
//           JOIN "Template" tp ON tp."id" = a."templateId"
//           WHERE tp."packageId" = ${packageId}
//         );
//       `;

//       // 4. Delete all tasks under assignments of templates in this package
//       await tx.$executeRaw`
//         DELETE FROM "Task"
//         WHERE "assignmentId" IN (
//           SELECT a."id"
//           FROM "Assignment" a
//           JOIN "Template" tp ON tp."id" = a."templateId"
//           WHERE tp."packageId" = ${packageId}
//         );
//       `;

//       // 5. Delete assignment-site-asset settings under this package
//       await tx.$executeRaw`
//         DELETE FROM "AssignmentSiteAssetSetting"
//         WHERE "assignmentId" IN (
//           SELECT a."id"
//           FROM "Assignment" a
//           JOIN "Template" tp ON tp."id" = a."templateId"
//           WHERE tp."packageId" = ${packageId}
//         );
//       `;

//       // 6. Delete assignments under templates in this package
//       await tx.$executeRaw`
//         DELETE FROM "Assignment"
//         WHERE "templateId" IN (
//           SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
//         );
//       `;

//       // 7. Delete template site assets under this package
//       await tx.$executeRaw`
//         DELETE FROM "TemplateSiteAsset"
//         WHERE "templateId" IN (
//           SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
//         );
//       `;

//       // 8. Delete template team members under this package
//       // await tx.$executeRaw`
//       //   DELETE FROM "TemplateTeamMember"
//       //   WHERE "templateId" IN (
//       //     SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
//       //   );
//       // `;

//       // 9. Delete templates under this package
//       await tx.$executeRaw`
//         DELETE FROM "Template"
//         WHERE "packageId" = ${packageId};
//       `;

//       // 10. Finally, delete the package itself
//       await tx.$executeRaw`
//         DELETE FROM "Package"
//         WHERE "id" = ${packageId};
//       `;

//       // ===================== Activity Log =====================
//       await tx.activityLog.create({
//         data: {
//           id: crypto.randomUUID(),
//           entityType: "Package",
//           entityId: existing.id,
//           userId: actorId,
//           action: "delete",
//           details: {
//             name: existing.name ?? null,
//             packageId: existing.id,
//             cascade: true,
//           },
//         },
//       });
//     });

//     return NextResponse.json({ success: true });
//   } catch (error: any) {
//     console.error("Package delete failed:", error);
//     return NextResponse.json(
//       { error: "Failed to delete package. It may have related data or constraints." },
//       { status: 500 }
//     );
//   }
// }

/// ============================ DELETE Package ============================

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const packageId = params.id;

  try {
    const headerActor = request.headers.get("x-actor-id");
    const actorId = (typeof headerActor === "string" && headerActor) || null;

    const existing = await prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    console.log(
      `[Package DELETE] Starting cascade delete for packageId=${packageId}, actorId=${actorId}`
    );

    await prisma.$transaction(async (tx) => {
      // 1) Delete all comments related to tasks of this package
      await tx.$executeRaw`
        DELETE FROM "Comment"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 2) Delete all reports for tasks of this package
      await tx.$executeRaw`
        DELETE FROM "Report"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 3) Delete notifications tied to tasks of this package
      await tx.$executeRaw`
        DELETE FROM "Notification"
        WHERE "taskId" IN (
          SELECT t."id"
          FROM "Task" t
          JOIN "Assignment" a ON a."id" = t."assignmentId"
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 4) NULL assigned agents (preserve agents globally)
      await tx.$executeRaw`
        UPDATE "Task"
        SET "assignedToId" = NULL
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 5) Delete tasks
      await tx.$executeRaw`
        DELETE FROM "Task"
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 6) Delete assignment site asset settings
      await tx.$executeRaw`
        DELETE FROM "AssignmentSiteAssetSetting"
        WHERE "assignmentId" IN (
          SELECT a."id"
          FROM "Assignment" a
          JOIN "Template" tp ON tp."id" = a."templateId"
          WHERE tp."packageId" = ${packageId}
        );
      `;

      // 7) Delete assignments (client remains intact)
      await tx.$executeRaw`
        DELETE FROM "Assignment"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 8) Remove template-team memberships for this package
      await tx.$executeRaw`
        DELETE FROM "TemplateTeamMember"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 9) Delete template site assets
      await tx.$executeRaw`
        DELETE FROM "TemplateSiteAsset"
        WHERE "templateId" IN (
          SELECT "id" FROM "Template" WHERE "packageId" = ${packageId}
        );
      `;

      // 10) Delete templates
      await tx.$executeRaw`
        DELETE FROM "Template"
        WHERE "packageId" = ${packageId};
      `;

      // 11) Finally delete the package itself
      await tx.$executeRaw`
        DELETE FROM "Package"
        WHERE "id" = ${packageId};
      `;

      // Activity Log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Package",
          entityId: existing.id,
          userId: actorId,
          action: "delete",
          details: {
            name: existing.name ?? null,
            packageId: existing.id,
            cascade: true,
            stepsApplied: [1,2,3,4,5,6,7,8,9,10,11],
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Package delete failed:", error);
    return NextResponse.json(
      {
        error:
          "Failed to delete package. It may have related data or constraints.",
      },
      { status: 500 }
    );
  }
}




