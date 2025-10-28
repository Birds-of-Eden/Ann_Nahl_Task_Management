"use client";

import CountUp from "react-countup";
import { TrendingUp, Star, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Skeleton } from "./Skeleton";

const COLORS = [
  "#06b6d4",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
];

export function SalesSpotlight({
  isLoading,
  totalSales,
  growth,
  series,
  packageSales,
}: {
  isLoading: boolean;
  totalSales: number;
  growth: { delta: number; pct: number } | null;
  series: { day: string; starts: number }[];
  packageSales: {
    packageId: string;
    packageName: string | null;
    sales: number;
    sharePercent: number;
  }[];
}) {
  const topPackage = packageSales?.[0];

  return (
    <Card className="overflow-hidden border-0 shadow-xl ring-1 ring-slate-200/60 bg-gradient-to-br from-cyan-50 via-sky-50 to-white">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Left Hero Section */}
        <div className="p-10 space-y-6 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white shadow-sm ring-1 ring-cyan-200/50">
              <Sparkles className="h-5 w-5 text-cyan-600" />
            </div>
            <p className="text-sm font-semibold text-cyan-700 tracking-wide">
              Sales Performance Overview
            </p>
          </div>

          <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight">
            {isLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <CountUp end={totalSales} duration={2.2} separator="," />
            )}
          </h2>
          <p className="text-sm text-slate-600">
            Total Clients with Active Packages
          </p>

          {growth && (
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-sm ring-1 ${
                growth.delta >= 0
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              {growth.delta >= 0 ? "+" : ""}
              {growth.delta} vs prev. 30d
              <span className="opacity-70 ml-1">
                ({growth.pct >= 0 ? "+" : ""}
                {growth.pct.toFixed(1)}%)
              </span>
            </div>
          )}

          {topPackage && (
            <div className="mt-6 p-4 rounded-xl bg-white/70 backdrop-blur-sm ring-1 ring-slate-100 shadow-sm">
              <p className="text-sm font-semibold text-slate-900 mb-1">
                🏆 Top Performing Package
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-bold text-indigo-700">
                  {topPackage.packageName ?? "Unnamed Package"}
                </span>{" "}
                — {topPackage.sales} clients (
                {topPackage.sharePercent.toFixed(1)}%)
              </p>
            </div>
          )}
        </div>

        {/* Middle Chart */}
        <div className="p-8 bg-white">
          <p className="text-sm font-semibold text-slate-700 mb-4">
            30-Day Starts Trend
          </p>
          <div className="h-32">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" hide />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="starts"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Pie */}
        <div className="p-8 bg-gradient-to-br from-slate-50 to-gray-50">
          <p className="text-sm font-semibold text-slate-700 mb-4">
            Sales Share Breakdown
          </p>
          <div className="h-48">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={packageSales.map((p) => ({
                      name: p.packageName ?? p.packageId.slice(0, 6),
                      value: p.sharePercent,
                    }))}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {packageSales.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-xs text-center text-slate-600 mt-3">
            Updated dynamically from active packages
          </p>
        </div>
      </div>
    </Card>
  );
}
