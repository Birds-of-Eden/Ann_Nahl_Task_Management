// app/api/am/sales/overview/route.ts

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/am/sales/overview
export async function GET() {
  const now = new Date();
  const in14 = new Date(now);
  in14.setDate(in14.getDate() + 14);
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  // --- Pull all clients that have a package (with package info)
  const clients = await prisma.client.findMany({
    where: { packageId: { not: null } },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      startDate: true,
      dueDate: true,
      updatedAt: true,
      createdAt: true,
      packageId: true,
      package: { select: { id: true, name: true, totalMonths: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  // --- Derive status + build base arrays
  type Status = "active" | "expired" | "upcoming" | "unknown";
  const enriched = clients.map((c) => {
    let status: Status = "unknown";
    if (c.startDate && c.dueDate) {
      if (c.startDate <= now && c.dueDate >= now) status = "active";
      else if (c.dueDate < now) status = "expired";
      else if (c.startDate > now) status = "upcoming";
    }
    return { ...c, status };
  });

  // --- Summary KPIs
  let totalWithPackage = enriched.length;
  let active = 0,
    expired = 0,
    startingSoon = 0,
    expiringSoon = 0,
    missingDates = 0;
  for (const c of enriched) {
    if (!c.startDate || !c.dueDate) {
      missingDates++;
      continue;
    }
    if (c.startDate > now && c.startDate <= in14) startingSoon++;
    if (c.dueDate >= now && c.dueDate <= in30) expiringSoon++;
    if (c.startDate <= now && c.dueDate >= now) active++;
    else if (c.dueDate < now) expired++;
  }

  const summary = {
    totalWithPackage,
    active,
    expired,
    startingSoon,
    expiringSoon,
    missingDates,
  };

  // --- Group by package (counts, active/expired, avg days left)
  const byPackageMap = new Map<
    string,
    {
      packageId: string;
      packageName: string | null;
      totalMonths: number | null;
      clients: number;
      active: number;
      expired: number;
      daysLeftAcc: number;
      daysLeftCount: number;
    }
  >();

  for (const c of enriched) {
    const key = c.packageId as string;
    const e = byPackageMap.get(key) ?? {
      packageId: key,
      packageName: c.package?.name ?? null,
      totalMonths: c.package?.totalMonths ?? null,
      clients: 0,
      active: 0,
      expired: 0,
      daysLeftAcc: 0,
      daysLeftCount: 0,
    };
    e.clients++;
    if (c.startDate && c.dueDate) {
      if (c.startDate <= now && c.dueDate >= now) e.active++;
      else if (c.dueDate < now) e.expired++;
      const daysLeft = Math.floor(
        (c.dueDate.getTime() - now.getTime()) / 86400000
      );
      e.daysLeftAcc += daysLeft;
      e.daysLeftCount++;
    }
    byPackageMap.set(key, e);
  }

  const byPackage = Array.from(byPackageMap.values())
    .map((e) => ({
      packageId: e.packageId,
      packageName: e.packageName,
      totalMonths: e.totalMonths,
      clients: e.clients,
      active: e.active,
      expired: e.expired,
      avgDaysLeft: e.daysLeftCount
        ? Math.round(e.daysLeftAcc / e.daysLeftCount)
        : null,
    }))
    .sort((a, b) => b.clients - a.clients);

  // --- Timeseries: new package starts per day (last 90 days)
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const timeseries = await prisma.$queryRawUnsafe<
    { day: string; starts: number }[]
  >(
    `
      SELECT
        to_char(date_trunc('day', "startDate"), 'YYYY-MM-DD') as day,
        COUNT(*)::int as starts
      FROM "Client"
      WHERE "packageId" IS NOT NULL
        AND "startDate" IS NOT NULL
        AND "startDate" >= $1
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    since
  );

  // --- Recent: latest 20 package clients w/ status
  const recent = enriched.slice(0, 20);

  // --- Grouped clients by package for table filtering (package-wise lists)
  const groupedClients = byPackage.map((pkg) => ({
    packageId: pkg.packageId,
    packageName: pkg.packageName,
    totalMonths: pkg.totalMonths,
    count: pkg.clients,
    clients: enriched
      .filter((c) => c.packageId === pkg.packageId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        startDate: c.startDate,
        dueDate: c.dueDate,
        status: c.status,
      })),
  }));

  return NextResponse.json({
    summary,
    timeseries,
    byPackage,
    recent,
    groupedClients,
  });
}
