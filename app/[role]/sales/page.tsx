// app/[role]/sales/page.tsx

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
import { TrendingUp, Users, Clock, AlertTriangle } from "lucide-react";
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
} from "recharts";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Overview = {
  summary: {
    totalWithPackage: number;
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
  recent: any[]; // not used directly here, but available if you want a "Recent" table
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

export default function AMCEOSalesPage() {
  const { data } = useSWR<Overview>("/api/am/sales/overview", fetcher);

  const [selectedPkg, setSelectedPkg] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  const summary = data?.summary;
  const series = data?.timeseries ?? [];
  const byPackage = data?.byPackage ?? [];
  const grouped = data?.groupedClients ?? [];

  const totalClients = summary?.totalWithPackage ?? 0;

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">AM CEO — Package Sales</h1>
        <Badge className="rounded-full">Live</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <KPI
          title="Clients w/ Package"
          value={summary?.totalWithPackage ?? 0}
          icon={<Users className="h-5 w-5" />}
        />
        <KPI
          title="Active"
          value={summary?.active ?? 0}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <KPI
          title="Expired"
          value={summary?.expired ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KPI
          title="Starting (≤14d)"
          value={summary?.startingSoon ?? 0}
          icon={<Clock className="h-5 w-5" />}
        />
        <KPI
          title="Expiring (≤30d)"
          value={summary?.expiringSoon ?? 0}
          icon={<Clock className="h-5 w-5" />}
        />
        <KPI
          title="Missing Dates"
          value={summary?.missingDates ?? 0}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle>New Package Starts (Last 90 days)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="starts"
                stroke="#0ea5e9"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Package chart */}
      <Card>
        <CardHeader>
          <CardTitle>Clients by Package</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPackage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="packageName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="clients" fill="#22c55e" name="Clients" />
              <Bar dataKey="active" fill="#0ea5e9" name="Active" />
              <Bar dataKey="expired" fill="#f97316" name="Expired" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Package filter + Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
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
              placeholder="Search client name, company, or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-sm text-muted-foreground">
            Showing <span className="font-medium">{currentClients.length}</span>{" "}
            client(s) for <span className="font-medium">{selectedLabel}</span>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name ?? "-"}
                    </TableCell>
                    <TableCell>{c.company ?? "-"}</TableCell>
                    <TableCell className="text-xs">{c.email ?? "-"}</TableCell>
                    <TableCell>
                      {c.startDate ? fmtDate(c.startDate) : "-"}
                    </TableCell>
                    <TableCell>
                      {c.dueDate ? fmtDate(c.dueDate) : "-"}
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
                      className="text-center text-sm text-muted-foreground"
                    >
                      No clients found
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

function KPI({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
        <div className="p-2 rounded-lg bg-slate-100">{icon}</div>
      </CardContent>
    </Card>
  );
}

function StatusPill({
  status,
}: {
  status: "active" | "expired" | "upcoming" | "unknown";
}) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    expired: "bg-rose-100 text-rose-700",
    upcoming: "bg-amber-100 text-amber-800",
    unknown: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full border ${
        map[status] || map.unknown
      }`}
    >
      {status}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString();
}
