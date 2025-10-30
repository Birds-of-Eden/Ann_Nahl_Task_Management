"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Activity,
  CalendarDays,
  Clock,
  TrendingUp,
  Filter,
  AlertTriangle,
  UserCircle2,
  Loader2,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Legend,
} from "recharts";

import { useUserSession } from "@/lib/hooks/use-user-session";

type ClientLite = {
  id: string;
  name: string;
  status?: string | null;
  progress?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  amCeoId?: string | null;
  packageId?: string | null;
  accountManager?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type Summary = {
  totalClients: number;
  activeClients: number;
  avgProgress: number;
  dueIn7Days: number;
  statusCounts: Record<string, number>;
  progressBuckets: { label: string; count: number }[];
  startsByMonth: { key: string; label: string; count: number }[];
  upcomingDueList: Array<{
    id: string;
    name: string;
    status: string | null;
    progress: number | null;
    packageId: string | null;
    dueDate: string | null;
  }>;
};

type FetchState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

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

export function AMCeoDashboard({ defaultAmId = "" }: { defaultAmId?: string }) {
  const [selectedAmCeoId, setSelectedAmCeoId] = useState<string>(defaultAmId);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientOpen, setClientOpen] = useState<boolean>(false);
  const { user, loading: sessionLoading } = useUserSession();

  const [clients, setClients] = useState<FetchState<ClientLite[]>>({
    data: [],
    loading: false,
    error: null,
  });

  const [summary, setSummary] = useState<FetchState<Summary | null>>({
    data: null,
    loading: false,
    error: null,
  });

  const [pkgMap, setPkgMap] = useState<Record<string, string>>({});
  const [pkgLoading, setPkgLoading] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (user?.role === "am_ceo" && user?.id) {
      setSelectedAmCeoId(user.id);
      return;
    }
    if (!user?.id && defaultAmId && !selectedAmCeoId) {
      setSelectedAmCeoId(defaultAmId);
    }
  }, [user, sessionLoading, defaultAmId, selectedAmCeoId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setPkgLoading(true);
        const res = await fetch("/api/packages", { cache: "no-store" });
        const raw = await res.json();
        const list = safeParse<any[]>(raw);
        const map: Record<string, string> = {};
        (Array.isArray(list) ? list : []).forEach((p) => {
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        setClients({ data: [], loading: true, error: null });

        const url = selectedAmCeoId
          ? `/api/clients?am_ceoId=${encodeURIComponent(selectedAmCeoId)}`
          : "/api/clients";
        const res = await fetch(url, { cache: "no-store" });
        const raw = await res.json();
        const arr = safeParse<any[]>(raw);

        const mapped: ClientLite[] = (Array.isArray(arr) ? arr : []).map(
          (c) => ({
            id: String(c.id),
            name: String(c.name ?? "Unnamed"),
            status: c.status ?? null,
            progress:
              typeof c.progress === "number"
                ? c.progress
                : c.progress
                ? Number(c.progress)
                : null,
            startDate: c.startDate ?? null,
            dueDate: c.dueDate ?? null,
            amCeoId: c.amCeoId ?? null,
            packageId: c.packageId ?? null,
            accountManager: c.accountManager ?? null,
          })
        );

        setClients({ data: mapped, loading: false, error: null });
        const exists = mapped.some((c) => c.id === selectedClientId);
        if (!exists) setSelectedClientId("");
      } catch {
        setClients({
          data: [],
          loading: false,
          error: "Failed to load clients",
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedAmCeoId, selectedClientId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        setSummary({ data: null, loading: true, error: null });
        const url = selectedAmCeoId
          ? `/api/clients/summary?am_ceoId=${encodeURIComponent(
              selectedAmCeoId
            )}&limitUpcoming=8`
          : `/api/clients/summary?limitUpcoming=8`;
        const res = await fetch(url, { cache: "no-store" });
        const raw = await res.json();
        const data = safeParse<Summary>(raw);
        if (mounted) setSummary({ data, loading: false, error: null });
      } catch {
        if (mounted)
          setSummary({
            data: null,
            loading: false,
            error: "Failed to load summary",
          });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedAmCeoId]);

  // Enhanced chart data with unique visual treatments
  const pieData = useMemo(
    () =>
      Object.entries(summary.data?.statusCounts ?? {}).map(
        ([name, value], index) => ({
          name: name.replace(/_/g, " "),
          value,
          fill: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length],
        })
      ),
    [summary.data?.statusCounts]
  );

  const progressBuckets = summary.data?.progressBuckets ?? [];
  const startsByMonth = summary.data?.startsByMonth ?? [];

  const upcomingDueList = (summary.data?.upcomingDueList ?? []).filter(
    (c) => !selectedClientId || c.id === selectedClientId
  );

  // Enhanced progress chart with line overlay
  const enhancedProgressData = useMemo(
    () =>
      progressBuckets.map((bucket, index) => ({
        ...bucket,
        trend: Math.max(0, bucket.count - (progressBuckets[index - 1]?.count || 0)),
      })),
    [progressBuckets]
  );

  const amLabel = useMemo(() => {
    if (user?.role === "am_ceo") {
      if (user?.name && user?.email) return `${user.name}`;
      return user?.name || user?.email || "My Clients";
    }
    const cm = clients.data[0]?.accountManager;
    if (cm?.name && cm?.email) return `${cm.name}`;
    if (cm?.name || cm?.email) return cm.name || cm.email || "All AMs";
    return selectedAmCeoId ? "Selected AM CEO" : "All AM CEOs";
  }, [user, selectedAmCeoId, clients.data]);

  const selectedClientName = useMemo(() => {
    if (!selectedClientId) return "All Clients";
    return (
      clients.data.find((c) => c.id === selectedClientId)?.name ||
      "Selected Client"
    );
  }, [selectedClientId, clients.data]);

  const formatDate = (s?: string | null) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const isLoading = clients.loading || summary.loading;
  const errorMsg = clients.error || summary.error;

  return (
    <div className="space-y-6 px-4 bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
      {/* Enhanced Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            AM CEO's Dashboard
          </h1>
          <p className="text-sm text-slate-600 font-medium">
            {amLabel} • {summary.data?.totalClients ?? 0} total clients
          </p>
        </div>
        
        {/* Enhanced Client Filter */}
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500 hidden sm:block">
            Filter by client:
          </div>
          <Popover open={clientOpen} onOpenChange={setClientOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-white/90 backdrop-blur border-slate-200 shadow-sm hover:shadow transition min-w-[200px] justify-between font-medium"
                aria-label="Filter by client"
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Filter className="h-4 w-4 text-slate-500 flex-shrink-0" />
                  <span className="truncate">{selectedClientName}</span>
                </span>
                <span className="ml-2 text-slate-400 flex-shrink-0">▾</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-72" align="end">
              <Command>
                <CommandInput placeholder="Search clients..." />
                <CommandList>
                  <CommandEmpty>No clients found.</CommandEmpty>
                  <CommandGroup heading="Clients">
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setSelectedClientId("");
                        setClientOpen(false);
                      }}
                      className="font-medium"
                    >
                      All Clients
                    </CommandItem>
                    {clients.data
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setSelectedClientId(c.id);
                            setClientOpen(false);
                          }}
                        >
                          {c.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 bg-white rounded-xl shadow-sm border">
          <Loader2 className="w-5 h-5 mr-3 animate-spin text-indigo-500" />
          <span className="font-medium">Loading dashboard data...</span>
        </div>
      ) : errorMsg ? (
        <div className="flex items-center justify-center gap-3 py-16 text-rose-600 bg-white rounded-xl shadow-sm border">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{errorMsg}</span>
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
                      {summary.data?.totalClients ?? 0}
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
                      {summary.data?.activeClients ?? 0}
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
                      {summary.data?.dueIn7Days ?? 0}
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
                  {selectedClientId && (
                    <>
                      {" • "}
                      <span className="text-amber-600">
                        {clients.data.find((c) => c.id === selectedClientId)?.name || "—"}
                      </span>
                    </>
                  )}
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