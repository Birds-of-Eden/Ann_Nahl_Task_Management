// app/(wherever)/social-communication/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Link2,
} from "lucide-react";

/* =========================================================
   Types and Constants
   ========================================================= */
type TaskStatus =
  | "pending"
  | "in_progress"
  | "overdue"
  | "reassigned"
  | "completed"
  | "qc_approved"
  | "cancelled";

type Task = {
  id: string;
  name: string;
  status: TaskStatus;
  dueDate?: string | null;
  idealDurationMinutes?: number | null;
  client?: { id: string; name?: string | null } | null;
  category?: { id: string; name: string } | null;

  // 🔑 agent-facing creds (as in your demo flow)
  username?: string | null;
  email?: string | null;
  password?: string | null;

  // 🔗 primary place to do the work (may come from templateSiteAsset.url or a task field)
  completionLink?: string | null;
  templateSiteAsset?: {
    id: number;
    name: string;
    type: string;
    url: string | null;
  } | null;

  // repeat info (client-side guard; server optional)
  completedAt?: string | null; // last submission time
  nextEligibleAt?: string | null; // when available again
};

const SC_COOLDOWN_DAYS = 5;

/* =========================================================
   Helpers
   ========================================================= */
const isSocialCommunication = (t: Partial<Task>) =>
  ((t.category?.name ?? (t as any).categoryName ?? "") as string)
    .toLowerCase()
    .trim() === "social communication";

const startOfDayISO = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
};

