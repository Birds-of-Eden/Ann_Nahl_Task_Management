"use client";

import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function ClientsByPackageChart({
  isLoading,
  byPackage,
}: {
  isLoading: boolean;
  byPackage: any[];
}) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-md ring-1 ring-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Clients by Package (Status Breakdown)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <Skeleton className="h-full" />
        </CardContent>
      </Card>
    );
  }

  if (!byPackage?.length) {
    return (
      <Card className="border-0 shadow-md ring-1 ring-slate-200/60">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            Clients by Package (Status Breakdown)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center">
          <EmptyState title="No package data available" />
        </CardContent>
      </Card>
    );
  }

  // Chart Setup
  const categories = byPackage.map(
    (p) => p.packageName ?? p.packageId.slice(0, 6)
  );

  const chartOptions: any = {
    chart: {
      type: "bar",
      stacked: true,
      toolbar: { show: false },
      animations: { enabled: true, easing: "easeinout", speed: 800 },
      foreColor: "#64748b",
    },
    colors: ["#06b6d4", "#22c55e", "#f97316"],
    grid: {
      borderColor: "#e2e8f0",
      strokeDashArray: 4,
    },
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: "55%",
        distributed: false,
        dataLabels: { position: "top" },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => (val ? val.toFixed(0) : ""),
      offsetY: -12,
      style: {
        fontSize: "11px",
        fontWeight: 500,
        colors: ["#475569"],
      },
    },
    xaxis: {
      categories,
      labels: { style: { fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "11px" },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      fontWeight: 500,
      markers: { radius: 4 },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: (val: number) => `${val} Clients`,
      },
      style: { fontSize: "12px" },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        shadeIntensity: 0.4,
        gradientToColors: ["#0ea5e9", "#16a34a", "#fb923c"],
        opacityFrom: 0.9,
        opacityTo: 0.5,
        stops: [0, 100],
      },
    },
    stroke: {
      show: true,
      width: 1,
      colors: ["#fff"],
    },
  };

  const chartSeries = [
    {
      name: "Total Clients",
      data: byPackage.map((p) => p.clients ?? 0),
    },
    {
      name: "Active",
      data: byPackage.map((p) => p.active ?? 0),
    },
    {
      name: "Expired",
      data: byPackage.map((p) => p.expired ?? 0),
    },
  ];

  return (
    <Card className="border-0 shadow-lg ring-1 ring-slate-200/60 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-cyan-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 backdrop-blur-md overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span>📊 Clients by Package (Status Breakdown)</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            Compare total, active, and expired clients
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ApexChart
          options={chartOptions}
          series={chartSeries}
          type="bar"
          height="100%"
        />
        <div className="text-xs text-center text-slate-500 dark:text-slate-400 mt-3 italic">
          Each bar represents a package — showing how many clients are active,
          expired, and total enrolled.
        </div>
      </CardContent>
    </Card>
  );
}
