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
        "animate-pulse rounded-xl bg-gradient-to-r from-slate-50 via-white to-slate-50 shadow-inner",
        className
      )}
    />
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm ring-1 ring-slate-100">
        <Search className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint ? (
        <p className="mt-2 text-xs text-slate-500 max-w-sm">{hint}</p>
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
      "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200/80 shadow-sm ring-1 ring-emerald-100",
    expired:
      "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200/80 shadow-sm ring-1 ring-rose-100",
    upcoming:
      "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border-amber-200/80 shadow-sm ring-1 ring-amber-100",
    unknown:
      "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200/80 shadow-sm ring-1 ring-slate-100",
  };
  return (
    <span
      className={cn(
        "text-[11px] font-medium px-2.5 py-1.5 rounded-full capitalize tracking-wide",
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
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600 tracking-wide uppercase">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {trend ? (
            <p
              className={cn(
                "text-[11px] font-medium tracking-wide",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm ring-1 ring-slate-200/50">
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
    <button onClick={onClick} className="text-left w-full group">
      <Card
        className={cn(
          "transition-all duration-200 border-0 shadow-sm ring-1",
          selected 
            ? "ring-2 ring-cyan-400 shadow-lg shadow-cyan-100/50 -translate-y-1" 
            : "ring-slate-200/60 hover:shadow-lg hover:-translate-y-1 hover:ring-slate-300/60"
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold line-clamp-1 text-slate-900">{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-slate-900">{formatInt(total)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Active</p>
            <p className="text-lg font-bold text-emerald-600">{formatInt(active)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Expired</p>
            <p className="text-lg font-bold text-rose-600">{formatInt(expired)}</p>
          </div>
          <div className="col-span-3 mt-2">
            <Badge variant="secondary" className="text-[10px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AM CEO — Package Sales
            </h1>
            <p className="text-sm text-slate-600 font-medium mb-2">
              Package performance, client status, and sales distribution
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 hover:bg-green-200 transition-colors shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live
            </Badge>
            <button
              onClick={() => mutate()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {error ? (
          <Card className="border-0 shadow-sm ring-1 ring-red-200 bg-gradient-to-r from-red-50 to-rose-50">
            <CardContent className="p-6">
              <p className="font-semibold text-red-700 mb-2">Failed to load data.</p>
              <p className="text-sm text-red-600">
                Please try again or contact support if the issue persists.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* ====== SALES SPOTLIGHT (Hero) ====== */}
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200/60">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Left: Big number + meta */}
            <div className="p-8 lg:p-10 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/30 via-transparent to-transparent"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-white/80 shadow-sm ring-1 ring-cyan-200/50">
                    <Star className="h-5 w-5 text-cyan-600" />
                  </div>
                  <p className="text-sm font-semibold text-cyan-700 tracking-wide">
                    Sales Spotlight
                  </p>
                </div>
                <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
                  {isLoading ? "—" : formatInt(totalSales)}
                </h2>
                <p className="text-sm text-slate-600 font-medium mb-6">
                  Total Sales (all packages)
                </p>

                {/* Growth pill */}
                {!isLoading && growth ? (
                  <div
                    className={cn(
                      "inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium ring-1 shadow-sm",
                      growth.delta >= 0
                        ? "bg-white/90 text-emerald-700 ring-emerald-200/70"
                        : "bg-white/90 text-rose-700 ring-rose-200/70"
                    )}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {growth.delta >= 0 ? "+" : ""}
                      {growth.delta} vs prev. 30d
                    </span>
                    <span className="opacity-70">
                      ({growth.pct >= 0 ? "+" : ""}
                      {growth.pct.toFixed(1)}%)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Skeleton className="h-8 w-48" />
                  </div>
                )}

                {/* Top 3 packages quick insight */}
                <div className="mt-8 space-y-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Top Packages by Sales
                  </p>
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-4/5" />
                      <Skeleton className="h-6 w-3/5" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {packageSales
                        .slice()
                        .sort((a, b) => b.sales - a.sales)
                        .slice(0, 3)
                        .map((p, idx) => {
                          const name = p.packageName ?? p.packageId.slice(0, 6);
                          const width = Math.max(5, Math.min(100, p.sharePercent));
                          return (
                            <div key={p.packageId} className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="truncate font-medium text-slate-700">
                                  #{idx + 1} {name}
                                </span>
                                <span className="text-slate-600 font-medium">
                                  {formatInt(p.sales)} • {formatPct(p.sharePercent, 1)}
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-white/60 shadow-inner">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-sm"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle: Sparkline (last 30d) */}
            <div className="p-8 lg:p-10 bg-white">
              <p className="text-sm font-semibold text-slate-700 mb-4">Last 30 days starts</p>
              <div className="h-32 mb-6">
                {isLoading ? (
                  <Skeleton className="h-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.slice(-30)}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ 
                          borderRadius: 12, 
                          borderColor: "#e2e8f0",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "12px"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="starts"
                        stroke={COLORS.indigo}
                        dot={false}
                        strokeWidth={3}
                        filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* KPI chips */}
              <div className="grid grid-cols-3 gap-4">
                <KPI
                  title="Active"
                  value={isLoading ? "—" : formatInt(summary?.active)}
                  icon={<Users className="h-5 w-5 text-emerald-600" />}
                />
                <KPI
                  title="Expiring ≤30d"
                  value={isLoading ? "—" : formatInt(summary?.expiringSoon)}
                  icon={<Clock className="h-5 w-5 text-amber-600" />}
                />
                <KPI
                  title="Expired"
                  value={isLoading ? "—" : formatInt(summary?.expired)}
                  icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
                />
              </div>
            </div>

            {/* Right: Sales Share Pie */}
            <div className="p-8 lg:p-10 bg-gradient-to-br from-slate-50 to-gray-50">
              <p className="text-sm font-semibold text-slate-700 mb-4">Sales Share</p>
              <div className="h-48 mb-4">
                {isLoading ? (
                  <Skeleton className="h-full" />
                ) : packageSales.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(v: any) => `${v}%`}
                        contentStyle={{ 
                          borderRadius: 12, 
                          borderColor: "#e2e8f0",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "12px"
                        }}
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
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
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
              <div className="text-center">
                <p className="text-xs text-slate-600">
                  Total: <span className="font-semibold text-slate-900">{formatInt(totalSales)}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* ===== Packages Overview Cards ===== */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Packages Overview
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Daily starts (Area) */}
          <Card className="xl:col-span-1 border-0 shadow-sm ring-1 ring-slate-200/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Daily Starts (Last 90d)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
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
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={COLORS.sky}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false} 
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        borderRadius: 12, 
                        borderColor: "#e2e8f0",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="starts"
                      stroke={COLORS.sky}
                      fill="url(#startsFill)"
                      strokeWidth={3}
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
          <Card className="xl:col-span-1 border-0 shadow-sm ring-1 ring-slate-200/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Daily vs 7-day Avg</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ma7}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false}
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        borderRadius: 12, 
                        borderColor: "#e2e8f0",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px"
                      }}
                    />
                    <Bar dataKey="starts" name="Daily" fill={COLORS.zinc} radius={2} />
                    <Line
                      type="monotone"
                      dataKey="ma"
                      name="7-day Avg"
                      stroke={COLORS.indigo}
                      dot={false}
                      strokeWidth={3}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No data" />
              )}
            </CardContent>
          </Card>

          {/* Cumulative Starts (Line) */}
          <Card className="xl:col-span-1 border-0 shadow-sm ring-1 ring-slate-200/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Cumulative Starts</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : cumStarts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumStarts}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      tickLine={false} 
                      axisLine={false}
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        borderRadius: 12, 
                        borderColor: "#e2e8f0",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px"
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke={COLORS.emerald}
                      dot={false}
                      strokeWidth={3}
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
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">Clients by Package (Status Breakdown)</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : byPackage.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPackage}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey={(d: any) => d.packageName ?? d.packageId.slice(0, 6)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: '#64748b' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: 12, 
                      borderColor: "#e2e8f0",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontSize: "12px"
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="clients"
                    stackId="total"
                    fill={COLORS.slate}
                    name="Total"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="active"
                    stackId="status"
                    fill={COLORS.green}
                    name="Active"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="expired"
                    stackId="status"
                    fill={COLORS.orange}
                    name="Expired"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No package data" />
            )}
          </CardContent>
        </Card>

        {/* ===== Sales Table ===== */}
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">Package Sales</CardTitle>
            {!isLoading && (
              <div className="text-sm text-slate-600">
                Total sales:{" "}
                <span className="font-semibold text-slate-900">{formatInt(totalSales)}</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-slate-50/80">
                      <TableHead className="font-semibold text-slate-900">#</TableHead>
                      <TableHead className="font-semibold text-slate-900">Package</TableHead>
                      <TableHead className="text-right font-semibold text-slate-900">Sales</TableHead>
                      <TableHead className="text-right font-semibold text-slate-900">% Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packageSales.map((row, i) => (
                      <TableRow key={row.packageId} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-medium text-slate-600">{i + 1}</TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {row.packageName ??
                            `(untitled ${row.packageId.slice(0, 6)})`}
                        </TableCell>
                        <TableCell className="font-semibold text-right text-slate-900">
                          {formatInt(row.sales)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-700">
                          {formatPct(row.sharePercent, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {packageSales.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-slate-500 py-12"
                        >
                          No sales data found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== Filters + Clients Table ===== */}
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Clients</CardTitle>
            <div className="flex items-center gap-3">
              <Select
                value={selectedPkg}
                onValueChange={(v) => setSelectedPkg(v as any)}
              >
                <SelectTrigger className="w-60 border-slate-200 shadow-sm">
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
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search client name, company, or email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-80 pl-10 border-slate-200 shadow-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {formatInt(currentClients.length)}
              </span>{" "}
              client(s) for <span className="font-semibold text-slate-900">{selectedLabel}</span>
            </div>

            {isLoading ? (
              <Skeleton className="h-64" />
            ) : currentClients.length === 0 ? (
              <EmptyState
                title="No clients found"
                hint="Try clearing filters or adjusting your search."
              />
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                    <TableRow className="hover:bg-slate-50/80">
                      <TableHead className="w-[220px] font-semibold text-slate-900">Client</TableHead>
                      <TableHead className="font-semibold text-slate-900">Company</TableHead>
                      <TableHead className="font-semibold text-slate-900">Email</TableHead>
                      <TableHead className="font-semibold text-slate-900">Start</TableHead>
                      <TableHead className="font-semibold text-slate-900">Due</TableHead>
                      <TableHead className="font-semibold text-slate-900">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentClients.map((c) => (
                      <TableRow key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-semibold text-slate-900">
                          {c.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {c.company ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {c.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {c.startDate ? formatDate(c.startDate) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {c.dueDate ? formatDate(c.dueDate) : "—"}
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
    </div>
  );
}