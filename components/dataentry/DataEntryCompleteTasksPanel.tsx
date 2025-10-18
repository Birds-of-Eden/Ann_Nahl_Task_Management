//app/com
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle2,
  UserRound,
  Search,
  Calendar,
  BarChart3,
  AlertCircle,
  X,
  Copy,
  KeyRound,
  LinkIcon,
  PenTool,
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useRouter } from "next/navigation";
import CreateTasksButton from "./CreateTasksButton";
import CreateNextTask from "./CreateNextTask";
import ContentWritingModal from "./contentWritingModal";

export type DETask = {
  id: string;
  name: string;
  status: string;
  priority: string;
  completionLink?: string | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  category?: { id: string; name: string } | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  dueDate?: string | null;
  completedAt?: string | null;
  // Persisted JSON: { completedByUserId, completedByName, completedAt, status }
  dataEntryReport?: any;
  // Persisted JSON: Content writing data with titles and content sections
  contentWriting?: any;
};

// Status badge variant mapping
const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  in_progress: "secondary",
  completed: "default",
  qc_approved: "default",
  rejected: "destructive",
};

// Priority color mapping
const priorityColor: Record<string, string> = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-green-600",
};

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  dataEntryCompleted: number;
  last7Days: number;
  last30Days: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export default function DataEntryCompleteTasksPanel({
  clientId,
}: {
  clientId: string;
}) {
  const router = useRouter();
  const { user } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<DETask[]>([]);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string | null; email?: string | null }>
  >([]);
  const [hasCreatedTasks, setHasCreatedTasks] = useState(false);
  // Track whether "Create & Assign Next Task" has already been used for this client
  const [nextTasksAlreadyCreated, setNextTasksAlreadyCreated] = useState(false);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
    dataEntryCompleted: 0,
    last7Days: 0,
    last30Days: 0,
    byStatus: {},
    byPriority: {},
  });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selected, setSelected] = useState<DETask | null>(null);
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lastUsedPassword, setLastUsedPassword] = useState<string | null>(null);
  const [doneBy, setDoneBy] = useState<string>("");
  const [completedAt, setCompletedAt] = useState<Date | undefined>(undefined);
  const [lastUsedDate, setLastUsedDate] = useState<Date | null>(null);
  const [lastUsedAgent, setLastUsedAgent] = useState<string | null>(null);
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [openDate, setOpenDate] = useState(false);
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  // Content Writing Modal state
  const [contentWritingModalOpen, setContentWritingModalOpen] = useState(false);
  const [selectedContentTask, setSelectedContentTask] = useState<DETask | null>(null);

  // Fetch client name and email when clientId changes
  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) {
        setClientName("");
        setClientEmail("");
        return;
      }

      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (response.ok) {
          const data = await response.json();
          setClientName(data.name || `Client ${clientId}`);
          setClientEmail(data.email || "");
        } else {
          setClientName(`Client ${clientId}`);
          setClientEmail("");
        }
      } catch (error) {
        console.error("Error fetching client:", error);
        setClientName(`Client ${clientId}`);
        setClientEmail("");
      }
    };

    fetchClientData();
  }, [clientId]);

  const loadStats = async () => {
    if (!clientId) return;

    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      // Fetch tasks with data entry reports
      const res = await fetch(
        `/api/tasks/data-entry-reports?clientId=${clientId}&pageSize=1000`
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch data: ${res.status} ${res.statusText}`
        );
      }

      const response = await res.json();
      const data = Array.isArray(response?.data) ? response.data : [];

      if (!Array.isArray(data)) {
        throw new Error("Invalid response data");
      }

      // Calculate statistics
      const total = data.length;
      const completed = data.filter(
        (t: any) => t.dataEntryStatus === "completed"
      ).length;
      // Per-user completed: strictly match JSON dataEntryReport.completedByUserId to logged-in user ID
      const completedByMe = data.reduce((acc: number, t: any) => {
        const rid = t?.dataEntryReport?.completedByUserId;
        return acc + (user?.id && rid === user.id ? 1 : 0);
      }, 0);
      const last7Days = data.filter(
        (t: any) =>
          t.dataEntryCompletedAt &&
          new Date(t.dataEntryCompletedAt) >= sevenDaysAgo
      ).length;
      const last30Days = data.filter(
        (t: any) =>
          t.dataEntryCompletedAt &&
          new Date(t.dataEntryCompletedAt) >= thirtyDaysAgo
      ).length;

      // Group by status and priority
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      data.forEach((task: any) => {
        // Count by status
        const status = task.dataEntryStatus || "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;

        // Count by priority
        const priority = task.taskPriority || "unknown";
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });

      setStats((prev) => ({
        ...prev,
        dataEntryCompleted: completedByMe,
        last7Days,
        last30Days,
        byStatus,
        byPriority,
      }));
    } catch (error) {
      console.error("Failed to load statistics:", error);
    }
  };

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [tasksRes, aRes] = await Promise.all([
        fetch(`/api/tasks/client/${clientId}`, { cache: "no-store" }),
        fetch(`/api/users?role=agent&limit=200`, { cache: "no-store" }),
      ]);

      const tasksData = await tasksRes.json();
      const mine = (tasksData as any[]).filter(
        (t) => t?.assignedTo?.id && user?.id && t.assignedTo.id === user.id
      );
      setTasks(mine);

      // Update basic stats
      const total = mine.length;
      const completed = mine.filter(
        (t) => t.status === "completed" || t.status === "qc_approved"
      ).length;
      const pending = mine.filter((t) => t.status === "pending").length;
      const inProgress = mine.filter((t) => t.status === "in_progress").length;
      const overdue = mine.filter((t) => {
        if (!t.dueDate) return false;
        return (
          new Date(t.dueDate) < new Date() &&
          (t.status === "pending" || t.status === "in_progress")
        );
      }).length;

      setStats((prev) => ({
        ...prev,
        total,
        completed,
        pending,
        inProgress,
        overdue,
      }));

      // Check if posting tasks already exist
      const hasPostingTasks = mine.some(
        (task: any) =>
          task.name?.toLowerCase().includes("posting") ||
          task.category?.name?.toLowerCase().includes("posting")
      );
      setHasCreatedTasks(hasPostingTasks);

      const aJson = await aRes.json();
      const list: Array<{
        id: string;
        name?: string | null;
        email?: string | null;
      }> = (aJson?.users ?? aJson?.data ?? [])
        .filter((u: any) => u?.role?.name?.toLowerCase() === "agent")
        .map((u: any) => ({
          id: u.id,
          name: u.name ?? null,
          email: u.email ?? null,
        }));
      setAgents(list);

      // Load statistics
      await loadStats();
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tasks or agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, user?.id]);

  // On mount/clientId change, read flag to hide CreateNextTask button after first use
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && clientId) {
        const v = localStorage.getItem(`nextTasksCreated:${clientId}`);
        setNextTasksAlreadyCreated(!!v);
      } else {
        setNextTasksAlreadyCreated(false);
      }
    } catch {
      setNextTasksAlreadyCreated(false);
    }
  }, [clientId]);

  // Count tasks completed by the current Data Entry user
  const dataEntryCompletedCount = useMemo(() => {
    if (!user?.id) return 0;

    return tasks.reduce((count, task: any) => {
      const report = task?.dataEntryReport;
      if (!report) return count;

      const isCompletedByMe =
        report.completedByUserId === user.id &&
        typeof report.status === "string" &&
        report.status.trim().toLowerCase() === "completed by data entry";

      return isCompletedByMe ? count + 1 : count;
    }, 0);
  }, [tasks, user?.id]);

  const filtered = useMemo(() => {
    let result = tasks;

    // Apply search filter
    const qlc = q.trim().toLowerCase();
    if (qlc) {
      result = result.filter((t) =>
        [t.name, t.category?.name || "", t.priority || "", t.status || ""].some(
          (s) => String(s).toLowerCase().includes(qlc)
        )
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    return result;
  }, [tasks, q, statusFilter, priorityFilter]);

  // Gate readiness by required categories fully QC-approved
  const requiredCategories = [
    "Social Assets Creation",
    "Web2 Creation",
    "Additional Assets Creation",
  ];

  const isReadyForPostingCreation = useMemo(() => {
    if (!tasks || tasks.length === 0) return false;
    // For each required category: must exist and all in that category must be qc_approved
    return requiredCategories.every((cat) => {
      const inCat = tasks.filter(
        (t) => (t.category?.name || "").toLowerCase() === cat.toLowerCase()
      );
      if (inCat.length === 0) return false; // must have tasks for this category
      return inCat.every((t) => t.status === "qc_approved");
    });
  }, [tasks]);

  const [creatingPosting, setCreatingPosting] = useState(false);

  const createPostingTasks = async () => {
    if (!clientId) return;
    if (!isReadyForPostingCreation) {
      toast.warning("Please complete & QC-approve all tasks first.");
      return;
    }
    // Follow ClientUnifiedDashboard: route to admin creation page
    router.push(`/admin/distribution/client-agent/client/${clientId}`);
  };

  const resetModal = () => {
    setSelected(null);
    setLink("");
    setEmail("");
    setUsername("");
    // Don't reset password - keep the last used one
    setDoneBy("");
    setCompletedAt(undefined);
  };

  const isSimpleTask = (task: DETask | null) => {
    if (!task?.category?.name) return false;
    const simpleCategories = ["Social Activity", "Blog Posting"];
    return simpleCategories.includes(task.category.name);
  };

  // Check if a task is a content writing task
  const isContentWritingTask = (task: DETask | null) => {
    if (!task?.category?.name) return false;
    const contentWritingCategories = ["Content Writing", "Guest Posting"];
    return contentWritingCategories.some(cat =>
      task.category?.name?.toLowerCase().includes(cat.toLowerCase())
    );
  };

  const openContentWritingModal = (task: DETask) => {
    setSelectedContentTask(task);
    setContentWritingModalOpen(true);
  };

  const closeContentWritingModal = () => {
    setContentWritingModalOpen(false);
    setSelectedContentTask(null);
  };

  const openComplete = (t: DETask) => {
    setSelected(t);
    setLink(t.completionLink || "");
    // Auto-fill email with client email
    setEmail(clientEmail || "");
    setUsername(""); // Keep blank initially, will be auto-filled when link changes
    // Don't reset password - keep the last used one
    setPassword(password); // Keep current password value
    
    // Set completed date: first try task's completedAt, then last used date, then current date
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      if (!isNaN(d.getTime())) {
        setCompletedAt(d);
        setLastUsedDate(d);
      } else if (lastUsedDate) {
        setCompletedAt(lastUsedDate);
      } else {
        setCompletedAt(new Date());
      }
    } else if (lastUsedDate) {
      setCompletedAt(lastUsedDate);
    } else {
      setCompletedAt(new Date());
    }
    
    // Set the last used agent if available
    if (lastUsedAgent) {
      setDoneBy(lastUsedAgent);
    }
  };

  // Function to extract username from URL
  const extractUsernameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Try to extract username from various URL patterns
      // Look for common patterns like /user/username, /profile/username, etc.
      const pathSegments = urlObj.pathname
        .split("/")
        .filter((segment) => segment.length > 0);

      // Common patterns for username in URLs
      for (let i = 0; i < pathSegments.length; i++) {
        const segment = pathSegments[i];
        // Skip common path segments that are unlikely to be usernames
        if (
          [
            "user",
            "profile",
            "account",
            "users",
            "profiles",
            "accounts",
            "dashboard",
            "settings",
            "admin",
            "api",
            "auth",
            "login",
            "signup",
            "register",
          ].includes(segment.toLowerCase())
        ) {
          if (i + 1 < pathSegments.length) {
            const nextSegment = pathSegments[i + 1];
            // Check if next segment looks like a username (alphanumeric, not too long)
            if (/^[a-zA-Z0-9._-]{3,30}$/.test(nextSegment)) {
              return nextSegment;
            }
          }
        }
        // If segment looks like a username (alphanumeric, not too long)
        if (/^[a-zA-Z0-9._-]{3,30}$/.test(segment)) {
          return segment;
        }
      }

      // If no username found in path, try to extract from query parameters
      const searchParams = urlObj.searchParams;
      if (
        searchParams.has("user") ||
        searchParams.has("username") ||
        searchParams.has("profile") ||
        searchParams.has("u")
      ) {
        return (
          searchParams.get("user") ||
          searchParams.get("username") ||
          searchParams.get("profile") ||
          searchParams.get("u") ||
          ""
        );
      }

      // Try to extract from fragment (hash)
      const fragment = urlObj.hash.substring(1); // Remove the #
      if (fragment && /^[a-zA-Z0-9._-]{3,30}$/.test(fragment)) {
        return fragment;
      }

      return "";
    } catch {
      return "";
    }
  };

  // Load last used password from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const savedPassword = localStorage.getItem("lastUsedPassword");
        if (savedPassword) {
          setLastUsedPassword(savedPassword);
          setPassword(savedPassword);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save password to localStorage when it changes
  useEffect(() => {
    if (password) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("lastUsedPassword", password);
          setLastUsedPassword(password);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [password]);

  // Auto-fill username from URL when link changes
  useEffect(() => {
    if (link && link.trim()) {
      const extractedUsername = extractUsernameFromUrl(link.trim());
      if (extractedUsername && !username) {
        setUsername(extractedUsername);
      }
    }
  }, [link, username]); // Added username to dependencies to prevent unnecessary re-runs

  const submit = async () => {
    if (!user?.id || !selected) return;
    if (!link.trim()) {
      toast.error("Completion link is required");
      return;
    }
    if (!completedAt) {
      toast.error("Please select a completion date");
      return;
    }
    if (completedAt.getTime() > Date.now()) {
      toast.error("Completed date cannot be in the future");
      return;
    }
    
    // Save the selected agent as last used
    if (doneBy) {
      setLastUsedAgent(doneBy);
    }

    try {
      // 1) mark completed with link + credentials via agent endpoint (task is assigned to data_entry)
      const r1 = await fetch(`/api/tasks/agents/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selected.id,
          status: "completed",
          completionLink: link.trim(),
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          password: password || undefined,
        }),
      });
      const j1 = await r1.json();
      if (!r1.ok)
        throw new Error(j1?.message || j1?.error || "Failed to complete task");

      // 2) set completedAt and dataEntryReport
      const r2 = await fetch(`/api/tasks/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          // Agent's actual completion time from DatePicker
          completedAt: completedAt.toISOString(),
          // Server will set dataEntryReport.completedAt
          dataEntryReport: {
            completedByUserId: user.id,
            completedByName:
              (user as any)?.name || (user as any)?.email || user.id,
            completedBy: new Date().toISOString(),
            status: "Completed by " + (user as any)?.name,
          },
        }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2?.error || "Failed to set completed date");

      // 2.5) reassign to the selected 'doneBy' agent (if provided) so the task ownership reflects who actually did it
      if (doneBy && clientId) {
        const distBody = {
          clientId,
          assignments: [
            {
              taskId: selected.id,
              agentId: doneBy,
              note: "Reassigned to actual performer by data_entry",
              dueDate: selected.dueDate,
            },
          ],
        } as any;
        const rDist = await fetch(`/api/tasks/distribute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(distBody),
        });
        const jDist = await rDist.json();
        if (!rDist.ok)
          throw new Error(
            jDist?.error || "Failed to reassign task to selected agent"
          );
      }

      // 3) auto approve → qc_approved (include notes with doneBy)
      const r3 = await fetch(`/api/tasks/${selected.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          performanceRating: "Good",
          notes: doneBy ? `Done by agent: ${doneBy}` : undefined,
        }),
      });
      const j3 = await r3.json();
      if (!r3.ok) throw new Error(j3?.error || "Failed to approve task");

      toast.success("Task completed and QC approved");
      resetModal();
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to submit");
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Tasks Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              Total Tasks Remain
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              {stats.total}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              All tasks assigned to you
            </p>
          </CardContent>
        </Card>

        {/* Completed Tasks Card */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Total Completed
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div>
              <div className="text-2xl font-bold text-green-900">
                {stats.dataEntryCompleted}
              </div>
              <p className="text-xs text-green-700 mt-1">
                Completed by you (Data Entry)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">
              Over Due
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">
              {stats.overdue}
            </div>
            <p className="text-xs text-amber-600 mt-1">
              {stats.last7Days} in last 7 days • {stats.last30Days} in last 30
              days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Panel */}
      <Card className="border-0 shadow-xl overflow-hidden bg-white/90 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-2xl flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {clientId
                ? clientName
                  ? `${clientName}`
                  : `Client ${clientId}`
                : "All Clients"}{" "}
              — Complete Tasks
            </CardTitle>
            <CreateTasksButton
              clientId={clientId}
              disabled={hasCreatedTasks}
              onTaskCreationComplete={() => {
                setHasCreatedTasks(true);
                load();
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tasks..."
                className="pl-10 h-11 rounded-xl"
              />
            </div>
          </div>

          {/* Tasks Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                      <p className="mt-2">Loading tasks...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div>
                          <p>No tasks found</p>
                        </div>
                        {!nextTasksAlreadyCreated && (
                          <CreateNextTask
                            clientId={clientId}
                            onCreated={() => {
                              try {
                                if (typeof window !== "undefined") {
                                  localStorage.setItem(
                                    `nextTasksCreated:${clientId}`,
                                    "1"
                                  );
                                }
                              } catch {}
                              setNextTasksAlreadyCreated(true);
                              load();
                            }}
                          />
                        )}
                      </div>
                      {q ||
                      statusFilter !== "all" ||
                      priorityFilter !== "all" ? (
                        <Button
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            setQ("");
                            setStatusFilter("all");
                            setPriorityFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const isOverdue =
                      t.dueDate &&
                      new Date(t.dueDate) < new Date() &&
                      (t.status === "pending" || t.status === "in_progress");

                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div
                            className="font-medium text-slate-900 truncate max-w-[200px]"
                            title={t.name}
                          >
                            {t.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200"
                          >
                            {t.category?.name || "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              priorityColor[t.priority] || "text-gray-600"
                            }`}
                          >
                            {t.priority
                              ? t.priority.charAt(0).toUpperCase() +
                                t.priority.slice(1)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusVariant[t.status] || "outline"}
                            className="capitalize"
                          >
                            {t.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={`flex items-center gap-1 ${
                              isOverdue ? "text-red-600 font-medium" : ""
                            }`}
                          >
                            {t.dueDate ? (
                              <>
                                <Calendar className="h-4 w-4" />
                                {format(new Date(t.dueDate), "MMM dd, yyyy")}
                                {isOverdue && (
                                  <AlertCircle className="h-4 w-4 ml-1" />
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {/* Content Writing Button for content writing tasks ONLY */}
                            {isContentWritingTask(t) ? (
                              <Button
                                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-sm"
                                onClick={() => openContentWritingModal(t)}
                                size="sm"
                                disabled={
                                  t.status === "completed" ||
                                  t.status === "qc_approved"
                                }
                              >
                                <PenTool className="h-4 w-4 mr-2" />
                                {t.category?.name || "Content Writing"}
                              </Button>
                            ) : (
                              /* Complete Button for all other tasks */
                              <Button
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-700 hover:to-blue-700 shadow-sm"
                                onClick={() => openComplete(t)}
                                size="sm"
                                disabled={
                                  t.status === "completed" ||
                                  t.status === "qc_approved"
                                }
                              >
                                {t.status === "completed" ||
                                t.status === "qc_approved"
                                  ? "Completed"
                                  : "Complete"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {isReadyForPostingCreation && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={createPostingTasks}
                disabled={creatingPosting}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-md hover:from-indigo-700 hover:to-purple-700"
              >
                {creatingPosting ? "Creating..." : "Create Posting Tasks"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Dialog - Updated Design */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && resetModal()}>
        <DialogContent className="sm:max-w-[650px] rounded-2xl border bg-white/80 backdrop-blur-sm">
          {/* Updated Header */}
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              Complete Task:{" "}
              <span className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg text-white">
                {selected?.name}
              </span>
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm pt-1">
              Provide completion details below. This task will be auto-approved
              upon submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Fieldset for better grouping */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                <LinkIcon className="h-4 w-4 text-green-600" />
                Completed Link *
              </legend>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/your-completed-work"
                className="rounded-xl h-11 border-gray-300 focus:border-green-500 focus:ring-green-500/50 transition-all"
              />
            </fieldset>

            {/* Conditional Credentials Section - Refined Design */}
            {!isSimpleTask(selected) && (
              <fieldset className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={clientEmail || "email@example.com"}
                      className="rounded-xl h-11 bg-white border-gray-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className="rounded-xl h-11 bg-white border-gray-300"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Password
                    </label>
                    {/* Password input - now editable and visible */}
                    <div className="relative">
                      <Input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={lastUsedPassword ? "Using previously saved password" : "Enter password"}
                        type="text"
                        className="rounded-xl h-11 bg-white border-gray-300 font-mono pr-10"
                      />
                      {lastUsedPassword && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          SAVED
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {lastUsedPassword
                        ? "Using your last saved password. You can edit it above."
                        : "Enter password if required. Will be saved for next use."
                      }
                    </p>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Agent and Date Section in a final Fieldset */}
            <fieldset className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                  <UserRound className="h-4 w-4 text-blue-600" />
                  Done by (agent) *
                </legend>
                <Select 
                  value={doneBy} 
                  onValueChange={(value) => {
                    setDoneBy(value);
                    setLastUsedAgent(value);
                  }}
                >
                  <SelectTrigger className="rounded-xl h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500/50 text-base">
                    <SelectValue placeholder="Select agent..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200 shadow-lg p-3 w-[300px]">
                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Search agents by name..."
                          className="pl-12 h-12 text-base border-2 border-white"
                          value={agentSearchTerm}
                          onChange={(e) => setAgentSearchTerm(e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.focus();
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
                      {agents
                        .filter((agent) => {
                          const search = agentSearchTerm.toLowerCase();
                          return (
                            !search ||
                            agent.name?.toLowerCase().includes(search)
                          );
                        })
                        .sort((a, b) => {
                          // Sort selected agent to the top
                          if (a.id === doneBy) return -1;
                          if (b.id === doneBy) return 1;
                          return 0;
                        })
                        .map((agent) => (
                          <SelectItem
                            key={agent.id}
                            value={agent.id}
                            className="rounded-lg py-2 px-2 my-1 hover:bg-gray-100 focus:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center gap-4 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors">
                              <div
                                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                                  agent.id === doneBy
                                    ? "bg-blue-500"
                                    : "bg-green-500"
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                {agent.name || "Unnamed Agent"}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <legend className="text-sm font-semibold text-gray-700 flex items-center gap-2 px-1 mb-1">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  Completed At *
                </legend>
                <DatePicker
                  selected={completedAt}
                  onChange={(date: Date | null) => {
                    const newDate = date || new Date();
                    setCompletedAt(newDate);
                    setLastUsedDate(newDate);
                  }}
                  dateFormat="MMMM d, yyyy"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  placeholderText="Select completion date"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm h-11 focus:border-purple-500 focus:ring-purple-500/50 transition-all"
                  maxDate={new Date()}
                />
              </div>
            </fieldset>
          </div>

          {/* Footer with consistent button styles */}
          <DialogFooter className="pt-6 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => resetModal()}
              className="rounded-xl h-11 bg-red-500 hover:bg-red-600 hover:text-white text-white font-medium transition-all"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="ml-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 rounded-xl h-11 font-semibold shadow-sm transition-all"
              onClick={submit}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submit Completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Writing Modal */}
      <ContentWritingModal
        open={contentWritingModalOpen}
        onOpenChange={setContentWritingModalOpen}
        task={selectedContentTask}
        clientId={clientId}
        onSuccess={() => {
          closeContentWritingModal();
          load(); // Refresh the task list
        }}
      />
    </div>
  );
}
