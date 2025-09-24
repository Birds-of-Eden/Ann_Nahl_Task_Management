"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  ListChecks,
  FileText,
  MessageSquare,
  Bell,
  Users,
  Share2,
  Info,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
// If you have shadcn Separator/Badge, you can uncomment these:
// import { Separator } from "@/components/ui/separator";
// import { Badge } from "@/components/ui/badge";

type Counts = {
  assignments: number;
  tasks: number;
  comments: number;
  reports: number;
  notifications: number;
  assignmentSiteAssetSettings: number;
  socialMedia: number;
  clientTeamMembers: number;
};

interface DangerDeleteClientModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  onConfirm: () => Promise<void> | void; // call your delete handler here
  isDeleting?: boolean;
}

export default function DangerDeleteClientModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  onConfirm,
  isDeleting,
}: DangerDeleteClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canDelete = useMemo(
    () => ack && typed.trim() === clientName.trim(),
    [ack, typed, clientName]
  );

  useEffect(() => {
    if (!open) return;

    // Reset state per open
    setAck(false);
    setTyped("");
    setError(null);

    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}/deletion-preview`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!active) return;
        setCounts(data.counts as Counts);
        // Focus the confirm input once preview loads
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch (e: any) {
        const msg =
          typeof e?.message === "string"
            ? e.message
            : "Failed to load deletion preview";
        setError(msg);
        toast.error(msg);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [open, clientId]);

  const items: Array<{
    key: keyof Counts;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    tone:
      | "cyan"
      | "blue"
      | "amber"
      | "rose"
      | "indigo"
      | "violet"
      | "slate"
      | "emerald";
    hint?: string;
  }> = [
    {
      key: "assignments",
      label: "Assignments",
      icon: ListChecks,
      tone: "indigo",
    },
    { key: "tasks", label: "Tasks", icon: FileText, tone: "blue" },
    { key: "comments", label: "Comments", icon: MessageSquare, tone: "slate" },
    { key: "reports", label: "Reports", icon: FileText, tone: "emerald" },
    { key: "notifications", label: "Notifications", icon: Bell, tone: "amber" },
    {
      key: "assignmentSiteAssetSettings",
      label: "Assignment Site-Asset Settings",
      icon: Share2,
      tone: "violet",
    },
    {
      key: "socialMedia",
      label: "Social Profiles",
      icon: Share2,
      tone: "cyan",
    },
    {
      key: "clientTeamMembers",
      label: "Client Team Members",
      icon: Users,
      tone: "rose",
    },
  ];

  const totalToDelete = useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  }, [counts]);

  const toneMap: Record<string, string> = {
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };

  const exportJSON = () => {
    try {
      const payload = {
        client: clientName,
        clientId,
        generatedAt: new Date().toISOString(),
        counts: counts ?? {},
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deletion-preview_${clientName.replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export JSON");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          sm:max-w-3xl p-0 overflow-hidden
          rounded-2xl
          border border-rose-100
          shadow-2xl
        "
      >
        {/* Decorative danger header */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <DialogTitle className="text-white text-lg font-semibold tracking-tight">
                Delete Client: {clientName}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                This action cannot be undone. Review what will be deleted below.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Callout */}
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3">
            <div className="mt-0.5 rounded-lg bg-rose-100 p-1.5">
              <Info className="h-4 w-4 text-rose-700" />
            </div>
            <div className="text-sm text-rose-900">
              Cascading deletion will remove the client and all linked records.
              Consider exporting reports or data before continuing.
            </div>
          </div>

          {/* Quick totals + export */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-700">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-gray-300" />
                  Loading deletion preview…
                </span>
              ) : error ? (
                <span className="text-rose-700">{error}</span>
              ) : (
                <>
                  <span className="font-medium text-gray-900">
                    {totalToDelete}
                  </span>{" "}
                  total related records will be removed.
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportJSON}
                disabled={loading || !!error || !counts}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>

          {/* Items grid */}
          <ScrollArea className="max-h-64 rounded-xl border bg-white">
            <div className="p-3">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl border border-gray-100 bg-gray-50 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map(({ key, label, icon: Icon, tone }) => {
                    const n = (counts as any)?.[key] ?? 0;
                    return (
                      <div
                        key={key}
                        className="
                          group relative overflow-hidden rounded-xl border border-gray-100
                          bg-white p-3 transition hover:shadow-md
                        "
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={[
                              "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1",
                              toneMap[tone],
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900 leading-none">
                              {n}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {label}
                            </div>
                          </div>
                        </div>
                        {/* subtle gradient accent */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Confirmation controls */}
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <Checkbox
                checked={ack}
                onCheckedChange={(v) => setAck(Boolean(v))}
                aria-label="Acknowledge permanent deletion"
              />
              <span>
                I understand this is{" "}
                <span className="font-semibold">permanent</span> and cannot be
                undone.
              </span>
            </label>

            <div className="space-y-1">
              <label htmlFor="confirm-name" className="text-sm text-gray-700">
                Type <span className="font-semibold">{clientName}</span> to
                confirm
                <span className="text-gray-400"> (case-sensitive)</span>:
              </label>
              <Input
                id="confirm-name"
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={clientName}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={ack && typed.length > 0 && !canDelete}
              />
              <p className="text-[11px] text-gray-500">
                Tip: Press{" "}
                <kbd className="rounded bg-gray-100 px-1 py-0.5 text-[10px] border">
                  Enter
                </kbd>{" "}
                to delete when enabled.
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting} // disable cancel while deleting
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!canDelete || isDeleting) return;
                await onConfirm(); // parent toggles isDeleting
              }}
              disabled={!canDelete || isDeleting}
              className="bg-gradient-to-r from-rose-600 to-red-600
               hover:from-rose-700 hover:to-red-700
               text-white shadow"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting…" : "Delete Client"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
