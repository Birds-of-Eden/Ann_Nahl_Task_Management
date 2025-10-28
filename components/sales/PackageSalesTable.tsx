// app/am/sales/components/PackageSalesTable.tsx
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Award, Download, Percent } from "lucide-react";

type Row = {
  packageId: string;
  packageName: string | null;
  sales: number;
  sharePercent: number;
};

function fmtInt(n: number) {
  return n.toLocaleString();
}

function Medal({ rank }: { rank: number }) {
  const colors = [
    "bg-gradient-to-br from-yellow-400 to-amber-500 text-white ring-amber-300",
    "bg-gradient-to-br from-slate-300 to-zinc-400 text-white ring-zinc-300",
    "bg-gradient-to-br from-amber-600 to-orange-600 text-white ring-orange-300",
  ];
  const cls =
    rank <= 3
      ? colors[rank - 1]
      : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-slate-300";
  return (
    <div
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-1 ${cls}`}
      title={`#${rank}`}
    >
      {rank <= 3 ? <Award className="h-4 w-4" /> : rank}
    </div>
  );
}

function ShareBar({ pct }: { pct: number }) {
  const w = Math.max(3, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-40 rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-700">
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

export function PackageSalesTable({
  isLoading,
  packageSales,
  totalSales,
}: {
  isLoading: boolean;
  packageSales: Row[];
  totalSales: number;
}) {
  const [sortKey, setSortKey] = React.useState<keyof Row>("sales");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? packageSales.filter((p) =>
          (p.packageName ?? p.packageId).toLowerCase().includes(q)
        )
      : packageSales;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }, [packageSales, sortKey, sortDir, query]);

  const toggleSort = (key: keyof Row) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleExportCSV = () => {
    const header = ["Rank", "Package", "Sales", "Share (%)"];
    const lines = filtered.map((row, i) => {
      const name = row.packageName ?? `(untitled ${row.packageId.slice(0, 6)})`;
      return [
        i + 1,
        `"${name.replace(/"/g, '""')}"`,
        row.sales,
        row.sharePercent.toFixed(2),
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "package-sales.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Package Sales
          </CardTitle>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Total: {fmtInt(totalSales)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Input
              placeholder="Search package..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56 pl-3"
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-slate-50/80">
                <TableHead className="w-[72px] font-semibold text-slate-900">
                  Rank
                </TableHead>
                <TableHead className="font-semibold text-slate-900">
                  Package
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("sales")}
                  className="cursor-pointer select-none text-right font-semibold text-slate-900"
                >
                  <div className="inline-flex items-center gap-1">
                    Sales <ArrowUpDown className="h-4 w-4 opacity-60" />
                  </div>
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("sharePercent")}
                  className="cursor-pointer select-none text-right font-semibold text-slate-900"
                >
                  <div className="inline-flex items-center gap-1">
                    % Share <Percent className="h-4 w-4 opacity-60" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell>
                      <div className="h-8 w-8 rounded-full bg-slate-100" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-48 rounded bg-slate-100 mb-2" />
                      <div className="h-3 w-24 rounded bg-slate-100" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-4 w-16 rounded bg-slate-100 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-2 w-40 rounded-full bg-slate-100 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length ? (
                filtered.map((row, idx) => {
                  const rank = idx + 1;
                  const name =
                    row.packageName ??
                    `(untitled ${row.packageId.slice(0, 6)})`;
                  return (
                    <TableRow
                      key={row.packageId}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Medal rank={rank} />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{name}</span>
                          {rank <= 3 && (
                            <Badge
                              className={
                                rank === 1
                                  ? "bg-amber-100 text-amber-800"
                                  : rank === 2
                                  ? "bg-zinc-100 text-zinc-800"
                                  : "bg-orange-100 text-orange-800"
                              }
                            >
                              Top {rank}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          ID: {row.packageId.slice(0, 8)}…
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {fmtInt(row.sales)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <ShareBar pct={row.sharePercent} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
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

        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3">
            <div className="text-xs text-slate-600">
              Showing <span className="font-semibold">{filtered.length}</span>{" "}
              package{filtered.length > 1 ? "s" : ""}. Sorted by{" "}
              <span className="font-semibold">
                {sortKey === "sales" ? "Sales" : "% Share"}
              </span>{" "}
              ({sortDir}).
            </div>
            <div className="text-xs text-slate-600">
              Grand Total Sales:{" "}
              <span className="font-semibold text-slate-900">
                {fmtInt(totalSales)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
