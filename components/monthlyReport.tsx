"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download, Calendar as CalendarIcon, Loader2, Users, Package, BarChart3, Filter, Table as TableIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** ========= Types ========= */
export type Task = {
  id: string;
  title: string;
  dueDate: string; // ISO
  status?: string | null;
  category?: { id: string; name: string } | null;
  client?: {
    id: string;
    packageId?: string | null;
    package?: { id?: string | null; name?: string | null } | null;
  } | null;
  assignedTo?: {
    id: string | null;
    name: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

/** ========= Helpers ========= */
function getMonthBounds(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const start = startOfMonth(new Date(y, m - 1, 1));
  const end = endOfMonth(start);
  return { start, end };
}

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function norm(s?: string | null) {
  return (s || "").toLowerCase().trim();
}

// ---- Matchers ----
function isPostingByCategory(cat?: string | null) {
  const c = norm(cat);
  if (!c) return false;
  return /\bpost(ing)?\b/.test(c);
}
function isSheet(cat?: string | null) {
  const c = norm(cat);
  if (!c) return false;
  return /\bsheet\b/.test(c);
}
function isQcApproved(status?: string | null) {
  if (!status) return false;
  const s = status.toLowerCase().replace(/[\s_-]+/g, "");
  return s === "qcapproved";
}
// Weekly = completed-like (completed OR QC Approved)
function isCompletedLike(status?: string | null) {
  const s = norm(status);
  return s === "completed" || isQcApproved(status);
}

function getPackageName(t: Task): string {
  return t.client?.package?.name || "Unknown Package";
}

/** ========= Hide Unassigned & Data Entry ========= */
function looksLikeDataEntry(text?: string | null) {
  const s = norm(text);
  if (!s) return false;
  const compact = s.replace(/[^a-z0-9]/g, "");
  if (s.includes("data entry")) return true;
  if (s.includes("data-entry")) return true;
  if (compact.includes("dataentry")) return true;
  if (/\bde\b/.test(s)) return true;
  if (s.includes("entry operator")) return true;
  return false;
}

function isHiddenAgentTask(t: Task) {
  const id = t.assignedTo?.id ?? null;
  const name = t.assignedTo?.name ?? null;
  const email = t.assignedTo?.email ?? null;
  const role = t.assignedTo?.role ?? null;

  if (!id) return true;

  const n = norm(name);
  if (n === "unassigned") return true;
  if (n === "data entry") return true;

  if (role && looksLikeDataEntry(role)) return true;
  if (looksLikeDataEntry(name)) return true;
  if (looksLikeDataEntry(email)) return true;

  return false;
}

/** ========= Component ========= */
export default function MonthlyAgentPackageMatrix({
  defaultMonth,
}: {
  defaultMonth?: string;
}) {
  const initMonth = useMemo(() => {
    const now = new Date();
    return (
      defaultMonth ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  }, [defaultMonth]);

  const [month, setMonth] = useState(initMonth);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<"table" | "summary">("table");

  const { start, end } = useMemo(() => getMonthBounds(month), [month]);

  // ===== Fetch data =====
  useEffect(() => {
    let ignore = false;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("startDate", start.toISOString());
        params.set("endDate", end.toISOString());

        const res = await fetch(`/api/tasks/monthlyReport?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const data: Task[] = Array.isArray(payload) ? payload : payload?.data ?? [];
        if (!ignore) setTasks(data);
      } catch (e) {
        if (!ignore) setTasks([]);
        console.error("Failed to fetch monthly tasks:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [start, end]);

  /** ======== Data Processing ======== */
  const visibleTasks = useMemo(() => tasks.filter(t => !isHiddenAgentTask(t)), [tasks]);

  const packageList = useMemo(() => {
    const set = new Set<string>();
    for (const t of visibleTasks) set.add(getPackageName(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [visibleTasks]);

  const agentList = useMemo(() => {
    const set = new Set<string>();
    for (const t of visibleTasks) set.add(t.assignedTo!.name || "Unknown");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [visibleTasks]);

  type Cell = { post: number; weekly: number; sheet: number };
  type AgentRow = {
    agent: string;
    byPkg: Record<string, Cell>;
    image_op: number;
    aws_upload: number;
    total_sheets: number;
    total_post: number;
    total_weekly: number;
    total_tasks: number;
  };

  const rows: AgentRow[] = useMemo(() => {
    const map = new Map<string, AgentRow>();
    const ensure = (agent: string) => {
      if (!map.has(agent)) {
        const byPkg: Record<string, Cell> = {};
        for (const p of packageList) byPkg[p] = { post: 0, weekly: 0, sheet: 0 };
        map.set(agent, {
          agent,
          byPkg,
          image_op: 0,
          aws_upload: 0,
          total_sheets: 0,
          total_post: 0,
          total_weekly: 0,
          total_tasks: 0,
        });
      }
      return map.get(agent)!;
    };

    for (const t of visibleTasks) {
      const agent = t.assignedTo!.name || "Unknown";
      const pkg = getPackageName(t);
      const row = ensure(agent);
      if (!row.byPkg[pkg]) row.byPkg[pkg] = { post: 0, weekly: 0, sheet: 0 };

      row.total_tasks++;

      if (isQcApproved(t.status)) {
        row.byPkg[pkg].post++;
        row.total_post++;
      } else if (isPostingByCategory(t.category?.name)) {
        row.byPkg[pkg].post++;
        row.total_post++;
      }

      if (isCompletedLike(t.status)) {
        row.byPkg[pkg].weekly++;
        row.total_weekly++;
      }

      if (isSheet(t.category?.name)) {
        row.byPkg[pkg].sheet++;
        row.total_sheets++;
      }

      const c = norm(t.category?.name);
      if (c.includes("image op") || c.includes("image optimization") || c.includes("image optimized") || c.includes("img opt"))
        row.image_op++;
      if (c.includes("aws upload") || c.includes("awb upload") || c.includes("s3 upload"))
        row.aws_upload++;
    }

    return Array.from(map.values()).sort((a, b) => a.agent.localeCompare(b.agent));
  }, [visibleTasks, packageList]);

  // Totals per package across agents
  const pkgTotals = useMemo(() => {
    const totals: Record<string, Cell> = {};
    for (const p of packageList) totals[p] = { post: 0, weekly: 0, sheet: 0 };
    for (const r of rows) {
      for (const p of packageList) {
        const c = r.byPkg[p] || { post: 0, weekly: 0, sheet: 0 };
        totals[p].post += c.post;
        totals[p].weekly += c.weekly;
        totals[p].sheet += c.sheet;
      }
    }
    return totals;
  }, [rows, packageList]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalTasks = rows.reduce((sum, row) => sum + row.total_tasks, 0);
    const totalPost = rows.reduce((sum, row) => sum + row.total_post, 0);
    const totalWeekly = rows.reduce((sum, row) => sum + row.total_weekly, 0);
    const totalSheets = rows.reduce((sum, row) => sum + row.total_sheets, 0);
    const totalImageOp = rows.reduce((sum, row) => sum + row.image_op, 0);
    const totalAwsUpload = rows.reduce((sum, row) => sum + row.aws_upload, 0);
    return {
      totalTasks,
      totalPost,
      totalWeekly,
      totalSheets,
      totalImageOp,
      totalAwsUpload,
      totalAgents: rows.length,
      totalPackages: packageList.length,
    };
  }, [rows, packageList]);

  const metrics = ["Posting", "Weekly", "Sheet"] as const;

  function handleExportCsv() {
    const header: string[] = ["Name"];
    for (const m of metrics) for (const p of packageList) header.push(`${p} - ${m}`);
    header.push("Image Op.", "AWS Upload", "Total Sheets", "Total Post", "Total Weekly");

    const lines: (string | number)[][] = [header];
    for (const r of rows) {
      const line: (string | number)[] = [r.agent];
      for (const m of metrics) {
        for (const p of packageList) {
          const c = r.byPkg[p] || { post: 0, weekly: 0, sheet: 0 };
          line.push(m === "Posting" ? c.post : m === "Weekly" ? c.weekly : c.sheet);
        }
      }
      line.push(r.image_op, r.aws_upload, r.total_sheets, r.total_post, r.total_weekly);
      lines.push(line);
    }

    const tline: (string | number)[] = ["Total"];
    for (const m of metrics)
      for (const p of packageList)
        tline.push(m === "Posting" ? pkgTotals[p].post : m === "Weekly" ? pkgTotals[p].weekly : pkgTotals[p].sheet);
    tline.push(
      "",
      "",
      rows.reduce((a, r) => a + r.total_sheets, 0),
      rows.reduce((a, r) => a + r.total_post, 0),
      rows.reduce((a, r) => a + r.total_weekly, 0)
    );
    lines.push(tline);

    const csv = toCsv(lines);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-package-matrix-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Color variants for badges based on values
  const getBadgeVariant = (value: number, type?: "post" | "weekly" | "sheet") => {
    if (value === 0) return "outline" as const;
    if (value <= 5) return "secondary" as const;
    if (value <= 15) return "default" as const;
    return "destructive" as const;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Performance Matrix
                </h1>
                <p className="text-slate-600 flex items-center gap-2 mt-1">
                  Agent workload distribution across packages for 
                  <span className="font-semibold text-blue-600">
                    {format(start, "MMMM yyyy")}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
              <CalendarIcon className="h-4 w-4 text-slate-500" />
              <Input 
                type="month" 
                value={month} 
                onChange={(e) => setMonth(e.target.value)} 
                className="w-[150px] border-0 shadow-none focus-visible:ring-0 p-0"
              />
            </div>
            <Button 
              onClick={handleExportCsv} 
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all duration-200"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Agents</p>
                    <p className="text-2xl font-bold text-slate-900">{summaryStats.totalAgents}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Tasks</p>
                    <p className="text-2xl font-bold text-slate-900">{summaryStats.totalTasks}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Posts Completed</p>
                    <p className="text-2xl font-bold text-slate-900">{summaryStats.totalPost}</p>
                  </div>
                  <Package className="h-8 w-8 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Weekly Target</p>
                    <p className="text-2xl font-bold text-slate-900">{summaryStats.totalWeekly}</p>
                  </div>
                  <Filter className="h-8 w-8 text-orange-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex items-center gap-4 text-slate-600">
                <Loader2 className="h-8 w-8 animate-spin" />
                <div>
                  <p className="text-lg font-medium">Loading performance data</p>
                  <p className="text-sm text-slate-500">Fetching and processing team metrics...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!loading && (
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-6">
            <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200 p-1 rounded-lg shadow-sm">
              <TabsTrigger 
                value="table" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
              >
                <BarChart3 className="h-4 w-4" />
                Detailed Matrix
              </TabsTrigger>
              <TabsTrigger 
                value="summary" 
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200"
              >
                <Users className="h-4 w-4" />
                Agent Summary
              </TabsTrigger>
            </TabsList>

            {/* Table View */}
            <TabsContent value="table" className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b">
                  <CardTitle className="flex items-center gap-3 text-slate-800">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    Package Distribution Matrix
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Detailed breakdown of agent performance across all packages
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                            <th className="w-[200px] px-6 py-4 text-left font-semibold text-slate-700 sticky left-0 bg-slate-100 z-10">
                              Team Member
                            </th>
                            {( ["Posting", "Weekly", "Sheet"] as const).map((m) => (
                              <React.Fragment key={`head-${m}`}>
                                {packageList.map((p) => (
                                  <th 
                                    key={`head-${m}-${p}`} 
                                    className="min-w-[120px] px-4 py-4 text-center font-semibold text-slate-700 border-l border-slate-200"
                                  >
                                    <div className="flex flex-col items-center space-y-1">
                                      <span className="text-xs font-normal text-slate-500 uppercase tracking-wide">{m}</span>
                                      <span className="text-sm font-medium">{p}</span>
                                    </div>
                                  </th>
                                ))}
                              </React.Fragment>
                            ))}
                            <th className="min-w-[100px] px-4 py-4 text-center font-semibold text-slate-700 border-l border-slate-200 bg-slate-50">
                              Image Op.
                            </th>
                            <th className="min-w-[100px] px-4 py-4 text-center font-semibold text-slate-700 bg-slate-50">
                              AWS Upload
                            </th>
                            <th className="min-w-[90px] px-4 py-4 text-center font-semibold text-slate-700 bg-blue-50 border-l border-blue-100">
                              Sheets
                            </th>
                            <th className="min-w-[90px] px-4 py-4 text-center font-semibold text-slate-700 bg-green-50">
                              Posts
                            </th>
                            <th className="min-w-[90px] px-4 py-4 text-center font-semibold text-slate-700 bg-purple-50 border-l border-purple-100">
                              Weekly
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr 
                              key={`row-${r.agent}`} 
                              className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors duration-150"
                            >
                              <td className="px-6 py-3 font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10">
                                {r.agent}
                              </td>
                              {( ["Posting", "Weekly", "Sheet"] as const).map((m) => (
                                <React.Fragment key={`row-${r.agent}-${m}`}>
                                  {packageList.map((p) => {
                                    const c = r.byPkg[p] || { post: 0, weekly: 0, sheet: 0 };
                                    const v = m === "Posting" ? c.post : m === "Weekly" ? c.weekly : c.sheet;
                                    return (
                                      <td 
                                        key={`cell-${r.agent}-${m}-${p}`} 
                                        className="px-4 py-3 text-center border-l border-slate-100"
                                      >
                                        {v > 0 ? (
                                          <Badge 
                                            variant={getBadgeVariant(v, m.toLowerCase() as any)}
                                            className="min-w-[2.5rem] font-medium shadow-sm transition-all duration-200"
                                          >
                                            {v}
                                          </Badge>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                              <td className="px-4 py-3 text-center border-l border-slate-100 bg-slate-50/50">
                                <Badge variant="outline" className="font-medium bg-white">
                                  {r.image_op}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center bg-slate-50/50">
                                <Badge variant="outline" className="font-medium bg-white">
                                  {r.aws_upload}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-blue-700 bg-blue-50/50">
                                {r.total_sheets}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-green-700 bg-green-50/50">
                                {r.total_post}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-purple-700 bg-purple-50/50 border-l border-purple-100">
                                {r.total_weekly}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-50 font-semibold border-t border-slate-200">
                            <td className="px-6 py-4 text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">
                              Team Totals
                            </td>
                            {( ["Posting", "Weekly", "Sheet"] as const).map((m) => (
                              <React.Fragment key={`tot-${m}`}>
                                {packageList.map((p) => {
                                  const v = m === "Posting" ? pkgTotals[p].post : m === "Weekly" ? pkgTotals[p].weekly : pkgTotals[p].sheet;
                                  return (
                                    <td key={`tot-${m}-${p}`} className="px-4 py-3 text-center border-l border-slate-200">
                                      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                        {v}
                                      </Badge>
                                    </td>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                            <td className="px-4 py-3 text-center border-l border-slate-200">-</td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center text-blue-700 bg-blue-100">
                              {summaryStats.totalSheets}
                            </td>
                            <td className="px-4 py-3 text-center text-green-700 bg-green-100">
                              {summaryStats.totalPost}
                            </td>
                            <td className="px-4 py-3 text-center text-purple-700 bg-purple-100 border-l border-purple-200">
                              {summaryStats.totalWeekly}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Summary View */}
            <TabsContent value="summary">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm">
                <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-green-50/50 border-b">
                  <CardTitle className="flex items-center gap-3 text-slate-800">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    Agent Performance Summary
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Individual agent performance metrics and accomplishments
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {rows.map((agent) => (
                      <Card 
                        key={agent.agent} 
                        className="p-5 bg-white border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-slate-800 text-lg">{agent.agent}</h3>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                            {agent.total_tasks} tasks
                          </Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Posting Completed:</span>
                            <span className="font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                              {agent.total_post}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Weekly Target:</span>
                            <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {agent.total_weekly}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Sheets Processed:</span>
                            <span className="font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                              {agent.total_sheets}
                            </span>
                          </div>
                          <div className="pt-3 space-y-2 bg-slate-50 rounded-lg p-3 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-xs">Image Optimization:</span>
                              <span className="font-medium text-slate-700">{agent.image_op}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-xs">AWS Upload:</span>
                              <span className="font-medium text-slate-700">{agent.aws_upload}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* ===== NEW: Grand Totals Table (all metrics in one place) ===== */}
        {!loading && (
          <Card className="bg-white/90 backdrop-blur-sm border-slate-200 shadow-sm">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-amber-50/60 border-b">
              <CardTitle className="flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TableIcon className="h-5 w-5 text-amber-700" />
                </div>
                Monthly Totals
              </CardTitle>
              <CardDescription className="text-slate-600">
                All key totals for {format(start, "MMMM yyyy")} consolidated in one table
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 gap-0">
                {/* Left: Overall Totals */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <List className="h-4 w-4" /> Overall
                  </h3>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Total Posts</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalPost}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Total Weekly</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalWeekly}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Total Sheets</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalSheets}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Image Optimization</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalImageOp}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">AWS Upload</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalAwsUpload}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Total Tasks</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalTasks}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 text-slate-600">Total Agents</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalAgents}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-slate-600">Total Packages</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 text-right">{summaryStats.totalPackages}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Totals by Package */}
                <div className="p-6 border-t md:border-t-0 md:border-l border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Totals by Package
                  </h3>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Package</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">Posting</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">Weekly</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">Sheet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packageList.map((p) => (
                          <tr key={`pkg-row-${p}`} className="border-t">
                            <td className="px-4 py-3 font-medium text-slate-900">{p}</td>
                            <td className="px-4 py-3 text-right">{pkgTotals[p].post}</td>
                            <td className="px-4 py-3 text-right">{pkgTotals[p].weekly}</td>
                            <td className="px-4 py-3 text-right">{pkgTotals[p].sheet}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-4 py-3">Grand Total</td>
                          <td className="px-4 py-3 text-right">{Object.values(pkgTotals).reduce((a, c) => a + c.post, 0)}</td>
                          <td className="px-4 py-3 text-right">{Object.values(pkgTotals).reduce((a, c) => a + c.weekly, 0)}</td>
                          <td className="px-4 py-3 text-right">{Object.values(pkgTotals).reduce((a, c) => a + c.sheet, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
