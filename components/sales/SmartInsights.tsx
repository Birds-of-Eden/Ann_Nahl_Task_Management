import { Lightbulb, AlertTriangle, Rocket, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

export function SmartInsights({
  summary,
  byPackage,
}: {
  summary: any;
  byPackage: any[];
}) {
  const insights: string[] = [];

  if (summary?.expiringSoon > 0)
    insights.push(
      `⚠️ ${summary.expiringSoon} clients have packages expiring within 30 days. Consider renewal outreach.`
    );

  if (summary?.startingSoon > 0)
    insights.push(
      `🚀 ${summary.startingSoon} new clients are starting packages in the next two weeks — great momentum!`
    );

  if (byPackage?.length > 0) {
    const top = byPackage[0];
    insights.push(
      `🌟 ${top.packageName ?? "Top Package"} leads in adoption with ${
        top.clients
      } clients and an average of ${top.avgDaysLeft ?? 0} days left.`
    );
  }

  if (summary?.active && summary?.expired)
    insights.push(
      `📊 Retention rate: ${(
        (summary.active / (summary.active + summary.expired)) *
        100
      ).toFixed(1)}%.`
    );

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60 p-6 bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <p className="text-sm font-semibold text-slate-800 tracking-wide">
          Smart Insights
        </p>
      </div>

      <ul className="space-y-2 text-sm text-slate-700">
        {insights.length ? (
          insights.map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1">💬</span>
              <span>{text}</span>
            </li>
          ))
        ) : (
          <p className="text-slate-500">No insights available.</p>
        )}
      </ul>
    </Card>
  );
}
