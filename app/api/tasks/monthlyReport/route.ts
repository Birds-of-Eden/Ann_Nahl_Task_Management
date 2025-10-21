// app/api/tasks/full/route.ts

import { NextResponse } from "next/server";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import prisma from "@/lib/prisma";

/**
 * GET /api/tasks/full
 *
 * Query params (সবগুলো অপশনাল):
 * - date=YYYY-MM-DD                 → শুধু ওই দিনের টাস্ক
 * - startDate=ISO&endDate=ISO       → রেঞ্জ (এটা থাকলে date ইগনোর হবে)
 * - allDates=true                   → কোন ডেট ফিল্টারই হবে না (সব)
 * - clientId=...                    → clientId দিয়ে ফিল্টার
 * - packageId=...                   → client.packageId দিয়ে ফিল্টার
 * - status=pending|in_progress|...  → স্ট্যাটাস ফিল্টার
 * - assignedToId=...                → যাকে অ্যাসাইন করা, তার আইডি
 * - search=...                      → title/assignedTo.name/client.package.name এ কেস-ইনসেনসিটিভ সার্চ
 * - orderBy=dueDate|createdAt|updatedAt (default: dueDate)
 * - order=asc|desc (default: asc)
 * - take=number (default: 1000, max: 5000)
 * - skip=number (default: 0)
 *
 * সবসময় রিলেশন সহ রিটার্ন করে:
 * - client: id, packageId, package { id, name }
 * - category: id, name
 * - assignedTo: id, name, email
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // ---------- Basic params ----------
    const dateParam       = searchParams.get("date");        // YYYY-MM-DD
    const startDateParam  = searchParams.get("startDate");
    const endDateParam    = searchParams.get("endDate");
    const allDates        = (searchParams.get("allDates") ?? "").toLowerCase() === "true";

    const clientId        = searchParams.get("clientId");
    const packageId       = searchParams.get("packageId");
    const status          = searchParams.get("status");
    const assignedToId    = searchParams.get("assignedToId");
    const search          = searchParams.get("search")?.trim();

    const orderByField    = (searchParams.get("orderBy") as "dueDate" | "createdAt" | "updatedAt") || "dueDate";
    const order           = (searchParams.get("order") as "asc" | "desc") || "asc";

    const takeParam       = Number(searchParams.get("take") ?? 1000);
    const skip            = Number(searchParams.get("skip") ?? 0);
    const take            = Math.min(Math.max(takeParam, 1), 5000); // 1..5000

    // ---------- Build where ----------
    const where: any = {};

    // Date filtering (priority: range > single-day > none/all)
    if (!allDates) {
      if (startDateParam && endDateParam) {
        const start = startOfDay(parseISO(startDateParam));
        const end   = endOfDay(parseISO(endDateParam));
        where.dueDate = { gte: start, lte: end };
      } else if (dateParam) {
        const base  = parseISO(dateParam);
        const start = startOfDay(base);
        const end   = endOfDay(base);
        where.dueDate = { gte: start, lte: end };
      }
      // allDates=true হলে কোন dueDate শর্তই লাগবে না
    }

    if (clientId)     where.clientId = clientId;
    if (packageId)    where.client = { packageId };
    if (status)       where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    // ---------- Text search ----------
    // টাইটেল, অ্যাসাইনি নাম, প্যাকেজ নেম—এই তিন জায়গায় আই-লাইকের সার্চ
    if (search && search.length > 0) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { assignedTo: { name: { contains: search, mode: "insensitive" } } },
        { client: { package: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    // ---------- Query ----------
    const tasks = await prisma.task.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            packageId: true,
            package: { select: { id: true, name: true } }, // ← package.name নিশ্চিত
            // name: true, // চাইলে রাখবেন না; আপনি client.name দেখাতে চান না
          },
        },
        category:  { select: { id: true, name: true } },
        assignedTo:{ select: { id: true, name: true, email: true } },
      },
      orderBy: { [orderByField]: order },
      skip,
      take,
    });

    // ---------- Meta (optional helpful info) ----------
    const totalCount = await prisma.task.count({ where });

    return NextResponse.json({
      meta: {
        total: totalCount,
        count: tasks.length,
        skip,
        take,
        orderBy: orderByField,
        order,
        filters: {
          date: dateParam,
          startDate: startDateParam,
          endDate: endDateParam,
          allDates,
          clientId,
          packageId,
          status,
          assignedToId,
          search,
        },
      },
      data: tasks,
    });
  } catch (error) {
    console.error("Error fetching full tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch full tasks" },
      { status: 500 }
    );
  }
}
