"use client";

import { Card } from "@/components/ui/card";
import { Users, Clock, AlertTriangle, Activity, RefreshCw } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Tooltip } from "recharts";
import { Skeleton } from "./Skeleton";

export function SalesKPIGrid({
  summary,
  trendData,
  isLoading,
}: {
  summary: any;
  trendData: { label: string; value: number; color?: string }[];
  isLoading: boolean;
}) {
  const KPIs = [
    {
      label: "Active Clients",
      value: summary?.active ?? 0,
      icon: <Users className="h-5 w-5 text-emerald-600" />,
      color: "#10b981",
    },
    {
      label: "Expiring ≤30d",
      value: summary?.expiringSoon ?? 0,
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      color: "#f59e0b",
    },
    {
      label: "Expired",
      value: summary?.expired ?? 0,
      icon: <AlertTriangle className="h-5 w-5 text-rose-600" />,
      color: "#f43f5e",
    },
    {
      label: "Starting Soon",
      value: summary?.startingSoon ?? 0,
      icon: <Activity className="h-5 w-5 text-sky-600" />,
      color: "#0ea5e9",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {KPIs.map((kpi, idx) => (
        <Card
          key={idx}
          className="border-0 shadow-sm ring-1 ring-slate-200/60 hover:shadow-md transition-all duration-200 p-5 bg-gradient-to-br from-white to-slate-50"
        >
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-slate-50 ring-1 ring-slate-100">
                  {kpi.icon}
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {kpi.label}
                </p>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {kpi.value.toLocaleString()}
              </p>
              <div className="h-10 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ label: kpi.label, value: kpi.value }]}>
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar
                      dataKey="value"
                      fill={kpi.color}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
