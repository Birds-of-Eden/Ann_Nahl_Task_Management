"use client";

import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { CalendarClock } from "lucide-react";
import { Skeleton } from "./Skeleton";

export function RenewalForecast({
  forecastData,
  isLoading,
}: {
  forecastData: { day: string; expiring: number }[];
  isLoading: boolean;
}) {
  return (
    <Card className="mt-6 border-0 shadow-sm ring-1 ring-slate-200/60 p-6 bg-gradient-to-br from-slate-50 to-white">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="h-5 w-5 text-amber-500" />
        <p className="text-sm font-semibold text-slate-800">
          Renewal Forecast (Next 30 Days)
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : forecastData?.length ? (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="renewal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                fontSize={10}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "#e2e8f0",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="expiring"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fill="url(#renewal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No upcoming expirations found.</p>
      )}
    </Card>
  );
}
