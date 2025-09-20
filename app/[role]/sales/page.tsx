// app/[role]/sales/page.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Overview = {
  summary: {
    totalWithPackage: number;
    totalSales: number;
    active: number;
    expired: number;
    startingSoon: number;
    expiringSoon: number;
    missingDates: number;
  };
  timeseries: { day: string; starts: number }[];
  byPackage: {
    packageId: string;
    packageName: string | null;
    totalMonths: number | null;
    clients: number;
    active: number;
    expired: number;
    avgDaysLeft: number | null;
  }[];
  packageSales: {
    packageId: string;
    packageName: string | null;
    sales: number;
    sharePercent: number;
  }[];
  totalSales: number;
  groupedClients: {
    packageId: string;
    packageName: string | null;
    totalMonths: number | null;
    count: number;
    clients: {
      id: string;
      name: string | null;
      company: string | null;
      email: string | null;
      startDate: string | null;
      dueDate: string | null;
      status: "active" | "expired" | "upcoming" | "unknown";
    }[];
  }[];
};

/* ================= Helpers ================= */
const formatInt = (n: number | undefined | null) => (n ?? 0).toLocaleString();
const formatPct = (n: number | undefined | null, dp = 1) =>
  `${(n ?? 0).toFixed(dp)}%`;
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

const COLORS = {
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#94a3b8",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  green: "#22c55e",
  orange: "#f97316",
  zinc: "#a1a1aa",
};

function movingAverage(data: { day: string; starts: number }[], window = 7) {
  const out: { day: string; ma: number; starts: number }[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].starts;
    if (i >= window) sum -= data[i - window].starts;
    out.push({
      day: data[i].day,
      starts: data[i].starts,
      ma: i >= window - 1 ? +(sum / window).toFixed(2) : NaN,
    });
  }
  return out;
}

function cumulative(data: { day: string; starts: number }[]) {
  let acc = 0;
  return data.map((d) => {
    acc += d.starts;
    return { day: d.day, cumulative: acc };
  });
}

/* =============== UI micro-components =============== */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100",
        className
      )}
    />
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 rounded-full bg-slate-50 p-3 ring-1 ring-slate-100">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "active" | "expired" | "upcoming" | "unknown";
}) {
  const map: Record<string, string> = {
    active:
      "bg-emerald-50 text-emerald-700 border-emerald-200/60 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.15)]",
    expired:
      "bg-rose-50 text-rose-700 border-rose-200/60 shadow-[inset_0_1px_0_0_rgba(244,63,94,0.15)]",
    upcoming:
      "bg-amber-50 text-amber-800 border-amber-200/60 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.15)]",
    unknown:
      "bg-slate-50 text-slate-700 border-slate-200/60 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.15)]",
  };
  return (
    <span
      className={cn(
        "text-[11px] px-2 py-1 rounded-full border capitalize",
        map[status] || map.unknown
      )}
    >
      {status}
    </span>
  );
}

