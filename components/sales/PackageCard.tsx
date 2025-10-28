import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PackageCard({
  title,
  total,
  active,
  expired,
  avgDaysLeft,
  selected,
  onClick,
}: {
  title: string;
  total: number;
  active: number;
  expired: number;
  avgDaysLeft: number | null;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left w-full group">
      <Card
        className={cn(
          "transition-all duration-200 border-0 shadow-sm ring-1",
          selected
            ? "ring-2 ring-cyan-400 shadow-lg shadow-cyan-100/50 -translate-y-1"
            : "ring-slate-200/60 hover:shadow-lg hover:-translate-y-1 hover:ring-slate-300/60"
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold line-clamp-1 text-slate-900">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Total
            </p>
            <p className="text-lg font-bold text-slate-900">{total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Active
            </p>
            <p className="text-lg font-bold text-emerald-600">{active}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Expired
            </p>
            <p className="text-lg font-bold text-rose-600">{expired}</p>
          </div>
          <div className="col-span-3 mt-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-medium bg-slate-100 text-slate-700"
            >
              {avgDaysLeft !== null
                ? `Avg days left: ${avgDaysLeft}`
                : "Avg days left: —"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
