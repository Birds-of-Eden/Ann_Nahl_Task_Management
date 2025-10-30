"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function RetentionGauge({
  active,
  expired,
}: {
  active: number;
  expired: number;
}) {
  const total = Math.max(0, (active ?? 0) + (expired ?? 0));
  const pct = total ? (active / total) * 100 : 0;

  const chartOptions: any = {
    chart: {
      type: "radialBar",
      sparkline: { enabled: true },
      offsetY: -10,
      animations: { enabled: true, easing: "easeinout", speed: 900 },
    },
    colors: ["#10b981"],
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          size: "65%",
          background: "transparent",
        },
        track: {
          background: "#e2e8f0",
          strokeWidth: "90%",
          margin: 8,
        },
        dataLabels: {
          show: true,
          name: {
            offsetY: 25,
            color: "#64748b",
            fontSize: "13px",
            fontWeight: 500,
          },
          value: {
            fontSize: "32px",
            fontWeight: 800,
            color: "#0f172a",
            offsetY: -10,
            formatter: () => `${pct.toFixed(1)}%`,
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "horizontal",
        shadeIntensity: 0.4,
        gradientToColors: ["#06b6d4"],
        opacityFrom: 0.9,
        opacityTo: 0.5,
        stops: [0, 100],
      },
    },
    stroke: { lineCap: "round" },
    labels: ["Retention"],
  };

  const chartSeries = [Number(pct.toFixed(1))];

  return (
    <Card
      className={cn(
        "border-0 shadow-lg ring-1 ring-slate-200/70 rounded-3xl p-6",
        "bg-gradient-to-br from-white via-slate-50 to-emerald-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 backdrop-blur-md"
      )}
    >
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Retention Gauge
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Active Clients vs Expired Clients
        </p>
      </div>

      <div className="relative flex justify-center items-center h-56">
        <ApexChart
          options={chartOptions}
          series={chartSeries}
          type="radialBar"
          height="100%"
          width="100%"
        />
        {/* Glowing center effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-32 w-32 bg-emerald-100/40 dark:bg-emerald-500/20 blur-3xl rounded-full" />
        </div>
      </div>

      <div className="text-center mt-4 space-y-1">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Active:{" "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {active ?? 0}
          </span>{" "}
          • Expired:{" "}
          <span className="font-semibold text-rose-700 dark:text-rose-400">
            {expired ?? 0}
          </span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Higher retention means stronger long-term client loyalty.
        </p>
      </div>
    </Card>
  );
}