const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const isToday = (iso?: string | null) => {
  if (!iso) return false;
  const a = new Date(iso);
  const b = new Date();
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const daysUntil = (futureISO?: string | null) => {
  if (!futureISO) return 0;
  const now = new Date();
  const end = new Date(futureISO);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
};

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

const primaryUrl = (t: Task) =>
  t.completionLink?.trim() || t.templateSiteAsset?.url?.trim() || null;

/* =========================================================
   Small UI bits
   ========================================================= */
function StepPill({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${
        className ? className + " " : ""
      }px-2.5 py-1 rounded-full text-sm font-medium ${
        active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, string> = {
    pending: "bg-slate-200 text-slate-700",
    in_progress: "bg-blue-100 text-blue-800",
    overdue: "bg-rose-100 text-rose-800",
    reassigned: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    qc_approved: "bg-purple-100 text-purple-800",
    cancelled: "bg-slate-300 text-slate-700",
  };
  return (
    <Badge className={`${map[status]} border-none`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

/* =========================================================
   Social Communication Modal Types
   ========================================================= */
const SC_TYPES = ["like", "comment", "follow", "share"] as const;
type SCRow = { type: (typeof SC_TYPES)[number]; url: string; notes: string };
const makeEmptyRow = (): SCRow => ({ type: "like", url: "", notes: "" });

/* =========================================================
   Page Component
   ========================================================= */
export default function SocialCommunicationTasksPage() {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [clientFilter, setClientFilter] = useState<
    "all" | "no-client" | string
  >("all");

  // Modal state
  const [open, setOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<SCRow[]>(
    Array.from({ length: 5 }, makeEmptyRow)
  );
  const [submitting, setSubmitting] = useState(false);

  // password reveal per-card
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [agentId, setAgentId] = useState<string | null>(null);

  /* ---------------- Fetch tasks (SC category only) ---------------- */
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        // who am I?
        const sessRes = await fetch("/api/auth/me", {
          cache: "no-store",
        });
        const sess = await sessRes.json();
        const agentId = sess?.user?.id as string | undefined;
        if (!agentId) throw new Error("No active session");
        setAgentId(agentId); // 👈 store for later PATCH

        // fetch this agent’s tasks
        const res = await fetch(
          `/api/tasks/agents/${agentId}?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );
        if (!res.ok) throw new Error("Failed to fetch agent tasks");
        const payload = await res.json();

        // hard-filter to Social Communication
        // ✅ NEW:
        const rawList: any[] = (payload?.tasks ?? payload ?? []) as any[];

        // normalize: bring assignment.client up to task.client (so UI's t.client?.name works)
        const normalizedFromAPI: Task[] = rawList.map((t: any) => {
          const client =
            t.client ??
            t.assignment?.client ??
            (t.clientId
              ? { id: t.clientId as string, name: t.clientName ?? null }
              : null);

          const category =
            t.category ??
            (t.categoryName
              ? { id: t.categoryId ?? "unknown", name: t.categoryName }
              : null);

          const templateSiteAsset =
            t.templateSiteAsset ??
            (t.siteAssetId || t.siteAssetUrl
              ? {
                  id: Number(t.siteAssetId ?? 0),
                  name: t.siteAssetName ?? "",
                  type: t.siteAssetType ?? "",
                  url: t.siteAssetUrl ?? null,
                }
              : null);

          // keep existing fields; leave others as-is
          return {
            id: t.id,
            name: t.name,
            status: t.status,
            dueDate: t.dueDate ?? null,
            idealDurationMinutes: t.idealDurationMinutes ?? null,
            client, // 👈 flattened for UI
            category, // 👈 ensure category object exists
            username: t.username ?? null,
            email: t.email ?? null,
            password: t.password ?? null,
            completionLink: t.completionLink ?? null,
            templateSiteAsset, // 👈 keep URL source if available
            completedAt: t.completedAt ?? null,
            nextEligibleAt: t.nextEligibleAt ?? null,
          } as Task;
        });

        // now hard-filter to Social Communication using your existing helper
        const onlySC = normalizedFromAPI.filter(isSocialCommunication);

        // normalize repeat info
        const normalized: Task[] = onlySC.map((t) => {
          const completedAt =
            t.completedAt ??
            (t.status === "completed" ? (t as any).completedAt ?? null : null);

          // compute nextEligibleAt if not provided
          let nextEligibleAt = t.nextEligibleAt ?? null;
          if (completedAt) {
            const base = startOfDayISO(new Date(completedAt));
            nextEligibleAt = addDaysISO(base, SC_COOLDOWN_DAYS);
          }

          return {
            ...t,
            completedAt: completedAt ?? null,
            nextEligibleAt,
          };
        });

        if (!mounted) return;

        // auto-flip back to pending when cooldown passed
        const now = new Date();
        const refreshed = normalized.map((t) => {
          if (t.nextEligibleAt && new Date(t.nextEligibleAt) <= now) {
            return {
              ...t,
              status: t.status === "completed" ? "pending" : t.status,
            };
          }
          return t;
        });

        setTasks(refreshed);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load Social Communication tasks for you.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------------- Filtering ---------------- */
  // Unique client list (from SC tasks only)
  const clientOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();

    (tasks || []).filter(isSocialCommunication).forEach((t) => {
      const id = t.client?.id || "";
      const name = (t.client?.name ?? "").trim() || "(No Client)";
      const key = id || "__no_client__";
      if (!map.has(key)) map.set(key, { id, name, count: 0 });
      map.get(key)!.count += 1;
    });

    // Sort: named clients A→Z, keep "(No Client)" at bottom
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.id === "" && b.id !== "") return 1;
      if (b.id === "" && a.id !== "") return -1;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return (tasks || []).filter(isSocialCommunication).filter((t) => {
      const okStatus =
        statusFilter === "all" ? true : (t as any).status === statusFilter;

      // client filter
      const okClient =
        clientFilter === "all"
          ? true
          : clientFilter === "no-client"
          ? !t.client?.id
          : t.client?.id === clientFilter;

      const hay = `${t.name} ${t.client?.name ?? ""}`.toLowerCase();
      const okQuery = !q || hay.includes(q);

      return okStatus && okClient && okQuery;
    });
  }, [tasks, query, statusFilter, clientFilter]);

  /* ---------------- Stats ---------------- */
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      completedToday: tasks.filter((t) => isToday(t.completedAt)).length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      overdue: tasks.filter((t) => t.status === "overdue").length,
      qcApproved: tasks.filter((t) => t.status === "qc_approved").length,
    };
  }, [tasks]);

  /* ---------------- Modal handlers ---------------- */
  const openForTask = (t: Task) => {
    setCurrentTask(t);
    setRows(Array.from({ length: 5 }, makeEmptyRow));
    setStep(1);
    setOpen(true);
  };

  const setRow = (i: number, patch: Partial<SCRow>) =>
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  const addRow = () => setRows((r) => [...r, makeEmptyRow()]);
  const removeRow = (i: number) =>
    setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));

  const entries = rows
    .filter((r) => r.url.trim() && isHttpUrl(r.url))
    .map((r) => ({
      type: r.type,
      url: r.url.trim(),
      notes: r.notes.trim(),
      submittedAt: new Date().toISOString(),
    }));

  const canNextFrom2 = entries.length > 0;

  const submitAndComplete = async () => {
    if (!currentTask) return;
    if (!entries.length) {
      toast.error("Please add at least one valid URL");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Save entries (your provided API)
      const save = await fetch(
        `/api/tasks/${currentTask.id}/social-communications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        }
      );
      const saveJson = await save.json().catch(() => ({}));
      if (!save.ok)
        throw new Error(saveJson?.message || "Failed to save links");

      // 2) Mark task completed (PATCH via agent endpoint)
      if (!agentId) throw new Error("No agent id");
      const firstUrl = entries[0]?.url ?? null;
      const nowISO = new Date().toISOString();

      const patch = await fetch(`/api/tasks/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: currentTask.id,
          status: "completed",
          completedAt: nowISO,
          completionLink: firstUrl, // 👈 store the link on the task
        }),
      });
      const patchJson = await patch.json().catch(() => ({}));
      if (!patch.ok)
        throw new Error(patchJson?.message || "Failed to complete task");

      toast.success("Saved & task completed");
      setOpen(false);

      // 3) Local cooldown update (5 days) so UI reflects immediately
      const nextISO = addDaysISO(
        startOfDayISO(new Date(nowISO)),
        SC_COOLDOWN_DAYS
      );
      setTasks((prev) =>
        prev.map((x) =>
          x.id === currentTask.id
            ? {
                ...x,
                status: "completed",
                completedAt: nowISO,
                nextEligibleAt: nextISO,
                completionLink: firstUrl, // 👈 reflect on the card
              }
            : x
        )
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Utils: copy + reveal ---------------- */
  const copy = async (label: string, value?: string | null) => {
    if (!value) {
      toast.error(`No ${label} to copy`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const copyAllCreds = async (t: Task) => {
    const u = t.username?.trim() || "";
    const e = t.email?.trim() || "";
    const p = t.password?.trim() || "";
    const target = primaryUrl(t) || "";
    const blob = [
      u ? `Username: ${u}` : null,
      e ? `Email: ${e}` : null,
      p ? `Password: ${p}` : null,
      target ? `URL: ${target}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (!blob) {
      toast.error("No credentials to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(blob);
      toast.success("Credentials copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-4 lg:p-8">
      <div className="space-y-8 w-full max-w-[100vw] overflow-x-hidden">
        {/* Header (demo-style) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Social Communication
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Like • Comment • Follow • Share
            </p>
          </div>
          <Button
            onClick={() => location.reload()}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 bg-transparent"
            title="Refresh"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Refresh
          </Button>
        </div>

        {/* Stats — 5 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">
                Total Tasks
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <p className="text-xs text-blue-100 mt-1">All SC tasks</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">
                Completed Today
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.completedToday}
              </div>
              <p className="text-xs text-emerald-100 mt-1">Today’s submits</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-100">
                In Progress
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M8 5v14l11-7L8 5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.inProgress}
              </div>
              <p className="text-xs text-amber-100 mt-1">Working now</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-100">
                Overdue
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 8v5l3 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.overdue}
              </div>
              <p className="text-xs text-red-100 mt-1">Needs attention</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">
                QC Approved
              </CardTitle>
              <div className="p-2 bg-white/20 rounded-lg">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">
                {stats.qcApproved}
              </div>
              <p className="text-xs text-purple-100 mt-1">Approved</p>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Search (1/2 width on md+) */}
              <div className="md:col-span-2 w-full">
                <div className="relative">
                  <Input
                    placeholder="Search by task/client..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11 pl-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
                  />
                  <ListFilter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Status (1/4 width on md+) */}
              <div className="md:col-span-1 w-full">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as any)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="reassigned">Reassigned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="qc_approved">QC Approved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Client (1/4 width on md+) */}
              <div className="md:col-span-1 w-full">
                <Select
                  value={clientFilter}
                  onValueChange={(v) => setClientFilter(v as any)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Filter by client" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg max-h-72 w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="all">All Clients</SelectItem>
                    {clientOptions.some((c) => !c.id) && (
                      <SelectItem value="no-client">
                        (No Client)
                        {(() => {
                          const c = clientOptions.find((x) => !x.id);
                          return c ? ` • ${c.count}` : "";
                        })()}
                      </SelectItem>
                    )}
                    {clientOptions
                      .filter((c) => !!c.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} • {c.count}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center text-slate-500">
              No Social Communication tasks found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((t) => {
              // compute availability (client-side guard)
              const nextAt =
                t.nextEligibleAt ??
                (t.completedAt
                  ? addDaysISO(
                      startOfDayISO(new Date(t.completedAt)),
                      SC_COOLDOWN_DAYS
                    )
                  : null);
              const locked = !!nextAt && new Date(nextAt) > new Date();
              const daysLeft = daysUntil(nextAt);

              const url = primaryUrl(t);

              const credsMissing = !t.username && !t.email && !t.password;

              return (
                <Card
                  key={t.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
                >
                  {/* subtle top accent bar */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-80" />

                  <CardHeader className="pb-3 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col">
                        <CardTitle className="truncate text-[15px] font-semibold leading-6 text-slate-900">
                          {t.name}
                        </CardTitle>

                        <CardDescription className="mt-1 flex items-center gap-2">
                          {t.client?.name ? (
                            <>
                              <span className="text-slate-500">Client</span>
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-teal-100 px-2.5 py-[2px] text-xs font-medium text-slate-700">
                                {t.client.name}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-[2px] text-xs font-medium text-amber-800">
                              No client
                            </span>
                          )}
                        </CardDescription>
                      </div>

                      {/* status badge pinned right */}
                      <div className="shrink-0">
                        <StatusBadge status={locked ? "completed" : t.status} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* info row */}
                    <div className="mb-3 grid grid-cols-1 gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                          Due
                        </span>
                        <span className="font-medium">
                          {t.dueDate ? format(new Date(t.dueDate), "PPP") : "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-start gap-2 sm:justify-end">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                          Ideal
                        </span>
                        {t.idealDurationMinutes ? (
                          <span className="font-medium">
                            {t.idealDurationMinutes}m
                          </span>
                        ) : (
                          <span className="text-slate-400">No timer</span>
                        )}
                      </div>
                    </div>

                    {/* cooldown banner */}
                    {locked && (
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                        Completed today. Available again in <b>{daysLeft}</b>{" "}
                        day
                        {daysLeft !== 1 ? "s" : ""}.
                      </div>
                    )}

                    {/* divider */}
                    <div className="my-3 h-px w-full bg-slate-100" />

                    {/* credentials */}
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">
                          Agent Access
                        </div>
                        <Badge
                          className={`${
                            credsMissing
                              ? "border-none bg-amber-100 text-amber-800"
                              : "border-none bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {credsMissing ? "Missing" : "Ready"}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-12 gap-3">
                        {/* Username */}
                        <div className="col-span-12 md:col-span-6">
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Username
                          </label>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={t.username ?? ""}
                              placeholder="—"
                              className="bg-slate-50 text-[13px]"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copy("Username", t.username)}
                              title="Copy username"
                              className="hover:border-slate-300"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Email */}
                        <div className="col-span-12 md:col-span-6">
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Email
                          </label>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={t.email ?? ""}
                              placeholder="—"
                              className="bg-slate-50 text-[13px]"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copy("Email", t.email)}
                              title="Copy email"
                              className="hover:border-slate-300"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Password */}
                        <div className="col-span-12 md:col-span-6">
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            Password
                          </label>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              type={showPw[t.id] ? "text" : "password"}
                              value={t.password ?? ""}
                              placeholder="—"
                              className="bg-slate-50 text-[13px]"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setShowPw((m) => ({ ...m, [t.id]: !m[t.id] }))
                              }
                              title={
                                showPw[t.id] ? "Hide password" : "Show password"
                              }
                              className="hover:border-slate-300"
                            >
                              {showPw[t.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copy("Password", t.password)}
                              title="Copy password"
                              className="hover:border-slate-300"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Primary URL */}
                        <div className="col-span-12 md:col-span-6">
                          <label className="mb-1 block text-[11px] font-medium text-slate-600">
                            URL
                          </label>
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={url ?? ""}
                              placeholder="—"
                              className="bg-slate-50 text-[13px]"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copy("URL", url)}
                              title="Copy URL"
                              className="hover:border-slate-300"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Link
                              href={url || "#"}
                              target="_blank"
                              className="pointer-events-auto"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={!url}
                                title={url ? "Open link" : "No URL"}
                                className="hover:border-slate-300"
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* actions */}
                    <div className="mt-4 flex gap-2">
                      <Button
                        className="flex-1 rounded-xl py-5 bg-teal-600 font-semibold shadow-sm hover:bg-teal-700 hover:shadow"
                        onClick={() => openForTask(t)}
                        disabled={locked || t.status === "qc_approved"}
                        title={
                          locked
                            ? `Available in ${daysLeft} day${
                                daysLeft !== 1 ? "s" : ""
                              }`
                            : undefined
                        }
                      >
                        {locked ? "Cooling Down" : "Submit Links"}
                      </Button>

                      <Link
                        href={`/agent/social-activity/${t.id}`}
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-slate-300 bg-white font-semibold hover:border-slate-400"
                        >
                          Open Task
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal: 3-step wizard (UI-only refresh; logic unchanged) */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[95vh] p-0 overflow-hidden rounded-xl border shadow-xl">
            <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-100 p-6 border-b border-slate-200">
              <DialogHeader className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                    <span className="font-semibold text-lg text-slate-700">
                      SC
                    </span>
                  </div>
                  <DialogTitle className="text-2xl font-semibold text-slate-800">
                    {currentTask?.name || "Social Communication"}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-slate-600 leading-relaxed">
                  Add Like / Comment / Follow / Share links. Starts with{" "}
                  <span className="font-medium text-slate-700">5 inputs</span>{" "}
                  by default.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pt-4 pb-3 bg-white border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <StepPill
                  active={step === 1}
                  className="data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=false]:bg-slate-100 data-[active=false]:text-slate-600"
                >
                  1. Overview
                </StepPill>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <StepPill
                  active={step === 2}
                  className="data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=false]:bg-slate-100 data-[active=false]:text-slate-600"
                >
                  2. Add Links
                </StepPill>
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <StepPill
                  active={step === 3}
                  className="data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=false]:bg-slate-100 data-[active=false]:text-slate-600"
                >
                  3. Review
                </StepPill>
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-6 space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      This task opens with <strong>5 input rows</strong>. You
                      can add or remove rows anytime.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Use{" "}
                      <span className="font-medium text-slate-800">
                        Add Row
                      </span>{" "}
                      to include more links, or{" "}
                      <span className="font-medium text-slate-800">Remove</span>{" "}
                      to keep it tidy.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-slate-700 text-white text-xs flex items-center justify-center font-semibold">
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold text-slate-800">
                            Link Item
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRow(i)}
                          className="h-8 px-3 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-3">
                          <Select
                            value={row.type}
                            onValueChange={(v) =>
                              setRow(i, { type: v as SCRow["type"] })
                            }
                          >
                            <SelectTrigger className="h-9 text-xs border-slate-200 focus:border-slate-300">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {SC_TYPES.map((t) => (
                                <SelectItem
                                  key={t}
                                  value={t}
                                  className="text-xs"
                                >
                                  {t[0].toUpperCase() + t.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                          <Input
                            placeholder="https://…"
                            value={row.url}
                            onChange={(e) => setRow(i, { url: e.target.value })}
                            className={`h-9 text-xs border-slate-200 focus:border-slate-300 ${
                              !row.url || isHttpUrl(row.url)
                                ? ""
                                : "border-red-400 focus:border-red-400"
                            }`}
                          />
                          {!!row.url && !isHttpUrl(row.url) && (
                            <div className="text-[11px] text-red-600 mt-1.5">
                              Enter a valid URL
                            </div>
                          )}
                        </div>

                        <div className="col-span-12 md:col-span-3">
                          <Input
                            value={row.notes}
                            onChange={(e) =>
                              setRow(i, { notes: e.target.value })
                            }
                            placeholder="Notes (optional)"
                            className="h-9 text-xs border-slate-200 focus:border-slate-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRow}
                      className="h-9 text-xs border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Row
                    </Button>
                    <div className="text-xs text-slate-500">
                      At least one valid URL required
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-sm text-emerald-800 leading-relaxed">
                      <strong>{entries.length}</strong> valid link
                      {entries.length !== 1 ? "s" : ""} ready to submit.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
                    {entries.map((e, idx) => (
                      <div key={idx} className="p-4 text-sm">
                        <div className="font-semibold capitalize text-slate-800 mb-1">
                          {e.type}
                        </div>
                        <div className="truncate text-slate-600 text-xs mb-1">
                          {e.url}
                        </div>
                        {e.notes && (
                          <div className="text-slate-500 text-xs">
                            {e.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))
                }
                disabled={step === 1}
                className="h-10 text-xs border-slate-300 hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Back
              </Button>

              {step < 3 ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setStep((s) => (s === 3 ? s : ((s + 1) as 1 | 2 | 3)))
                  }
                  disabled={step === 2 && !canNextFrom2}
                  className="h-10 text-xs bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50"
                >
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={submitAndComplete}
                  disabled={submitting || entries.length === 0}
                  className="h-10 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Save & Complete"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
