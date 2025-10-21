// app/api/tasks/[id]/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ========== READ SINGLE TASK ==========
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { client: true, category: true, assignedTo: true },
    });

    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// ========== UPDATE TASK ==========
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json();
    const { id } = await params;

    // Get the existing task to preserve current dueDate if not provided
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: { dueDate: true }
    });

    // Build reviewRemoval payload if provided
    const reviewRemovalPayload = (() => {
      if (body?.reviewRemoval && typeof body.reviewRemoval === "object") {
        return body.reviewRemoval;
      }
      if (Array.isArray(body?.reviewRemovalLinks)) {
        const obj: Record<string, string> = {};
        body.reviewRemovalLinks
          .filter((l: any) => typeof l === "string" && l.trim())
          .forEach((link: string, idx: number) => {
            obj[`ReviewLink${idx + 1}`] = link.trim();
          });
        return Object.keys(obj).length ? obj : undefined;
      }
      return undefined;
    })();

    // Build summaryReport payload if provided
    const summaryReportPayload = (() => {
      if (body?.summaryReport && typeof body.summaryReport === "object") {
        return body.summaryReport;
      }
      return undefined;
    })();

    // Build backLinking payload if provided
    const backLinkingPayload = (() => {
      if (body?.backLinking && typeof body.backLinking === "object") {
        return body.backLinking;
      }
      const linksArray: string[] | undefined = Array.isArray(body?.backlinkingLinks)
        ? body.backlinkingLinks.filter((l: any) => typeof l === "string" && l.trim()).map((l: string) => l.trim())
        : undefined;
      if (linksArray && linksArray.length) {
        const linkMap: Record<string, string> = {};
        linksArray.forEach((link, idx) => {
          linkMap[`Backlink${idx + 1}`] = link;
        });
        const payload: any = { links: linkMap };
        if (typeof body?.orderDate === "string") payload.orderDate = body.orderDate;
        if (typeof body?.month === "string") payload.month = body.month;
        if (typeof body?.quantity === "number") payload.quantity = body.quantity;
        if (typeof body?.dripPeriod === "string") payload.dripPeriod = body.dripPeriod;
        return payload;
      }
      return undefined;
    })();

    // 1️⃣ টাস্ক আপডেট করুন
    const task = await prisma.task.update({
      where: { id },
      data: {
        name: body.name,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : existingTask?.dueDate,
        categoryId: body.categoryId,
        clientId: body.clientId,
        assignedToId: body.assignedToId,
        completionLink: body.completionLink,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        taskCompletionJson: body.taskCompletionJson ?? undefined,
      },
      include: { assignedTo: true },
    });

    // 2️⃣ Admin + QC role এর সব ইউজার বের করুন
    const notifyUsers = await prisma.user.findMany({
      where: { role: { name: { in: ["admin", "qc"] } } }, // ✅ দুইটা role একসাথে
      select: { id: true },
    });

    // 3️⃣ Notification message বানান
    const message =
      body.status === "completed"
        ? `${task.assignedTo?.name || "An agent"} completed task "${
            task.name
          }".`
        : `${task.assignedTo?.name || "An agent"} updated task "${
            task.name
          }" → ${body.status}.`;

    const type = body.status === "completed" ? "performance" : "general";

    // 4️⃣ একসাথে সব notifyUsers-কে notification পাঠান
    await Promise.all(
      notifyUsers.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            taskId: task.id,
            type,
            message,
            createdAt: new Date(),
          },
        })
      )
    );

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// ========== DELETE TASK ==========
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