function KPI({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { label: string; positive?: boolean };
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
          {trend ? (
            <p
              className={cn(
                "mt-1 text-[11px]",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
        <div className="p-2 rounded-lg bg-slate-50 ring-1 ring-slate-100">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function PackageCard({
  title,
  total,
  active,
  expired,
  avgDaysLeft,
  selected,
  onClick,
}: {
  title: string;
  total: number;
  active: number;
  expired: number;
  avgDaysLeft: number | null;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left">
      <Card
        className={cn(
          "transition-all hover:shadow-sm border-slate-200",
          selected ? "ring-2 ring-cyan-400 shadow" : "hover:-translate-y-0.5"
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm line-clamp-1">{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 items-end">
          <div>
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">{formatInt(total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Active</p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatInt(active)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Expired</p>
            <p className="text-lg font-semibold text-rose-600">
              {formatInt(expired)}
            </p>
          </div>
          <div className="col-span-3 mt-1">
            <Badge variant="secondary" className="text-[10px]">
              {avgDaysLeft !== null
                ? `Avg days left: ${avgDaysLeft}`
                : "Avg days left: —"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/* ===================== Page ===================== */

export default function AMCEOSalesPage() {
  const { data, isLoading, mutate, error } = useSWR<Overview>(
    "/api/am/sales/overview",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [selectedPkg, setSelectedPkg] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  const summary = data?.summary;
  const series = data?.timeseries ?? [];
  const byPackage = data?.byPackage ?? [];
  const grouped = data?.groupedClients ?? [];
  const packageSales = data?.packageSales ?? [];
  const totalSales = data?.totalSales ?? summary?.totalSales ?? 0;
  const totalClients = summary?.totalWithPackage ?? 0;

  /* ===== Derived analytics for charts ===== */
  const ma7 = React.useMemo(() => movingAverage(series, 7), [series]);
  const cumStarts = React.useMemo(() => cumulative(series), [series]);

  // Growth: last 30d vs previous 30d (based on "starts")
  const growth = React.useMemo(() => {
    if (!series?.length) return null;
    const last30 = series.slice(-30);
    const prev30 = series.slice(-60, -30);
    const s1 = last30.reduce((a, b) => a + (b?.starts ?? 0), 0);
    const s0 = prev30.reduce((a, b) => a + (b?.starts ?? 0), 0);
    const delta = s1 - s0;
    const pct = s0 ? (delta / s0) * 100 : s1 ? 100 : 0;
    return { s0, s1, delta, pct };
  }, [series]);

  const pkgOptions = React.useMemo(() => {
    return grouped.map((g) => ({
      id: g.packageId,
      label: g.packageName ?? `(untitled ${g.packageId.slice(0, 6)})`,
      count: g.count,
    }));
  }, [grouped]);

  const currentClients = React.useMemo(() => {
    let arr: (typeof grouped)[number]["clients"] = [];
    if (selectedPkg === "all") {
      for (const g of grouped) arr = arr.concat(g.clients);
    } else {
      const g = grouped.find((x) => x.packageId === selectedPkg);
      if (g) arr = g.clients;
    }
    const q = query.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((c) =>
      `${c.name ?? ""} ${c.company ?? ""} ${c.email ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [grouped, selectedPkg, query]);

  const selectedLabel =
    selectedPkg === "all"
      ? "All Packages"
      : pkgOptions.find((p) => p.id === selectedPkg)?.label ??
        "Selected Package";

  /* ===================== UI ===================== */
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            AM CEO — Package Sales
          </h1>
          <p className="text-xs text-muted-foreground">
            Package performance, client status, and sales distribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="rounded-full">Live</Badge>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm">
            <p className="font-medium text-rose-600">Failed to load data.</p>
            <p className="mt-1 text-muted-foreground">
              Please try again or contact support if the issue persists.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ====== SALES SPOTLIGHT (Hero) ====== */}
      <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Left: Big number + meta */}
          <div className="p-6 lg:p-8 bg-gradient-to-br from-cyan-50 via-sky-50 to-white">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-cyan-600" />
              <p className="text-xs font-medium text-cyan-700">
                Sales Spotlight
              </p>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {isLoading ? "—" : formatInt(totalSales)}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Total Sales (all packages)
            </p>

            {/* Growth pill */}
            {!isLoading && growth ? (
              <div
                className={cn(
                  "mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
                  growth.delta >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                    : "bg-rose-50 text-rose-700 ring-rose-200/70"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">
                  {growth.delta >= 0 ? "+" : ""}
                  {growth.delta} vs prev. 30d
                </span>
                <span className="opacity-70">
                  ({growth.pct >= 0 ? "+" : ""}
                  {growth.pct.toFixed(1)}%)
                </span>
              </div>
            ) : (
              <div className="mt-4">
                <Skeleton className="h-6 w-40" />
              </div>
            )}

            {/* Top 3 packages quick insight */}
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-slate-700">
                Top Packages by Sales
              </p>
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </>
              ) : (
                packageSales
                  .slice()
                  .sort((a, b) => b.sales - a.sales)
                  .slice(0, 3)
                  .map((p) => {
                    const name = p.packageName ?? p.packageId.slice(0, 6);
                    const width = Math.max(5, Math.min(100, p.sharePercent));
                    return (
                      <div key={p.packageId}>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="truncate">{name}</span>
                          <span className="text-slate-500">
                            {formatInt(p.sales)} •{" "}
                            {formatPct(p.sharePercent, 1)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-cyan-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Middle: Sparkline (last 30d) */}
          <div className="p-6 lg:p-8">
            <p className="text-xs text-muted-foreground">Last 30 days starts</p>
            <div className="h-28 mt-2">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="starts"
                      stroke={COLORS.indigo}
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* KPI chips */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <KPI
                title="Active"
                value={isLoading ? "—" : formatInt(summary?.active)}
                icon={<Users className="h-5 w-5" />}
              />
              <KPI
                title="Expiring ≤30d"
                value={isLoading ? "—" : formatInt(summary?.expiringSoon)}
                icon={<Clock className="h-5 w-5" />}
              />
              <KPI
                title="Expired"
                value={isLoading ? "—" : formatInt(summary?.expired)}
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </div>
          </div>

          {/* Right: Sales Share Pie */}
          <div className="p-6 lg:p-8">
            <p className="text-xs text-muted-foreground">Sales Share</p>
            <div className="h-40 mt-2">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : packageSales.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(v: any) => `${v}%`}
                      contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                    />
                    <Pie
                      data={packageSales.map((p) => ({
                        name: p.packageName ?? p.packageId.slice(0, 6),
                        value: +(
                          (p.sharePercent as number)?.toFixed?.(2) ??
                          p.sharePercent
                        ),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {packageSales.map((_, idx) => {
                        const palette = [
                          COLORS.cyan,
                          COLORS.indigo,
                          COLORS.emerald,
                          COLORS.orange,
                          COLORS.violet,
                          COLORS.rose,
                          COLORS.amber,
                          COLORS.green,
                        ];
                        return (
                          <Cell
                            key={idx}
                            fill={palette[idx % palette.length]}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No sales data" />
              )}
            </div>
            <div className="mt-4 text-[11px] text-slate-600">
              Total:{" "}
              <span className="font-medium">{formatInt(totalSales)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ===== Packages Overview Cards ===== */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Packages Overview
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
            <PackageCard
              title="All Packages"
              total={totalClients}
              active={summary?.active ?? 0}
              expired={summary?.expired ?? 0}
              avgDaysLeft={null}
              selected={selectedPkg === "all"}
              onClick={() => setSelectedPkg("all")}
            />
            {byPackage.map((pkg) => (
              <PackageCard
                key={pkg.packageId}
                title={
                  pkg.packageName ?? `(untitled ${pkg.packageId.slice(0, 6)})`
                }
                total={pkg.clients}
                active={pkg.active}
                expired={pkg.expired}
                avgDaysLeft={pkg.avgDaysLeft}
                selected={selectedPkg === pkg.packageId}
                onClick={() => setSelectedPkg(pkg.packageId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Charts Row: Trend / MA vs Daily / Cumulative ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Daily starts (Area) */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Daily Starts (Last 90d)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : series.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="startsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={COLORS.sky}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.sky}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="starts"
                    stroke={COLORS.sky}
                    fill="url(#startsFill)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No recent starts" />
            )}
          </CardContent>
        </Card>

        {/* Daily vs 7-day MA (Composed) */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Daily vs 7-day Avg</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : series.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ma7}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                  />
                  <Bar dataKey="starts" name="Daily" fill={COLORS.zinc} />
                  <Line
                    type="monotone"
                    dataKey="ma"
                    name="7-day Avg"
                    stroke={COLORS.indigo}
                    dot={false}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No data" />
            )}
          </CardContent>
        </Card>

        {/* Cumulative Starts (Line) */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Cumulative Starts</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : cumStarts.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumStarts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke={COLORS.emerald}
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No data" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Clients by Package (Status Breakdown) ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Clients by Package (Status Breakdown)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <Skeleton className="h-full" />
          ) : byPackage.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPackage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={(d: any) => d.packageName ?? d.packageId.slice(0, 6)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0" }}
                />
                <Legend />
                <Bar
                  dataKey="clients"
                  stackId="total"
                  fill={COLORS.slate}
                  name="Total"
                />
                <Bar
                  dataKey="active"
                  stackId="status"
                  fill={COLORS.green}
                  name="Active"
                />
                <Bar
                  dataKey="expired"
                  stackId="status"
                  fill={COLORS.orange}
                  name="Expired"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No package data" />
          )}
        </CardContent>
      </Card>

      {/* ===== Sales Table ===== */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Package Sales</CardTitle>
          {!isLoading && (
            <div className="text-xs text-muted-foreground">
              Total sales:{" "}
              <span className="font-medium">{formatInt(totalSales)}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">% Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageSales.map((row, i) => (
                  <TableRow key={row.packageId}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      {row.packageName ??
                        `(untitled ${row.packageId.slice(0, 6)})`}
                    </TableCell>
                    <TableCell className="font-medium text-right">
                      {formatInt(row.sales)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPct(row.sharePercent, 2)}
                    </TableCell>
                  </TableRow>
                ))}
                {packageSales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No sales data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ===== Filters + Clients Table ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Clients</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedPkg}
              onValueChange={(v) => setSelectedPkg(v as any)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Packages ({formatInt(totalClients)})
                </SelectItem>
                {pkgOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label} ({formatInt(p.count)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search client name, company, or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-72 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium">
              {formatInt(currentClients.length)}
            </span>{" "}
            client(s) for <span className="font-medium">{selectedLabel}</span>
          </div>

          {isLoading ? (
            <Skeleton className="h-56" />
          ) : currentClients.length === 0 ? (
            <EmptyState
              title="No clients found"
              hint="Try clearing filters or adjusting your search."
            />
          ) : (
            <div className="overflow-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-[220px]">Client</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentClients.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium">
                        {c.name ?? "-"}
                      </TableCell>
                      <TableCell>{c.company ?? "-"}</TableCell>
                      <TableCell className="text-xs">
                        {c.email ?? "-"}
                      </TableCell>
                      <TableCell>
                        {c.startDate ? formatDate(c.startDate) : "-"}
                      </TableCell>
                      <TableCell>
                        {c.dueDate ? formatDate(c.dueDate) : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
