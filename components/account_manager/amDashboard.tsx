"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Activity,
  CalendarDays,
  Clock,
  TrendingUp,
  AlertTriangle,
  UserCircle2,
  Loader2,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
  Line,
} from "recharts";

import { useUserSession } from "@/lib/hooks/use-user-session";

type ClientLite = {
  id: string;
  name: string;
  status?: string | null;
  progress?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  amId?: string | null;
  packageId?: string | null;
  accountManager?: { id?: string; name?: string | null; email?: string | null } | null;
};

type FetchState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type PackageLite = { id: string; name: string };

function safeParse<T = unknown>(raw: any): T {
  if (typeof raw === "string") {
    try {
      const once = JSON.parse(raw);
      return typeof once === "string" ? (JSON.parse(once) as T) : (once as T);
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

// Enhanced color palette with professional gradients
const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#8b5cf6",
  accent: "#06b6d4",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  neutral: "#64748b",
  info: "#0ea5e9",
};

const GRADIENTS = {
  indigo: "bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70",
  emerald: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70",
  amber: "bg-gradient-to-br from-amber-50 via-white to-amber-100/70",
  blue: "bg-gradient-to-br from-blue-50 via-white to-blue-100/70",
  slate: "bg-gradient-to-br from-slate-50 via-white to-slate-100/70",
};

export function AMDashboard({ defaultAmId = "" }: { defaultAmId?: string }) {
  const [selectedAmId, setSelectedAmId] = useState<string>(defaultAmId);
  const { user, loading: sessionLoading } = useUserSession();

  // ---- Normalized role ----
  const role = (user?.role ?? "").toLowerCase();
  const isAM = role === "am";

  // Clients (filtered by AM server-side)
  const [clients, setClients] = useState<FetchState<ClientLite[]>>({
    data: [],
    loading: false,
    error: null,
  });

  // Packages map for pretty names in table
  const [pkgMap, setPkgMap] = useState<Record<string, string>>({});
  const [pkgLoading, setPkgLoading] = useState(false);

  // Set selection from session (AM users see their own clients)
  useEffect(() => {
    if (sessionLoading) return;
    if (isAM && user?.id && selectedAmId !== user.id) {
      setSelectedAmId(user.id);
    } else if (!isAM && !selectedAmId && defaultAmId) {
      setSelectedAmId(defaultAmId);
    }
  }, [sessionLoading, isAM, user?.id, defaultAmId, selectedAmId]);

  // Load packages → map id→name (once)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setPkgLoading(true);
        const res = await fetch("/api/packages", { cache: "no-store" });
        const raw = await res.json();
        const list = safeParse<any[]>(raw);
        const map: Record<string, string> = {};
        (Array.isArray(list) ? list : Array.isArray((raw as any)?.data) ? (raw as any).data : []).forEach((p: any) => {
          if (p?.id) map[String(p.id)] = String(p.name ?? "Unnamed");
        });
        if (mounted) setPkgMap(map);
      } catch {
        if (mounted) setPkgMap({});
      } finally {
        if (mounted) setPkgLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Load clients (session-based & server-side scoped) ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (sessionLoading) return; // wait for session
      try {
        if (!mounted) return;
        setClients({ data: [], loading: true, error: null });

        // Build URL
        let url = "/api/clients";
        if (isAM) {
          const am = selectedAmId || user?.id || "";
          if (!am) {
            if (mounted) setClients({ data: [], loading: false, error: null });
            return;
          }
          url = `/api/clients?amId=${encodeURIComponent(am)}`;
        } else if (selectedAmId) {
          url = `/api/clients?amId=${encodeURIComponent(selectedAmId)}`;
        }

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load clients");
        const raw = await res.json();

        // Robust parsing: supports [ ... ], { clients: [...] }, { data: [...] }, { data: { clients: [...] } }
        const arrLike =
          (Array.isArray(raw) && raw) ||
          (Array.isArray((raw as any)?.clients) && (raw as any).clients) ||
          (Array.isArray((raw as any)?.data) && (raw as any).data) ||
          (Array.isArray((raw as any)?.data?.clients) && (raw as any).data.clients) ||
          [];

        const mapped: ClientLite[] = (arrLike as any[]).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? "Unnamed"),
          status: c.status ?? null,
          progress: typeof c.progress === "number" ? c.progress : c.progress ? Number(c.progress) : null,
          startDate: c.startDate ?? null,
          dueDate: c.dueDate ?? null,
          amId: c.amId ?? null,
          packageId: c.packageId ?? null,
          accountManager: c.accountManager ?? null,
        }));

        if (mounted) setClients({ data: mapped, loading: false, error: null });
      } catch (e: any) {
        if (mounted) setClients({ data: [], loading: false, error: e?.message ?? "Failed to load clients" });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionLoading, isAM, selectedAmId, user?.id]);

  // ---------- Derived metrics ----------
  const now = new Date();

  const statusCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of clients.data) {
      const s = (c.status ?? "unknown").toString().toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
    }
    return acc;
  }, [clients.data]);

  const totalClients = clients.data.length;
  const activeClients = clients.data.filter((c) => (c.status ?? "").toLowerCase() === "active").length;

  const avgProgress = useMemo(() => {
    if (!clients.data.length) return 0;
    const vals = clients.data.map((c) => Number(c.progress ?? 0));
    const sum = vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return Math.round(sum / clients.data.length);
  }, [clients.data]);

  const dueIn7Days = useMemo(() => {
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    return clients.data.filter((c) => {
      if (!c.dueDate) return false;
      const d = new Date(c.dueDate);
      return d >= now && d <= in7;
    }).length;
  }, [clients.data]);

  const upcomingDueList = useMemo(() => {
    return [...clients.data]
      .filter((c) => !!c.dueDate)
      .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())
      .slice(0, 8);
  }, [clients.data]);

  // Enhanced Charts Data
  const pieData = useMemo(
    () =>
      Object.entries(statusCounts).map(([name, value], index) => ({
        name: name.replace(/_/g, " "),
        value,
        fill: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length],
      })),
    [statusCounts]
  );

  const progressBuckets = useMemo(() => {
    const buckets = [
      { label: "0–20%", min: 0, max: 20 },
      { label: "21–40%", min: 21, max: 40 },
      { label: "41–60%", min: 41, max: 60 },
      { label: "61–80%", min: 61, max: 80 },
      { label: "81–100%", min: 81, max: 100 },
    ];
    const counts = buckets.map((b) => ({ ...b, count: 0 }));
    for (const c of clients.data) {
      const p = Number(c.progress ?? 0);
      const bucket = counts.find((b) => p >= b.min && p <= b.max);
      if (bucket) bucket.count += 1;
    }
    return counts.map((b) => ({ label: b.label, count: b.count }));
  }, [clients.data]);

  // Enhanced progress chart with line overlay
  const enhancedProgressData = useMemo(
    () =>
      progressBuckets.map((bucket, index) => ({
        ...bucket,
        trend: Math.max(0, bucket.count - (progressBuckets[index - 1]?.count || 0)),
      })),
    [progressBuckets]
  );

  const startsByMonth = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    const d = new Date(now);
    for (let i = 5; i >= 0; i--) {
      const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, "0")}`;
      const label = temp.toLocaleString("en-US", { month: "short" });
      months.push({ key, label, count: 0 });
    }
    for (const c of clients.data) {
      if (!c.startDate) continue;
      const sd = new Date(c.startDate);
      const k = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
      const row = months.find((m) => m.key === k);
      if (row) row.count += 1;
    }
    return months;
  }, [clients.data, now]);

  const amLabel = useMemo(() => {
    if (isAM) {
      if (user?.name && user?.email) return `${user.name}`;
      return user?.name || user?.email || "My Clients";
    }
    const cm = clients.data[0]?.accountManager;
    if (cm?.name && cm?.email) return `${cm.name}`;
    if (cm?.name || cm?.email) return cm.name || cm.email || "All AMs";
    return selectedAmId ? "Selected AM" : "All AMs";
  }, [isAM, user, selectedAmId, clients.data]);

  const formatDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="space-y-6 px-4 bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            AM's Dashboard
          </h1>
          <p className="text-sm text-slate-600 font-medium">
            {amLabel} • {totalClients} total clients
          </p>
        </div>
      </div>

      {/* Loading / Error States */}
      {clients.loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 bg-white rounded-xl shadow-sm border">
          <Loader2 className="w-5 h-5 mr-3 animate-spin text-indigo-500" />
          <span className="font-medium">Loading dashboard data...</span>
        </div>
      ) : clients.error ? (
        <div className="flex items-center justify-center gap-3 py-16 text-rose-600 bg-white rounded-xl shadow-sm border">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{clients.error}</span>
        </div>
      ) : (
        <>
          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className={`border-0 shadow-lg ${GRADIENTS.indigo} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total Clients
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {totalClients}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span>Portfolio size</span>
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-500 rounded-xl shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-lg ${GRADIENTS.emerald} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Active Clients
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {activeClients}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Activity className="w-3 h-3 text-emerald-500" />
                      <span>Currently engaged</span>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500 rounded-xl shadow-lg">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>


            <Card className={`border-0 shadow-lg ${GRADIENTS.amber} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Due in 7 Days
                    </p>
                    <p className="text-3xl font-bold text-slate-800">
                      {dueIn7Days}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <CalendarDays className="w-3 h-3 text-amber-500" />
                      <span>Upcoming deadlines</span>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500 rounded-xl shadow-lg">
                    <CalendarDays className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhanced Status Pie Chart with Donut */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.slate} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-indigo-500 rounded-lg shadow-md">
                    <PieChartIcon className="w-5 h-5 text-white" />
                  </div>
                  <span>Client Status Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {pieData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {pieData.map((entry, index) => (
                          <filter key={index} id={`glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                              <feMergeNode in="coloredBlur"/>
                              <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                        ))}
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => 
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill}
                            filter={`url(#glow-${index})`}
                          />
                        ))}
                      </Pie>
                      <RTooltip 
                        formatter={(value: number) => [`${value} clients`, 'Count']}
                        contentStyle={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500 font-medium">
                    No status data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Progress Bar Chart with Line Overlay */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.emerald} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-emerald-500 rounded-lg shadow-md">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span>Progress Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enhancedProgressData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number) => [value, 'Clients']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="url(#progressGradient)" 
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="trend" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                      strokeDasharray="3 3"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Enhanced Area Chart with Gradient */}
            <Card className={`border-0 shadow-lg ${GRADIENTS.blue} hover:shadow-xl transition-all duration-300`}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                  <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <span>Client Onboarding Trend</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={startsByMonth} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorStarts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.5}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: number) => [value, 'New Clients']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="url(#colorLine)"
                      strokeWidth={3}
                      fill="url(#colorStarts)" 
                      dot={{ fill: "#6366f1", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#6366f1" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Upcoming Due Table */}
          <Card className={`border-0 shadow-lg ${GRADIENTS.amber} hover:shadow-xl transition-all duration-300 mb-8`}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-slate-800 font-semibold">
                <div className="p-2 bg-amber-500 rounded-lg shadow-md">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <span>Upcoming Deliverables</span>
                <Badge
                  variant="secondary"
                  className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                >
                  {upcomingDueList.length}
                </Badge>
                <span className="ml-auto text-sm text-slate-500 font-medium hidden lg:block">
                  Viewing: {amLabel}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {upcomingDueList.length ? (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 text-left text-slate-600 border-b border-slate-200">
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Client</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Status</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Package</th>
                        <th className="py-4 px-6 font-semibold text-xs uppercase tracking-wider">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingDueList.map((c, index) => (
                        <tr
                          key={c.id}
                          className={`border-t border-slate-100 hover:bg-white/70 transition-colors duration-150 ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                          }`}
                        >
                          <td className="py-4 px-6 font-semibold text-slate-800">
                            {c.name}
                          </td>
                          <td className="py-4 px-6">
                            <Badge
                              variant="outline"
                              className="border-slate-300 text-slate-700 bg-white font-medium capitalize px-3 py-1"
                            >
                              {(c.status ?? "—").toString().replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-medium">
                            {c.packageId
                              ? pkgMap[c.packageId] ??
                                (pkgLoading ? "Loading…" : c.packageId)
                              : "—"}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-amber-500" />
                              <span className="font-medium text-slate-700">
                                {formatDate(c.dueDate)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-500 font-medium">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>No upcoming deliverables found</p>
                  <p className="text-sm text-slate-400 mt-1">All clients are up to date</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}