"use client";

import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

export function RetentionGauge({
  active,
  expired,
}: {
  active: number;
  expired: number;
}) {
  const total = Math.max(0, (active ?? 0) + (expired ?? 0));
  const pct = total ? (active / total) * 100 : 0;
  const data = [{ name: "Retention", value: +pct.toFixed(2), fill: "#10b981" }];

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 p-6 bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-800">Retention Rate</p>
        <span className="text-xs text-slate-500">
          Active / (Active + Expired)
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={225}
            endAngle={-45}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              dataKey="value"
              tick={false}
            />
            <RadialBar
              minAngle={15}
              background
              dataKey="value"
              cornerRadius={8}
              clockWise
              isAnimationActive
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-2">
        <p className="text-4xl font-extrabold text-slate-900 leading-none">
          {pct.toFixed(1)}%
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Active: <span className="font-semibold">{active ?? 0}</span> •
          Expired: <span className="font-semibold">{expired ?? 0}</span>
        </p>
      </div>
    </Card>
  );
}
