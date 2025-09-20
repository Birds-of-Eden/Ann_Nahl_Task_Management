"use client";

import * as React from "react";
import useSWR from "swr";
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
  DollarSign,
  Package as PackageIcon,
  Target,
  CalendarX,
  Package,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Enhanced color palette
const COLORS = {
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  warning: "#F97316",
  success: "#22C55E",
  purple: "#8B5CF6",
  pink: "#EC4899",
  teal: "#14B8A6",
  indigo: "#6366F1",
};

const PIE_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.accent,
  COLORS.purple,
  COLORS.pink,
  COLORS.teal,
  COLORS.indigo,
  COLORS.warning,
  COLORS.danger,
];

type Status = "active" | "expired" | "upcoming" | "unknown";

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
      status: Status;
    }[];
  }[];
};

export default function AMCEOSalesPage() {
  const { data } = useSWR<Overview>("/api/am/sales/overview", fetcher);

  const [selectedPkg, setSelectedPkg] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  const summary = data?.summary;
  const series = data?.timeseries ?? [];
  const byPackage = data?.byPackage ?? [];
  const grouped = data?.groupedClients ?? [];
  const packageSales = data?.packageSales ?? [];
  // NOTE: "Total Revenue" card will now show expired-clients info (count),
  // so totalSales from API is no longer displayed in the KPI.
  const totalClients = summary?.totalWithPackage ?? 0;

  /* =========================
     Build month-over-month dynamics from API data
  ======================== */
  const ALL_CLIENTS = React.useMemo(
    () => grouped.flatMap((g) => g.clients),
    [grouped]
  );

  // Helpers for month boundaries
  const today = new Date();
  const cmYear = today.getFullYear();
  const cmMonth = today.getMonth(); // 0-11
  const prevMonthDate = new Date(cmYear, cmMonth - 1, 1);
  const pmYear = prevMonthDate.getFullYear();
  const pmMonth = prevMonthDate.getMonth();

  const isInYearMonth = (d: Date, y: number, m: number) =>
    d.getFullYear() === y && d.getMonth() === m;

  // Parse ISO safely
  const parse = (v: string | null) => (v ? new Date(v) : null);

  // Derive monthly metrics
  const startedThisMonth = React.useMemo(
    () =>
      ALL_CLIENTS.filter((c) => {
        const sd = parse(c.startDate);
        return sd ? isInYearMonth(sd, cmYear, cmMonth) : false;
      }),
    [ALL_CLIENTS, cmYear, cmMonth]
  );

  const startedPrevMonth = React.useMemo(
    () =>
      ALL_CLIENTS.filter((c) => {
        const sd = parse(c.startDate);
        return sd ? isInYearMonth(sd, pmYear, pmMonth) : false;
      }),
    [ALL_CLIENTS, pmYear, pmMonth]
  );

  const activeStartedThisMonth = React.useMemo(
    () => startedThisMonth.filter((c) => c.status === "active"),
    [startedThisMonth]
  );
  const activeStartedPrevMonth = React.useMemo(
    () => startedPrevMonth.filter((c) => c.status === "active"),
    [startedPrevMonth]
  );

  const expiredThisMonth = React.useMemo(
    () =>
      ALL_CLIENTS.filter((c) => {
        const dd = parse(c.dueDate);
        // "Expired clients information" = due date is in current month AND already expired by now
        return dd ? isInYearMonth(dd, cmYear, cmMonth) && dd < today : false;
      }),
    [ALL_CLIENTS, cmYear, cmMonth, today]
  );

  const expiredPrevMonth = React.useMemo(
    () =>
      ALL_CLIENTS.filter((c) => {
        const dd = parse(c.dueDate);
        // Expired in previous month (due date fell in previous month)
        return dd ? isInYearMonth(dd, pmYear, pmMonth) : false;
      }),
    [ALL_CLIENTS, pmYear, pmMonth]
  );

  // "Packages Sold" per month = number of clients who started this month
  const packagesSoldThisMonth = startedThisMonth.length;
  const packagesSoldPrevMonth = startedPrevMonth.length;

  // Change helpers
  function pctChange(curr: number, prev: number) {
    if (prev === 0) {
      if (curr === 0) return { text: "0%", type: "positive" as const };
      return { text: "+100%", type: "positive" as const };
    }
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    const rounded = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    return {
      text: rounded,
      type: pct >= 0 ? ("positive" as const) : ("negative" as const),
    };
  }

  // Build KPI dynamics
  // Overall (cumulative) values from the API
  const overallTotalClients = summary?.totalWithPackage ?? 0;
  const overallActiveClients = summary?.active ?? 0;
  const overallExpiredClients = summary?.expired ?? 0;
  // For overall “Packages Sold”, use total clients with a package (all sales to date)
  const overallPackagesSold = overallTotalClients;
  const packagesWithAtLeastOneClient = React.useMemo(
    () =>
      byPackage ? byPackage.filter((p) => (p.clients || 0) > 0).length : 0,
    [byPackage]
  );

  // Build KPI objects: VALUE = overall, CHANGE = MoM you computed above
  const kpiTotalClients = {
    value: overallTotalClients,
    change: pctChange(startedThisMonth.length, startedPrevMonth.length),
  };

  const kpiActiveClients = {
    value: overallActiveClients,
    change: pctChange(
      activeStartedThisMonth.length,
      activeStartedPrevMonth.length
    ),
  };

  const kpiExpiredClients = {
    value: overallExpiredClients,
    change: pctChange(expiredThisMonth.length, expiredPrevMonth.length),
  };

  const kpiPackagesSold = {
    value: overallPackagesSold,
    change: pctChange(packagesSoldThisMonth, packagesSoldPrevMonth),
  };

  /* =========================
     Existing computed visuals
  ======================== */
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

  // Prepare pie chart data
  const packageDistributionData = React.useMemo(() => {
    return byPackage.map((pkg) => ({
      name: pkg.packageName ?? `Package ${pkg.packageId.slice(0, 6)}`,
      value: pkg.clients,
      packageId: pkg.packageId,
    }));
  }, [byPackage]);

  const statusDistributionData = React.useMemo(() => {
    return [
      { name: "Active", value: summary?.active ?? 0, color: COLORS.success },
      { name: "Expired", value: summary?.expired ?? 0, color: COLORS.danger },
      {
        name: "Starting Soon",
        value: summary?.startingSoon ?? 0,
        color: COLORS.warning,
      },
      {
        name: "Expiring Soon",
        value: summary?.expiringSoon ?? 0,
        color: COLORS.accent,
      },
    ].filter((item) => item.value > 0);
  }, [summary]);

  const salesDistributionData = React.useMemo(() => {
    return packageSales.map((pkg) => ({
      name: pkg.packageName ?? `Package ${pkg.packageId.slice(0, 6)}`,
      value: pkg.sales,
      percentage: pkg.sharePercent,
    }));
  }, [packageSales]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Sales Analytics Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Comprehensive package sales overview and insights
          </p>
        </div>
        <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 px-4 py-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          Live Data
        </Badge>
      </div>

      {/* Enhanced KPI Cards (now dynamic MoM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Clients"
          value={kpiTotalClients.value}
          icon={<Users className="h-6 w-6" />}
          gradient="from-blue-500 to-cyan-600"
          change={kpiTotalClients.change.text}
          changeType={kpiTotalClients.change.type}
        />
        <KPICard
          title="Active Clients"
          value={kpiActiveClients.value}
          icon={<Target className="h-6 w-6" />}
          gradient="from-purple-500 to-violet-600"
          change={kpiActiveClients.change.text}
          changeType={kpiActiveClients.change.type}
        />
        <KPICard
          title="Expired Clients"
          value={kpiExpiredClients.value}
          icon={<CalendarX className="h-6 w-6" />} // or your chosen icon
          gradient="from-green-500 to-emerald-600"
          change={kpiExpiredClients.change.text}
          changeType={kpiExpiredClients.change.type}
        />
        <KPICard
          title="Packages Sold"
          value={kpiPackagesSold.value}
          icon={<Package className="h-6 w-6" />}
          gradient="from-orange-500 to-red-600"
          change={kpiPackagesSold.change.text}
          changeType={kpiPackagesSold.change.type}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Package Distribution Pie Chart */}
        <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5" />
              Package Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {packageDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Contract Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales Distribution Pie Chart */}
        <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sales by Package
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {salesDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Package Cards */}
      <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-xl">
          <CardTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Package Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            <PackageCard
              title="All Packages"
              total={totalClients}
              active={summary?.active ?? 0}
              expired={summary?.expired ?? 0}
              avgDaysLeft={null}
              selected={selectedPkg === "all"}
              onClick={() => setSelectedPkg("all")}
              gradient="from-slate-600 to-slate-700"
            />
            {byPackage.map((pkg, index) => (
              <PackageCard
                key={pkg.packageId}
                title={
                  pkg.packageName ?? `Package ${pkg.packageId.slice(0, 6)}`
                }
                total={pkg.clients}
                active={pkg.active}
                expired={pkg.expired}
                avgDaysLeft={pkg.avgDaysLeft}
                selected={selectedPkg === pkg.packageId}
                onClick={() => setSelectedPkg(pkg.packageId)}
                gradient={`from-${
                  [
                    "blue",
                    "green",
                    "purple",
                    "orange",
                    "pink",
                    "teal",
                    "indigo",
                    "red",
                    "yellow",
                  ][index % 9]
                }-500 to-${
                  [
                    "blue",
                    "green",
                    "purple",
                    "orange",
                    "pink",
                    "teal",
                    "indigo",
                    "red",
                    "yellow",
                  ][index % 9]
                }-600`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Trend Chart */}
      <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-t-xl">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            New Package Starts Trend (Last 90 days)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <defs>
                  <linearGradient id="colorStarts" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={COLORS.primary}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={COLORS.primary}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="starts"
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  fill="url(#colorStarts)"
                  dot={{ fill: COLORS.primary, strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, stroke: COLORS.primary, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Client Table */}
      <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-t-xl">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Management
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={selectedPkg}
                onValueChange={(v) => setSelectedPkg(v as any)}
              >
                <SelectTrigger className="w-56 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Packages ({totalClients})
                  </SelectItem>
                  {pkgOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} ({p.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search clients..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-72 bg-white/20 border-white/30 text-white placeholder:text-white/70"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-600">
              Displaying{" "}
              <span className="font-bold text-blue-600">
                {currentClients.length}
              </span>{" "}
              client(s)
              {selectedPkg !== "all" && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {pkgOptions.find((p) => p.id === selectedPkg)?.label ??
                    "Selected Package"}
                </span>
              )}
            </p>
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">
                    Client
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Company
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Email
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Start Date
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Due Date
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentClients.map((c, index) => (
                  <TableRow
                    key={c.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-25"
                    }`}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {c.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {c.company ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {c.startDate ? fmtDate(c.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {c.dueDate ? fmtDate(c.dueDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {currentClients.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-slate-500 py-12"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-12 w-12 text-slate-300" />
                        <p>No clients found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== Enhanced Components ===== */

function PackageCard({
  title,
  total,
  active,
  expired,
  avgDaysLeft,
  selected,
  onClick,
  gradient,
}: {
  title: string;
  total: number;
  active: number;
  expired: number;
  avgDaysLeft: number | null;
  selected?: boolean;
  onClick?: () => void;
  gradient?: string;
}) {
  return (
    <button onClick={onClick} className="text-left w-full">
      <Card
        className={cn(
          "transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/90 backdrop-blur-sm border-white/20",
          selected ? "ring-2 ring-cyan-400 shadow-xl scale-105" : ""
        )}
      >
        <CardHeader
          className={`bg-gradient-to-br ${
            gradient || "from-blue-500 to-blue-600"
          } text-white rounded-t-xl pb-2`}
        >
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                Total
              </p>
              <p className="text-lg font-bold text-slate-800">{total}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                Active
              </p>
              <p className="text-lg font-bold text-emerald-600">{active}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                Expired
              </p>
              <p className="text-lg font-bold text-rose-600">{expired}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="text-[10px] w-full justify-center bg-slate-100 text-slate-600"
          >
            {avgDaysLeft !== null
              ? `Avg: ${avgDaysLeft} days left`
              : "Avg: N/A"}
          </Badge>
        </CardContent>
      </Card>
    </button>
  );
}

function KPICard({
  title,
  value,
  icon,
  gradient,
  change,
  changeType,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  gradient: string;
  change?: string;
  changeType?: "positive" | "negative";
}) {
  return (
    <Card className="bg-white/90 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}
          >
            <div className="text-white">{icon}</div>
          </div>
          {change && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                changeType === "positive"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {change}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm text-slate-500 uppercase tracking-wide font-medium">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  status,
}: {
  status: "active" | "expired" | "upcoming" | "unknown";
}) {
  const statusConfig = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    expired: "bg-rose-100 text-rose-700 border-rose-200",
    upcoming: "bg-amber-100 text-amber-700 border-amber-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center text-xs px-3 py-1 rounded-full font-medium border ${
        statusConfig[status] || statusConfig.unknown
      }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === "active"
            ? "bg-emerald-500"
            : status === "expired"
            ? "bg-rose-500"
            : status === "upcoming"
            ? "bg-amber-500"
            : "bg-slate-500"
        }`}
      ></div>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
