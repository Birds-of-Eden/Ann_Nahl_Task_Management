import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type Status = "active" | "expired" | "upcoming" | "pending" | "unknown";

// Business rules:
// - expired:   dueDate exists AND dueDate < now
// - pending:   startDate missing OR dueDate missing (and not expired)
// - upcoming:  startDate exists AND startDate > now (and not expired)
// - active:    BOTH dates exist AND startDate <= now AND dueDate >= now
function getStatus(
  startDate: Date | null | undefined,
  dueDate: Date | null | undefined,
  now: Date
): Status {
  if (dueDate && dueDate < now) return "expired";
  if (!startDate || !dueDate) return "pending";
  if (startDate > now) return "upcoming";
  if (startDate <= now && dueDate >= now) return "active";
  return "unknown";
}

// GET /api/am/sales/overview
export async function GET() {
  const now = new Date();
  const in14 = new Date(now);
  in14.setDate(in14.getDate() + 14);
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

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

  const enriched = clients.map((c) => ({
    ...c,
    status: getStatus(c.startDate, c.dueDate, now),
  }));

  const totalWithPackage = enriched.length;

  let active = 0;
  let expired = 0;
  let startingSoon = 0;
  let expiringSoon = 0;
  let missingDates = 0;

  for (const c of enriched) {
    const hasStart = !!c.startDate;
    const hasDue = !!c.dueDate;

    if (!hasStart || !hasDue) missingDates++;

    if (hasStart && c.startDate! > now && c.startDate! <= in14) startingSoon++;
    if (hasDue && c.dueDate! >= now && c.dueDate! <= in30) expiringSoon++;

    if (c.status === "active") active++;
    else if (c.status === "expired") expired++;
  }

  const summary = {
    totalWithPackage: totalWithPackage || 0,
    totalSales: totalWithPackage || 0,
    active,
    expired,
    startingSoon,
    expiringSoon,
    missingDates,
  };

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
    const entry = byPackageMap.get(key) ?? {
      packageId: key,
      packageName: c.package?.name ?? null,
      totalMonths: c.package?.totalMonths ?? null,
      clients: 0,
      active: 0,
      expired: 0,
      daysLeftAcc: 0,
      daysLeftCount: 0,
    };

    entry.clients++;
    if (c.status === "active") entry.active++;
    if (c.status === "expired") entry.expired++;

    if (c.dueDate) {
      const daysLeft = Math.floor(
        (c.dueDate.getTime() - now.getTime()) / 86400000
      );
      if (daysLeft >= 0) {
        entry.daysLeftAcc += daysLeft;
        entry.daysLeftCount++;
      }
    }

    byPackageMap.set(key, entry);
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

  const totalSales = byPackage.reduce((s, r) => s + r.clients, 0);
  const packageSales = byPackage.map((p) => ({
    packageId: p.packageId,
    packageName: p.packageName || "Unknown Package",
    sales: p.clients || 0,
    sharePercent:
      totalSales && p.clients
        ? Math.round((p.clients * 10000) / totalSales) / 100
        : 0,
  }));

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
        status: c.status as Status,
      })),
  }));

  const safeTimeseries = (timeseries || []).map((item) => ({
    ...item,
    starts: item.starts || 0,
  }));

  return NextResponse.json({
    summary,
    timeseries: safeTimeseries,
    byPackage,
    packageSales,
    totalSales: totalSales || 0,
    recent: enriched.slice(0, 20),
    groupedClients: groupedClients || [],
  });
}
