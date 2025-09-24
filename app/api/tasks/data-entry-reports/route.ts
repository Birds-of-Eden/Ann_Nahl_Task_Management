import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    // query parameter theke clientId nibo
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const whereCondition: any = {
      dataEntryReport: {
        not: Prisma.DbNull,
      },
    };

    if (clientId) {
      whereCondition.clientId = clientId; // filter by clientId if provided
    }

    const tasks = await prisma.task.findMany({
      where: whereCondition,
      select: {
        id: true,
        dataEntryReport: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const reports = tasks.map((task) => ({
      taskId: task.id,
      clientId: task.client?.id,
      clientName: task.client?.name,
      ...(task.dataEntryReport as Record<string, any>),
    }));

    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    console.error("Error fetching Data Entry Reports:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch data entry reports" },
      { status: 500 }
    );
  }
}
