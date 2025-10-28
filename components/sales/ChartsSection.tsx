// app/am/sales/components/ChartsSection.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";
import { Sparkles, Activity, TrendingUp } from "lucide-react";

const COLORS = {
  cyan: "#06b6d4",
  indigo: "#6366f1",
  emerald: "#10b981",
  zinc: "#a1a1aa",
};

type Series = { day: string; starts: number };
type MA = { day: string; starts: number; ma: number };
type Cum = { day: string; cumulative: number };

export function ChartsSection({
  isLoading,
  series,
  ma7,
  cumStarts,
}: {
  isLoading: boolean;
  series: Series[];
  ma7: MA[];
  cumStarts: Cum[];
}) {
  // enhance: day labels minimal (last 8 ticks)
  const data30 = series.slice(-30);
  const grid = (
    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#eef2f7" />
  );
  const tooltip = (
    <Tooltip
      cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }}
      contentStyle={{
        borderRadius: 12,
        borderColor: "#e2e8f0",
        boxShadow: "0 6px 22px rgba(0,0,0,0.08)",
        fontSize: 12,
      }}
      labelStyle={{ color: "#475569", fontWeight: 600 }}
    />
  );

  // tiny derived stats for headers
  const last7 = series.slice(-7).reduce((a, b) => a + (b?.starts ?? 0), 0);
  const prev7 = series.slice(-14, -7).reduce((a, b) => a + (b?.starts ?? 0), 0);
  const delta7 = last7 - prev7;
  const pct7 = prev7 ? (delta7 / prev7) * 100 : last7 ? 100 : 0;

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-600" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Trends & Insights
            </CardTitle>
          </div>
          <div
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full ring-1 shadow-sm",
              delta7 >= 0
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-rose-200"
            )}
            title="Last 7 days vs previous 7 days"
          >
            <TrendingUp className="h-3.5 w-3.5 inline mr-1" />
            {delta7 >= 0 ? "+" : ""}
            {delta7} ({pct7 >= 0 ? "+" : ""}
            {pct7.toFixed(1)}%)
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : (
          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="mb-4 bg-slate-50/70">
              <TabsTrigger value="daily">Daily Starts</TabsTrigger>
              <TabsTrigger value="avg">Daily vs 7-day Avg</TabsTrigger>
              <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
            </TabsList>

            {/* Daily Starts (Area) */}
            <TabsContent value="daily">
              <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Daily Starts (Last 90 days)
                    </p>
                    <span className="text-xs text-slate-500">
                      <Activity className="h-3.5 w-3.5 inline mr-1" />
                      Smoothed gradient area
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient
                          id="startsFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={COLORS.cyan}
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor={COLORS.cyan}
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                        <filter
                          id="glow"
                          x="-50%"
                          y="-50%"
                          width="200%"
                          height="200%"
                        >
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {grid}
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                      />
                      {tooltip}
                      <Area
                        type="monotone"
                        dataKey="starts"
                        stroke={COLORS.cyan}
                        fill="url(#startsFill)"
                        strokeWidth={3}
                        dot={false}
                        filter="url(#glow)"
                      />
                      <ReferenceLine y={0} stroke="#e2e8f0" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Daily vs 7-day Avg (Composed) */}
            <TabsContent value="avg">
              <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
                <CardHeader className="pb-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Daily vs 7-day Moving Average (Last 90 days)
                  </p>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ma7}>
                      {grid}
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                      />
                      {tooltip}
                      <Bar
                        dataKey="starts"
                        name="Daily"
                        fill={COLORS.zinc}
                        radius={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="ma"
                        name="7-day Avg"
                        stroke={COLORS.indigo}
                        strokeWidth={3}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cumulative (Line) */}
            <TabsContent value="cumulative">
              <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Cumulative Starts (90-day trajectory)
                    </p>
                    <span className="text-[11px] text-slate-500">
                      Trend line with subtle glow
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumStarts}>
                      <defs>
                        <filter
                          id="glow2"
                          x="-50%"
                          y="-50%"
                          width="200%"
                          height="200%"
                        >
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {grid}
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tick={{ fill: "#64748b" }}
                      />
                      {tooltip}
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke={COLORS.emerald}
                        strokeWidth={3}
                        dot={false}
                        filter="url(#glow2)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
