"use client";

import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, Building2 } from "lucide-react";
import { TabContent } from "./TabContent";
import {
  CategorizedTasks,
  Agent,
  TaskAssignment,
  Task,
} from "./distribution-types";

type AgentWithLoad = Agent & {
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

interface TaskTabsProps {
  // Standard (Asset Creation) 3-tab mode
  categorizedTasks?: CategorizedTasks;

  // ⭐ NEW: both agent pools provided; "agents" kept for backward-compat/global defaults
  teamAgents?: AgentWithLoad[];
  allAgents?: AgentWithLoad[];

  // Agents + shared state/handlers
  agents: AgentWithLoad[];
  selectedTasks: Set<string>;
  selectedTasksOrder: string[];
  taskAssignments: TaskAssignment[];
  taskNotes: Record<string, string>;
  viewMode: "list" | "grid";
  onTaskSelection: (taskId: string, checked: boolean) => void;
  onSelectAllTasks: (taskIds: string[], checked: boolean) => void;
  onTaskAssignment: (
    taskId: string,
    agentId: string,
    isMultipleSelected: boolean,
    isFirstSelectedTask: boolean
  ) => void;
  onNoteChange: (taskId: string, note: string) => void;
  onViewModeChange: (mode: "list" | "grid") => void;

  // ⭐ Single-tab mode (for non–Asset Creation categories)
  singleTabTasks?: Task[];
  singleTabTitle?: string;
}

function agentDisplayName(a: Partial<AgentWithLoad>) {
  return (
    (a as any)?.name ||
    `${(a as any)?.firstName ?? ""} ${(a as any)?.lastName ?? ""}`.trim() ||
    (a as any)?.email ||
    "Agent"
  );
}

function formatLabel(a: AgentWithLoad) {
  if (a.displayLabel) return a.displayLabel;

  const name = agentDisplayName(a);
  const ac = a.activeCount ?? 0;
  const w = a.weightedScore ?? 0;
  const s = a.byStatus ?? {};
  const p = s["pending"] ?? 0;
  const ip = s["in_progress"] ?? 0;
  const o = s["overdue"] ?? 0;
  const r = s["reassigned"] ?? 0;

  return `${name} — ${ac} active (P:${p} | IP:${ip} | O:${o} | R:${r}) • W:${w}`;
}

export function TaskTabs({
  categorizedTasks,
  singleTabTasks,
  singleTabTitle,
  teamAgents = [],
  allAgents = [],
  agents,
  selectedTasks,
  selectedTasksOrder,
  taskAssignments,
  taskNotes,
  viewMode,
  onTaskSelection,
  onSelectAllTasks,
  onTaskAssignment,
  onNoteChange,
  onViewModeChange,
}: TaskTabsProps) {
  // Prepare labels and sort (least → most load)
  const enrichAndSort = (list: AgentWithLoad[]) => {
    const enriched = (list || []).map((a) => ({
      ...a,
      displayLabel: formatLabel(a),
      activeCount: a.activeCount ?? 0,
      weightedScore: a.weightedScore ?? 0,
      byStatus: a.byStatus ?? {},
    }));
    enriched.sort(
      (x, y) =>
        (x.weightedScore ?? 0) - (y.weightedScore ?? 0) ||
        (x.activeCount ?? 0) - (y.activeCount ?? 0) ||
        agentDisplayName(x).localeCompare(agentDisplayName(y))
    );
    return enriched;
  };

  const agentsWithLabels = useMemo(() => enrichAndSort(agents), [agents]);
  const teamAgentsWithLabels = useMemo(
    () => enrichAndSort(teamAgents),
    [teamAgents]
  );
  const allAgentsWithLabels = useMemo(
    () => enrichAndSort(allAgents),
    [allAgents]
  );

  // -----------------------------
  // SINGLE-TAB MODE (non–Asset Creation)
  // -----------------------------
  if (singleTabTasks) {
    return (
      <div className="w-full">
        <div className="mt-6">
          <TabContent
            siteType="single"
            tasks={singleTabTasks}
            // NEW: pass both lists down
            teamAgents={teamAgentsWithLabels}
            allAgents={allAgentsWithLabels}
            // keep default/global list as well
            agents={agentsWithLabels}
            selectedTasks={selectedTasks}
            selectedTasksOrder={selectedTasksOrder}
            taskAssignments={taskAssignments}
            taskNotes={taskNotes}
            viewMode={viewMode}
            onTaskSelection={onTaskSelection}
            onSelectAllTasks={onSelectAllTasks}
            onTaskAssignment={onTaskAssignment}
            onNoteChange={onNoteChange}
            onViewModeChange={onViewModeChange}
            titleOverride={`${singleTabTitle ?? "Tasks"} Tasks`}
            descriptionOverride={`Manage ${singleTabTitle ?? "these"} tasks`}
          />
        </div>
      </div>
    );
  }

  // -----------------------------
  // 3-TAB MODE (Asset Creation)
  // -----------------------------
  const safe = {
    social_site: categorizedTasks?.social_site ?? [],
    web2_site: categorizedTasks?.web2_site ?? [],
    other_asset: categorizedTasks?.other_asset ?? [],
  };

  return (
    <Tabs defaultValue="social_site" className="w-full">
      <TabsList className="grid grid-cols-3 gap-3">
        <TabsTrigger value="social_site">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>Social Sites</span>
            <Badge className="ml-1 rounded-full">
              {safe.social_site.length}
            </Badge>
          </span>
        </TabsTrigger>
        <TabsTrigger value="web2_site">
          <span className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <span>Web2 Sites</span>
            <Badge className="ml-1 rounded-full">{safe.web2_site.length}</Badge>
          </span>
        </TabsTrigger>
        <TabsTrigger value="other_asset">
          <span className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span>Other Assets</span>
            <Badge className="ml-1 rounded-full">
              {safe.other_asset.length}
            </Badge>
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="social_site" className="mt-8">
        <TabContent
          siteType="social_site"
          tasks={safe.social_site}
          // NEW
          teamAgents={teamAgentsWithLabels}
          allAgents={allAgentsWithLabels}
          agents={agentsWithLabels}
          selectedTasks={selectedTasks}
          selectedTasksOrder={selectedTasksOrder}
          taskAssignments={taskAssignments}
          taskNotes={taskNotes}
          viewMode={viewMode}
          onTaskSelection={onTaskSelection}
          onSelectAllTasks={onSelectAllTasks}
          onTaskAssignment={onTaskAssignment}
          onNoteChange={onNoteChange}
          onViewModeChange={onViewModeChange}
        />
      </TabsContent>

      <TabsContent value="web2_site" className="mt-8">
        <TabContent
          siteType="web2_site"
          tasks={safe.web2_site}
          // NEW
          teamAgents={teamAgentsWithLabels}
          allAgents={allAgentsWithLabels}
          agents={agentsWithLabels}
          selectedTasks={selectedTasks}
          selectedTasksOrder={selectedTasksOrder}
          taskAssignments={taskAssignments}
          taskNotes={taskNotes}
          viewMode={viewMode}
          onTaskSelection={onTaskSelection}
          onSelectAllTasks={onSelectAllTasks}
          onTaskAssignment={onTaskAssignment}
          onNoteChange={onNoteChange}
          onViewModeChange={onViewModeChange}
        />
      </TabsContent>

      <TabsContent value="other_asset" className="mt-8">
        <TabContent
          siteType="other_asset"
          tasks={safe.other_asset}
          // NEW
          teamAgents={teamAgentsWithLabels}
          allAgents={allAgentsWithLabels}
          agents={agentsWithLabels}
          selectedTasks={selectedTasks}
          selectedTasksOrder={selectedTasksOrder}
          taskAssignments={taskAssignments}
          taskNotes={taskNotes}
          viewMode={viewMode}
          onTaskSelection={onTaskSelection}
          onSelectAllTasks={onSelectAllTasks}
          onTaskAssignment={onTaskAssignment}
          onNoteChange={onNoteChange}
          onViewModeChange={onViewModeChange}
        />
      </TabsContent>
    </Tabs>
  );
}
