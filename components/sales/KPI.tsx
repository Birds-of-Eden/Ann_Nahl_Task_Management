import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KPI({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { label: string; positive?: boolean };
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 hover:shadow-md hover:ring-slate-300/60 transition-all duration-200">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600 tracking-wide uppercase">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-[11px] font-medium tracking-wide",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend.label}
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm ring-1 ring-slate-200/50">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
