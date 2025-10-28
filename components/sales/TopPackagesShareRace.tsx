"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";

type Row = { name: string; share: number };

export function TopPackagesShareRace({
  packageSales,
}: {
  packageSales: {
    packageId: string;
    packageName: string | null;
    sharePercent: number;
    sales: number;
  }[];
}) {
  const base = packageSales
    .slice()
    .sort((a, b) => b.sharePercent - a.sharePercent)
    .slice(0, 6)
    .map((p) => ({
      name: p.packageName ?? p.packageId.slice(0, 6),
      share: p.sharePercent,
    }));

  const [progress, setProgress] = React.useState(0); // 0..1
  const [running, setRunning] = React.useState(true);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setProgress((v) => {
        const nv = v + 0.03;
        return nv >= 1 ? 1 : nv;
      });
    }, 40);
    return () => clearInterval(t);
  }, [running]);

  const display: Row[] = base.map((r) => ({
    name: r.name,
    share: +(r.share * progress).toFixed(2),
  }));

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 p-6 bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-800">
          Top Packages — Share Race
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRunning((r) => !r)}
            className="h-8"
          >
            {running ? (
              <Pause className="h-4 w-4 mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            {running ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setProgress(0);
              setRunning(true);
            }}
            className="h-8"
          >
            Replay
          </Button>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={display.sort((a, b) => a.share - b.share)}
            margin={{ left: 80, right: 20, top: 10, bottom: 10 }}
          >
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#334155", fontSize: 12 }}
            />
            <Tooltip
              formatter={(v: any) => `${(v as number).toFixed(1)}%`}
              contentStyle={{
                borderRadius: 12,
                borderColor: "#e2e8f0",
                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                fontSize: "12px",
              }}
            />
            <Bar
              dataKey="share"
              isAnimationActive={false}
              radius={[4, 4, 4, 4]}
              fill="#06b6d4"
            >
              <LabelList
                dataKey="share"
                position="right"
                formatter={(v: any) => `${(v as number).toFixed(1)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-right text-[11px] text-slate-500 mt-2">
        Animated race — impact-friendly visualization for stakeholders.
      </div>
    </Card>
  );
}
