import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

const COLORS = {
  slate: "#94a3b8",
  green: "#22c55e",
  orange: "#f97316",
};

export function ClientsByPackageChart({
  isLoading,
  byPackage,
}: {
  isLoading: boolean;
  byPackage: any[];
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900">
          Clients by Package (Status Breakdown)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-96">
        {isLoading ? (
          <Skeleton className="h-full" />
        ) : byPackage.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPackage}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey={(d: any) => d.packageName ?? d.packageId.slice(0, 6)}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tick={{ fill: "#64748b" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tick={{ fill: "#64748b" }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="clients"
                fill={COLORS.slate}
                name="Total"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="active"
                fill={COLORS.green}
                name="Active"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="expired"
                fill={COLORS.orange}
                name="Expired"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No package data" />
        )}
      </CardContent>
    </Card>
  );
}
