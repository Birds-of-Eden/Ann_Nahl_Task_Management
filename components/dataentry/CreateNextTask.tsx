"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

interface CreateNextTaskProps {
  clientId: string;
  onCreated?: () => void;
}

export default function CreateNextTask({
  clientId,
  onCreated,
}: CreateNextTaskProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const SITE_ASSET_TYPES = [
    "social_site",
    "web2_site",
    "other_asset",
    "graphics_design",
    "image_optimization",
    "content_studio",
    "content_writing",
    "backlinks",
    "completed_com",
    "youtube_video_optimization",
    "monitoring",
    "review_removal",
    "summary_report",
    "guest_posting",
  ] as const;
  type SiteAssetTypeLocal = (typeof SITE_ASSET_TYPES)[number];
  const [countsByType, setCountsByType] = useState<Partial<Record<SiteAssetTypeLocal, number>>>({});
  const [assetCountsByType, setAssetCountsByType] = useState<Partial<Record<SiteAssetTypeLocal, number>>>({});

  useEffect(() => {
    if (!open) return;
    // Fetch asset counts when dialog opens
    const fetchAssetCounts = async () => {
      try {
        const res = await fetch(
          `/api/tasks/create-dataentry-posting-tasks?clientId=${clientId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAssetCountsByType(data.byType || {});
        }
      } catch (err) {
        console.error("Failed to fetch asset counts:", err);
      }
    };
    fetchAssetCounts();
  }, [open, clientId]);

  const createNext = async () => {
    if (!clientId) return;
    const total = Object.values(countsByType).reduce((a, b) => a + Number(b || 0), 0);
    if (total <= 0) {
      toast.info("Please enter at least one non-zero count.");
      return;
    }
    setIsLoading(true);
    try {
      // 1) Create tasks using the countsByType API
      const createRes = await fetch("/api/tasks/create-dataentry-posting-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, countsByType }),
      });
      const createJson = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createJson?.message || "Failed to create tasks");
      }

      console.log("[CreateNextTask] created response", createJson);

      const createdTasks: Array<{
        id: string;
        dueDate?: string | null;
        category?: { id: string; name: string } | null;
      }> = Array.isArray(createJson?.tasks)
        ? createJson.tasks
        : [];
      const createdCount = Number(createJson?.created ?? createdTasks.length);

      console.log("[CreateNextTask] created tasks count", createdCount);

      if (createdTasks.length === 0) {
        toast.info(createJson?.message || "No new tasks created (all counts were 0)");
        onCreated?.();
        setOpen(false);
        return;
      }

      // 2) Assign tasks per category to the agent who last completed a task in that category
      const tasksByCategory = new Map<string, typeof createdTasks>();
      for (const t of createdTasks) {
        const catName = t.category?.name || "";
        if (!catName) continue;
        const arr = tasksByCategory.get(catName) ?? [];
        arr.push(t);
        tasksByCategory.set(catName, arr);
      }

      console.log("[CreateNextTask] tasksByCategory keys", Array.from(tasksByCategory.keys()));

      const assignments: Array<{ taskId: string; agentId: string; note?: string; dueDate?: string }> = [];

      // Prepare a lazy global last-agent fetch (Blog Posting/Social Activity)
      let cachedGlobalAgentId: string | null = null;
      async function getGlobalAgentId(): Promise<string | null> {
        if (cachedGlobalAgentId !== null) return cachedGlobalAgentId;
        const res = await fetch(
          `/api/tasks/last-agent-for-client?clientId=${encodeURIComponent(clientId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({} as any));
        cachedGlobalAgentId = json?.agent?.id || null;
        console.log("[CreateNextTask] global agent", cachedGlobalAgentId);
        return cachedGlobalAgentId;
      }

      // Assign per category with fallback to global agent
      for (const [catName, list] of tasksByCategory.entries()) {
        let agentId: string | null = null;
        try {
          const res = await fetch(
            `/api/tasks/last-agent-for-client?clientId=${encodeURIComponent(clientId)}&category=${encodeURIComponent(catName)}`,
            { cache: "no-store" }
          );
          const json = await res.json().catch(() => ({} as any));
          agentId = json?.agent?.id || null;
          console.log("[CreateNextTask] category agent", { catName, agentId, json });
        } catch {}

        if (!agentId) {
          agentId = await getGlobalAgentId();
        }
        if (!agentId) continue;

        for (const t of list) {
          assignments.push({
            taskId: t.id,
            agentId,
            note: `Auto-assigned to last agent${agentId ? ` (category: ${catName})` : ""}`,
            dueDate:
              t?.dueDate && typeof t.dueDate === "string"
                ? t.dueDate
                : (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    return d.toISOString();
                  })(),
          });
        }
      }

      // Any tasks without category: try global last agent
      const withoutCategory = createdTasks.filter((t) => !t.category?.name);
      if (withoutCategory.length) {
        const globalAgentId = await getGlobalAgentId();
        if (globalAgentId) {
          for (const t of withoutCategory) {
            assignments.push({
              taskId: t.id,
              agentId: globalAgentId,
              note: `Auto-assigned to last agent (no category)`,
              dueDate:
                t?.dueDate && typeof t.dueDate === "string"
                  ? t.dueDate
                  : (() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      return d.toISOString();
                    })(),
            });
          }
        }
      }

      if (assignments.length > 0) {
        console.log("[CreateNextTask] assignments prepared", { count: assignments.length, sample: assignments.slice(0, 3) });
        const distRes = await fetch(`/api/tasks/dataentry-distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, assignments }),
        });
        console.log("[CreateNextTask] distribute status", distRes.status);
        if (distRes.ok) {
          toast.success(
            createJson?.message || `Created ${createdCount} task(s) and auto-assigned by category`
          );
        } else {
          const djson = await distRes.json().catch(() => ({}));
          console.error("Assignment failed:", djson);
          toast.warning(`Created ${createdCount} task(s), but auto-assignment failed`);
        }
      } else {
        toast.success(createJson?.message || `Created ${createdCount} task(s); no previous agents found per category`);
      }

      onCreated?.();
      setOpen(false);
      // Set localStorage flag to hide button after creation
      try {
        localStorage.setItem(`nextTasksCreated:${clientId}`, "1");
      } catch {}
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Check localStorage to hide button if tasks already created
  const [tasksAlreadyCreated, setTasksAlreadyCreated] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const v = localStorage.getItem(`nextTasksCreated:${clientId}`);
        setTasksAlreadyCreated(!!v);
      }
    } catch {
      setTasksAlreadyCreated(false);
    }
  }, [clientId]);

  // Also require that initial tasks were created at least once using CreateTasksButton
  const [initialTasksCreated, setInitialTasksCreated] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const v = localStorage.getItem(`tasksCreated:${clientId}`);
        setInitialTasksCreated(!!v);
      }
    } catch {
      setInitialTasksCreated(false);
    }
  }, [clientId]);

  // Don't render if tasks already created via this button, or if initial tasks haven't been created yet
  if (tasksAlreadyCreated || !initialTasksCreated) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className="bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white h-11 rounded-xl font-semibold"
        title="Create next cycle of tasks by type and assign to last agent (button will hide after creation)"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Create Next Tasks
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-lg">
                <RefreshCcw className="w-5 h-5 text-white" />
              </div>
              Create Next Cycle Tasks
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Select asset types and specify how many cycles to create. Each cycle
              creates tasks for all assets of that type (e.g., 5 cycles × 10 assets
              = 50 tasks).
            </DialogDescription>
          </DialogHeader>

          {/* Summary Card */}
          <div className="px-6 pt-4">
            <div className="p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                    <svg
                      className="w-5 h-5 text-sky-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                    Total Tasks to Create
                  </span>
                </div>
                <span className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                  {Object.entries(countsByType).reduce(
                    (sum, [type, cycles]) => {
                      const assets = assetCountsByType[type as SiteAssetTypeLocal] || 0;
                      return sum + (cycles || 0) * assets;
                    },
                    0
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Asset Type List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {SITE_ASSET_TYPES.map((type) => (
                <div
                  key={type}
                  className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex-1">
                    <Label className="font-medium text-gray-700 dark:text-gray-300 text-sm cursor-pointer capitalize">
                      {type.replace(/_/g, " ")}
                    </Label>
                    {assetCountsByType[type] ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {assetCountsByType[type]} asset{assetCountsByType[type] !== 1 ? 's' : ''}
                        {countsByType[type] ? (
                          <span className="font-semibold text-sky-600 dark:text-sky-400 ml-1">
                            → {(countsByType[type] || 0) * (assetCountsByType[type] || 0)} tasks
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-full border-2 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20 disabled:opacity-30"
                      onClick={() =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: Math.max(0, (prev[type] || 0) - 1),
                        }))
                      }
                      disabled={(countsByType[type] || 0) <= 0}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M20 12H4"
                        />
                      </svg>
                    </Button>

                    <Input
                      type="number"
                      min={0}
                      className="w-20 text-center font-semibold text-lg border-2 focus:border-sky-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={countsByType[type] ?? 0}
                      onChange={(e) =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-full border-2 hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20"
                      onClick={() =>
                        setCountsByType((prev) => ({
                          ...prev,
                          [type]: (prev[type] || 0) + 1,
                        }))
                      }
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Footer with Quick Actions and Buttons */}
          <div className="px-6 pb-6 pt-4 border-t bg-gray-50 dark:bg-gray-900/50">
            {/* Quick Actions */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCountsByType({})}
                className="flex-1 h-10 font-medium hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allOnes = SITE_ASSET_TYPES.reduce((acc, type) => {
                    acc[type] = 1;
                    return acc;
                  }, {} as Record<string, number>);
                  setCountsByType(allOnes);
                }}
                className="flex-1 h-10 font-medium hover:bg-sky-50 hover:border-sky-300 dark:hover:bg-sky-900/20"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Set All to 1
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
                className="flex-1 h-11 font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={createNext}
                disabled={
                  isLoading ||
                  Object.values(countsByType).every(
                    (count) => !count || count === 0
                  )
                }
                className="flex-1 h-11 font-semibold bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Tasks...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-5 w-5 mr-2" />
                    Create & Assign
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
