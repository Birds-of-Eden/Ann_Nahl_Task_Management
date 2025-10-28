"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Tooltip as UITooltip } from "@/components/ui/tooltip"; // optional if you have one
import { ResponsiveContainer, Treemap, Tooltip as ReTooltip } from "recharts";

type Pkg = {
  packageId: string;
  packageName: string | null;
  clients: number;
  avgDaysLeft: number | null;
  active?: number;
  expired?: number;
};

type Node = {
  name: string;
  size: number;
  fill: string;
  label: string;
  clients: number;
  avgDaysLeft: number;
  active?: number;
  expired?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Color scale: 0 (low) -> 60+ (high)
 * Red (#ef4444) → Yellow (#f59e0b) → Green (#10b981)
 */
function colorForDays(avgOrNull: number | null) {
  const v = clamp(avgOrNull ?? 0, 0, 60); // cap at 60
  const t = v / 60; // 0..1

  // 2-stop interpolation via yellow mid-point for better perception
  const red = { r: 239, g: 68, b: 68 }; // #ef4444
  const yel = { r: 245, g: 158, b: 11 }; // #f59e0b
  const grn = { r: 16, g: 185, b: 129 }; // #10b981

  // blend red->yellow for first half, yellow->green for second half
  const mid = 0.5;
  let r, g, b;
  if (t <= mid) {
    const u = t / mid;
    r = Math.round(red.r + (yel.r - red.r) * u);
    g = Math.round(red.g + (yel.g - red.g) * u);
    b = Math.round(red.b + (yel.b - red.b) * u);
  } else {
    const u = (t - mid) / (1 - mid);
    r = Math.round(yel.r + (grn.r - yel.r) * u);
    g = Math.round(yel.g + (grn.g - yel.g) * u);
    b = Math.round(yel.b + (grn.b - yel.b) * u);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export function PackageHealthTreemap({
  byPackage,
  height = 320,
  title = "Package Health (Treemap)",
}: {
  byPackage: Pkg[];
  height?: number;
  title?: string;
}) {
  const nodes: Node[] = React.useMemo(
    () =>
      (byPackage ?? []).map((p) => ({
        name: p.packageName ?? p.packageId.slice(0, 6),
        size: Math.max(1, p.clients ?? 0), // ensure visible
        fill: colorForDays(p.avgDaysLeft ?? 0),
        label: p.packageName ?? p.packageId.slice(0, 6),
        clients: p.clients ?? 0,
        avgDaysLeft: p.avgDaysLeft ?? 0,
        active: p.active ?? undefined,
        expired: p.expired ?? undefined,
      })),
    [byPackage]
  );

  const totalClients = nodes.reduce((s, n) => s + (n.clients || 0), 0);

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 p-6 bg-gradient-to-br from-white via-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Size = Clients • Color = Avg Days Left (0 → 60+)
          </p>
        </div>
        <div className="text-xs text-slate-600">
          Total Clients:{" "}
          <span className="font-semibold text-slate-900">
            {totalClients.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Treemap */}
      <div
        className="rounded-xl overflow-hidden border border-slate-200 bg-white/80 backdrop-blur-sm"
        style={{ height }}
      >
        {nodes.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={nodes}
              dataKey="size"
              stroke="#fff"
              content={(props: any) => {
                const {
                  x,
                  y,
                  width,
                  height,
                  fill,
                  label,
                  clients,
                  avgDaysLeft,
                } = props;
                const W = width as number;
                const H = height as number;

                // Very tiny tiles: render color only
                if (W < 70 || H < 50) {
                  return (
                    <g>
                      <rect
                        x={x}
                        y={y}
                        width={W}
                        height={H}
                        fill={fill}
                        stroke="#fff"
                        rx={6}
                      />
                    </g>
                  );
                }

                return (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={W}
                      height={H}
                      fill={fill}
                      stroke="#fff"
                      rx={8}
                    />
                    <text
                      x={x + 10}
                      y={y + 22}
                      fill="#0f172a"
                      fontSize={12}
                      fontWeight={700}
                    >
                      {label}
                    </text>
                    <text x={x + 10} y={y + 40} fill="#334155" fontSize={11}>
                      Clients: {clients}
                    </text>
                    <text x={x + 10} y={y + 56} fill="#334155" fontSize={11}>
                      Avg Days Left: {avgDaysLeft}
                    </text>
                  </g>
                );
              }}
            >
              <ReTooltip
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "#e2e8f0",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                formatter={(_, __, p: any) => {
                  const n: Node | undefined = p?.payload;
                  if (!n) return ["", ""];
                  return [
                    `Clients: ${n.clients} | Avg Days Left: ${n.avgDaysLeft}${
                      typeof n.active === "number" ||
                      typeof n.expired === "number"
                        ? ` | Active: ${n.active ?? 0} | Expired: ${
                            n.expired ?? 0
                          }`
                        : ""
                    }`,
                    n.label,
                  ];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No package data
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
          <span>0 days</span>
          <span>~30 days</span>
          <span>60+ days</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#10b981]" />
        <div className="mt-2 text-[11px] text-slate-500">
          Red = fewer days left, Green = more days left.
        </div>
      </div>
    </Card>
  );
}
