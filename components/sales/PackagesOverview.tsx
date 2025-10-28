"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp, Package, Calendar, Users } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export function PackagesOverview({
  byPackage,
  timeseries,
  isLoading,
}: {
  byPackage: any[];
  timeseries: any[];
  isLoading: boolean;
}) {
  const totalPackages = byPackage?.length ?? 0;
  const totalClients = byPackage?.reduce((s, p) => s + (p.clients ?? 0), 0);
  const top = byPackage?.[0];

  return (
    <Card className="relative overflow-hidden border-0 shadow-md ring-1 ring-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-cyan-50">
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-100 via-transparent to-transparent" />

      <CardHeader className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-cyan-600" />
          <CardTitle className="text-lg font-semibold text-slate-900">
            Packages Overview
          </CardTitle>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-emerald-500" />
            <span>{totalClients} Clients</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-sky-500" />
            <span>{totalPackages} Packages</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 space-y-8">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            {/* Highlight Card */}
            {top && (
              <div className="relative rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm p-6 hover:shadow-md transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      Top Performing Package
                    </h3>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {top.packageName ?? "Unnamed Package"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {top.clients} Clients • Avg Days Left:{" "}
                      <span className="font-medium text-slate-700">
                        {top.avgDaysLeft ?? 0}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 bg-gradient-to-r from-cyan-50 to-emerald-50 px-4 py-2 rounded-lg ring-1 ring-slate-200">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>
                      Active: <b>{top.active}</b> / Expired: {top.expired}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Timeseries Chart */}
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-800">
                  Package Start Trend (Last 90 Days)
                </p>
                <span className="text-xs text-slate-500">
                  Daily new package starts
                </span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries}>
                    <defs>
                      <linearGradient id="pkgTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#06b6d4"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#06b6d4"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickMargin={8}
                      tick={{ fill: "#64748b" }}
                    />
                    <Tooltip
                      cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#e2e8f0",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "#475569", fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="starts"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={false}
                      fill="url(#pkgTrend)"
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Table */}
            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Package</th>
                    <th className="px-4 py-3 text-right">Clients</th>
                    <th className="px-4 py-3 text-right">Active</th>
                    <th className="px-4 py-3 text-right">Expired</th>
                    <th className="px-4 py-3 text-right">Avg Days Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/70">
                  {byPackage.slice(0, 6).map((p, i) => (
                    <tr
                      key={p.packageId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {p.packageName ?? "(Unnamed)"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {p.clients}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {p.active}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600">
                        {p.expired}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {p.avgDaysLeft ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-slate-50/60 text-xs text-slate-500 px-4 py-2 text-right">
                Showing top {Math.min(6, byPackage.length)} of{" "}
                {byPackage.length} packages
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
