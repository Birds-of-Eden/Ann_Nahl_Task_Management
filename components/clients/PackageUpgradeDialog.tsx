// components/clients/PackageUpgradeDialog.tsx
// Uses your existing /api/zisanpackages route (no new API needed)

"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  ShieldCheck,
  TrendingUp,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ZisanPackage = {
  id: string;
  name: string;
  description: string | null;
  totalMonths: number | null;
  createdAt: string;
  updatedAt: string;
  // when include=stats
  stats?: {
    clients: number;
    templates: number;
    activeTemplates: number;
    sitesAssets: number;
    teamMembers: number;
    assignments: number;
    tasks: number;
  };
};

function money(n: number | null | undefined) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n}`;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  currentPackageId?: string | null;
  onUpgraded?: () => void;
}

export default function PackageUpgradeDialog({
  open,
  onOpenChange,
  clientId,
  currentPackageId,
  onUpgraded,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [packages, setPackages] = React.useState<ZisanPackage[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);

  // toggles
  const [createAssignments, setCreateAssignments] = React.useState(true);
  const [migrateCompleted, setMigrateCompleted] = React.useState(true);
  const [createPostingTasks, setCreatePostingTasks] = React.useState(true);

  React.useEffect(() => {
    if (!open) return;
    const run = async () => {
      try {
        setFetching(true);
        // use your existing endpoint with stats payload
        const url = new URL(`/api/zisanpackages`, window.location.origin);
        url.searchParams.set("include", "stats");
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch packages");
        const data: ZisanPackage[] = await res.json();

        // client-side exclude current package + simple search filter
        const q = query.trim().toLowerCase();
        const filtered = data
          .filter((p) => p.id !== (currentPackageId || "")) // exclude current
          .filter((p) =>
            !q
              ? true
              : p.name?.toLowerCase().includes(q) ||
                (p.description ?? "").toLowerCase().includes(q)
          )
          // a neat sort for UX (active template-rich packages first)
          .sort(
            (a, b) =>
              (b.stats?.activeTemplates ?? 0) - (a.stats?.activeTemplates ?? 0)
          );

        setPackages(filtered);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Could not load packages");
      } finally {
        setFetching(false);
      }
    };
    run();
  }, [open, query, currentPackageId]);

  const handleConfirm = async () => {
    if (!selected) {
      toast.error("Please select a package to upgrade.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upgrade",
          newPackageId: selected,
          createAssignments,
          migrateCompleted, // include completed/QC/data_entered into new package
          createPostingTasks, // auto-generate posting tasks per new package
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Upgrade failed");
      toast.success("Package upgraded successfully.");
      onOpenChange(false);
      onUpgraded?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to upgrade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            Upgrade Client Package
          </DialogTitle>
          <DialogDescription>
            Pick a new package. Completed work from the old package can be
            included automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search packages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-1">
              <Badge variant="outline">
                {fetching ? "Loading..." : `${packages.length} found`}
              </Badge>
            </div>
          </div>

          <ScrollArea className="h-72 rounded-md border">
            <div className="divide-y">
              {packages.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  No other packages available.
                </div>
              )}

              {packages.map((p) => {
                const isSelected = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-cyan-50/60 transition-colors",
                      isSelected && "bg-cyan-50 ring-1 ring-cyan-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-cyan-600" />
                          <span className="font-semibold">{p.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {p.description || "No description"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge variant="secondary" className="text-xs">
                            Months: {p.totalMonths ?? "—"}
                          </Badge>
                          {p.stats && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                Templates: {p.stats.templates}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Active: {p.stats.activeTemplates}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Assets: {p.stats.sitesAssets}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Team: {p.stats.teamMembers}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Tasks: {p.stats.tasks}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Price not in this API; keep placeholder or remove */}
                      <div className="text-right">
                        <div className="text-base font-semibold">
                          {money(null)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          plan
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                checked={createAssignments}
                onCheckedChange={(v) => setCreateAssignments(Boolean(v))}
              />
              <div className="text-sm">
                <div className="font-medium flex items-center gap-1">
                  Create assignments{" "}
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="text-muted-foreground text-xs">
                  Add assignments for the new package templates.
                </div>
              </div>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                checked={migrateCompleted}
                onCheckedChange={(v) => setMigrateCompleted(Boolean(v))}
              />
              <div className="text-sm">
                <div className="font-medium">Include completed work</div>
                <div className="text-muted-foreground text-xs">
                  Copy done tasks from old package.
                </div>
              </div>
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                checked={createPostingTasks}
                onCheckedChange={(v) => setCreatePostingTasks(Boolean(v))}
              />
              <div className="text-sm">
                <div className="font-medium">Auto-create posting tasks</div>
                <div className="text-muted-foreground text-xs">
                  Generate tasks per new plan.
                </div>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selected}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upgrade Package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
