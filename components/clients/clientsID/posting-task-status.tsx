// components/clients/clientsID/posting-task-status.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, AlertTriangle, CheckCircle, Loader } from "lucide-react";
import { PostingTaskGenerator } from "./posting-task-generator";

interface PostingTaskStatusProps {
  qcTaskId: string;
  qcTaskName: string;
  assetName: string;
  assignmentId: string;
  clientName: string;
  templateSiteAssetId?: number;
  isCompleted: boolean;
}

export function PostingTaskStatus({
  qcTaskId,
  qcTaskName,
  assetName,
  assignmentId,
  clientName,
  templateSiteAssetId,
  isCompleted,
}: PostingTaskStatusProps) {
  const [loading, setLoading] = useState(true);
  const [postingTasks, setPostingTasks] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isCompleted || !templateSiteAssetId) {
      setLoading(false);
      return;
    }

    const fetchPostingTasks = async () => {
      try {
        setLoading(true);
        // Fetch posting tasks related to this asset
        const response = await fetch(
          `/api/assignments/${assignmentId}`
        );
        const data = await response.json();

        if (response.ok) {
          // Filter posting tasks for this asset
          const posting = (data.tasks || []).filter(
            (t: any) =>
              t.templateSiteAssetId === templateSiteAssetId &&
              (t.category?.name?.toLowerCase().includes("posting") ||
                t.name?.toLowerCase().includes("posting"))
          );
          setPostingTasks(posting);

          // Get asset settings
          const setting = (data.siteAssetSettings || []).find(
            (s: any) => s.templateSiteAssetId === templateSiteAssetId
          );
          setSettings(setting);
        }
      } catch (error) {
        console.error("Error fetching posting tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPostingTasks();
  }, [isCompleted, assignmentId, templateSiteAssetId, refreshKey]);

  const handleSuccess = () => {
    // Refresh posting tasks after generation
    setRefreshKey((prev) => prev + 1);
  };

  // Don't show if QC not completed yet
  if (!isCompleted) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Loader className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-700 dark:text-blue-300">
          Loading posting tasks status...
        </span>
      </div>
    );
  }

  const hasPostingTasks = postingTasks.length > 0;
  const completedPosting = postingTasks.filter(
    (t) => t.status?.toLowerCase() === "completed"
  ).length;
  const inProgressPosting = postingTasks.filter((t) =>
    ["in_progress", "in-progress"].includes(t.status?.toLowerCase())
  ).length;
  const pendingPosting = postingTasks.filter(
    (t) => t.status?.toLowerCase() === "pending"
  ).length;

  const recommendedFrequency =
    settings?.requiredFrequency ||
    settings?.templateSiteAsset?.defaultPostingFrequency ||
    4;

  if (!hasPostingTasks) {
    // No posting tasks yet - show warning and generate button
    return (
      <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              No Posting Tasks Generated
            </p>
            <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
              <p>✓ QC approved and ready for posting</p>
              <p>
                • Recommended: {recommendedFrequency} posting tasks/month
                {settings?.requiredFrequency && (
                  <span className="ml-1 text-blue-600 dark:text-blue-400">⚡ Client Override</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PostingTaskGenerator
            taskId={qcTaskId}
            taskName={qcTaskName}
            assetName={assetName}
            assignmentId={assignmentId}
            clientName={clientName}
            defaultFrequency={recommendedFrequency}
            isClientOverride={!!settings?.requiredFrequency}
            onSuccess={handleSuccess}
          />
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Generate posting tasks manually
          </p>
        </div>
      </div>
    );
  }

  // Has posting tasks - show status summary
  return (
    <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Posting Tasks Generated ({postingTasks.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {completedPosting > 0 && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                ✓ {completedPosting} completed
              </Badge>
            )}
            {inProgressPosting > 0 && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                ⏳ {inProgressPosting} in progress
              </Badge>
            )}
            {pendingPosting > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                📝 {pendingPosting} pending
              </Badge>
            )}
          </div>

          {/* Show list of posting tasks */}
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {postingTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between text-xs py-1 px-2 bg-white dark:bg-green-900/30 rounded border border-green-200 dark:border-green-800"
              >
                <span className="font-medium truncate">{task.name}</span>
                <span className="text-green-600 dark:text-green-400 capitalize ml-2 flex-shrink-0">
                  {task.status?.replace(/_/g, " ")}
                </span>
              </div>
            ))}
            {postingTasks.length > 5 && (
              <p className="text-xs text-green-600 dark:text-green-400 text-center py-1">
                +{postingTasks.length - 5} more tasks
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Option to generate more if needed */}
      <div className="flex items-center gap-2 pt-2 border-t border-green-200 dark:border-green-800">
        <PostingTaskGenerator
          taskId={qcTaskId}
          taskName={qcTaskName}
          assetName={assetName}
          assignmentId={assignmentId}
          clientName={clientName}
          defaultFrequency={recommendedFrequency}
          isClientOverride={!!settings?.requiredFrequency}
          onSuccess={handleSuccess}
        />
        <p className="text-xs text-green-600 dark:text-green-400">
          Generate additional posting tasks if needed
        </p>
      </div>
    </div>
  );
}
