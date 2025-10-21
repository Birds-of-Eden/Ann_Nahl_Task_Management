"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download, Calendar as CalendarIcon, Loader2, Users, Package, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    role?: string | null; // <-- added (optional; if API returns it, we use it)
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
// Flexible matcher: catches "data entry", "data-entry", "dataentry", "de team", "data entry operator", etc.
function looksLikeDataEntry(text?: string | null) {
  const s = norm(text);
  if (!s) return false;
  // normalize non-letters to space and also a compact version without spaces
  const compact = s.replace(/[^a-z0-9]/g, "");
  if (s.includes("data entry")) return true;
  if (s.includes("data-entry")) return true;
  if (compact.includes("dataentry")) return true;
  if (/\bde\b/.test(s)) return true; // "DE team" style (light heuristic)
  if (s.includes("entry operator")) return true;
  return false;
}

function isHiddenAgentTask(t: Task) {
  const id = t.assignedTo?.id ?? null;
  const name = t.assignedTo?.name ?? null;
  const email = t.assignedTo?.email ?? null;
  const role = t.assignedTo?.role ?? null;

  // unassigned/null id
  if (!id) return true;

  // explicit names often used
  const n = norm(name);
  if (n === "unassigned") return true;
  if (n === "data entry") return true;

  // role says it's data entry (if API supplies role)
  if (role && looksLikeDataEntry(role)) return true;

  // fuzzy by name/email
  if (looksLikeDataEntry(name)) return true;
  if (looksLikeDataEntry(email)) return true;

  return false; // visible otherwise
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

        // You can switch to /api/tasks/full if needed
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

  /** ======== Data Processing (apply visibility filter) ======== */
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

      // Count tasks
      row.total_tasks++;

      // Posting (QC Approved ⇒ Posting; else category post*)
      if (isQcApproved(t.status)) {
        row.byPkg[pkg].post++;
        row.total_post++;
      } else if (isPostingByCategory(t.category?.name)) {
        row.byPkg[pkg].post++;
        row.total_post++;
      }

      // Weekly: completed-like (completed | QC Approved) => posted that date
      if (isCompletedLike(t.status)) {
        row.byPkg[pkg].weekly++;
        row.total_weekly++;
      }

      // Sheet category
      if (isSheet(t.category?.name)) {
        row.byPkg[pkg].sheet++;
        row.total_sheets++;
      }

      // Extra counters
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
    return {
      totalTasks,
      totalPost,
      totalWeekly,
      totalSheets,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Performance Matrix</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Agent workload distribution across packages for {format(start, "MMMM yyyy")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[150px]" />
          </div>
          <Button onClick={handleExportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-lg">Loading performance data...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main */}
      {!loading && (
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Detailed View
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Summary
            </TabsTrigger>
          </TabsList>

          {/* Table View */}
          <TabsContent value="table" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Package Distribution Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="w-[200px] px-4 py-3 text-left font-semibold">Team Member</th>
                          {(["Posting", "Weekly", "Sheet"] as const).map((m) => (
                            <React.Fragment key={`head-${m}`}>
                              {packageList.map((p) => (
                                <th key={`head-${m}-${p}`} className="min-w-[100px] px-3 py-3 text-center font-semibold border-l">
                                  <div className="flex flex-col items-center">
                                    <span className="text-xs font-normal text-muted-foreground">{m}</span>
                                    <span className="text-sm">{p}</span>
                                  </div>
                                </th>
                              ))}
                            </React.Fragment>
                          ))}
                          <th className="min-w-[80px] px-3 py-3 text-center font-semibold border-l">Image Op.</th>
                          <th className="min-w-[80px] px-3 py-3 text-center font-semibold">AWS Upload</th>
                          <th className="min-w-[80px] px-3 py-3 text-center font-semibold">Sheets</th>
                          <th className="min-w-[80px] px-3 py-3 text-center font-semibold">Posts</th>
                          <th className="min-w-[80px] px-3 py-3 text-center font-semibold">Weekly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`row-${r.agent}`} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium sticky left-0 bg-background border-r">{r.agent}</td>
                            {(["Posting", "Weekly", "Sheet"] as const).map((m) => (
                              <React.Fragment key={`row-${r.agent}-${m}`}>
                                {packageList.map((p) => {
                                  const c = r.byPkg[p] || { post: 0, weekly: 0, sheet: 0 };
                                  const v = m === "Posting" ? c.post : m === "Weekly" ? c.weekly : c.sheet;
                                  return (
                                    <td key={`cell-${r.agent}-${m}-${p}`} className="px-3 py-2 text-center border-l">
                                      {v > 0 ? (
                                        <Badge variant={v > 10 ? "default" : "secondary"} className="min-w-[2rem]">
                                          {v}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                            <td className="px-3 py-2 text-center border-l">
                              <Badge variant="outline">{r.image_op}</Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="outline">{r.aws_upload}</Badge>
                            </td>
                            <td className="px-3 py-2 text-center font-medium">{r.total_sheets}</td>
                            <td className="px-3 py-2 text-center font-medium text-blue-600">{r.total_post}</td>
                            <td className="px-3 py-2 text-center font-medium text-green-600">{r.total_weekly}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-semibold">
                          <td className="px-4 py-3 border-r">Total Team Work</td>
                          {(["Posting", "Weekly", "Sheet"] as const).map((m) => (
                            <React.Fragment key={`tot-${m}`}>
                              {packageList.map((p) => {
                                const v = m === "Posting" ? pkgTotals[p].post : m === "Weekly" ? pkgTotals[p].weekly : pkgTotals[p].sheet;
                                return (
                                  <td key={`tot-${m}-${p}`} className="px-3 py-2 text-center border-l">
                                    <Badge variant="default">{v}</Badge>
                                  </td>
                                );
                              })}
                            </React.Fragment>
                          ))}
                          <td className="px-3 py-2 text-center border-l">-</td>
                          <td className="px-3 py-2 text-center">-</td>
                          <td className="px-3 py-2 text-center">{summaryStats.totalSheets}</td>
                          <td className="px-3 py-2 text-center text-blue-600">{summaryStats.totalPost}</td>
                          <td className="px-3 py-2 text-center text-green-600">{summaryStats.totalWeekly}</td>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex itemscenter gap-2">
                  <Users className="h-5 w-5" />
                  Agent Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rows.map((agent) => (
                    <Card key={agent.agent} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{agent.agent}</h3>
                        <Badge variant="secondary">{agent.total_tasks} tasks</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Posting:</span>
                          <span className="font-medium">{agent.total_post}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekly:</span>
                          <span className="font-medium">{agent.total_weekly}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sheets:</span>
                          <span className="font-medium">{agent.total_sheets}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-muted-foreground">Image OP:</span>
                          <span className="font-medium">{agent.image_op}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">AWS Upload:</span>
                          <span className="font-medium">{agent.aws_upload}</span>
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
    </div>
  );
}
