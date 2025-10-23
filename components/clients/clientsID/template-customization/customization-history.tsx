// components/clients/clientsID/template-customization/customization-history.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Loader, Clock, User, FileText } from "lucide-react";
import { format } from "date-fns";

interface CustomizationHistoryProps {
  assignmentId: string;
  clientName: string;
}

export function CustomizationHistory({
  assignmentId,
  clientName,
}: CustomizationHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [assignmentId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/activity-logs?entityType=Assignment&entityId=${assignmentId}&limit=10`
      );
      const data = await response.json();
      
      if (response.ok) {
        const relevant = data.filter((activity: any) =>
          ["customize_template", "sync_template", "create_assignment"].includes(
            activity.action
          )
        );
        setActivities(relevant);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return null;
  }

  const getActionBadge = (action: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      customize_template: {
        label: "Customized",
        className: "bg-purple-100 text-purple-700",
      },
      sync_template: {
        label: "Switched",
        className: "bg-blue-100 text-blue-700",
      },
      create_assignment: {
        label: "Created",
        className: "bg-green-100 text-green-700",
      },
    };
    
    const badge = badges[action] || { label: action, className: "bg-slate-100 text-slate-700" };
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-gradient-to-r from-slate-500/10 to-purple-500/10">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-600" />
          Recent Changes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-700 last:border-0 last:pb-0"
            >
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getActionBadge(activity.action)}
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {activity.details?.description || activity.action}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(activity.timestamp), "MMM dd, yyyy • hh:mm a")}
                  </span>
                  {activity.user && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {activity.user.name || "System"}
                    </span>
                  )}
                </div>

                {activity.details?.summary && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {activity.details.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
