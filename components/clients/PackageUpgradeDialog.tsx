// components/clients/PackageUpgradeDialog.tsx
"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  ShieldCheck,
  TrendingUp,
  Search,
  LayoutTemplate,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ZisanPackage = {
  id: string;
  name: string;
  description: string | null;
  totalMonths: number | null;
  createdAt: string;
  updatedAt: string;
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

type Template = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  packageId: string;
  _count?: { sitesAssets: number; templateTeamMembers: number };
};

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
  const [fetchingPkgs, setFetchingPkgs] = React.useState(false);
  const [fetchingTpls, setFetchingTpls] = React.useState(false);
  const [packages, setPackages] = React.useState<ZisanPackage[]>([]);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedPackageId, setSelectedPackageId] = React.useState<
    string | null
  >(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    string | null
  >(null);

  // current client snapshot
  const [clientSnapshot, setClientSnapshot] = React.useState<any | null>(null);
  const [currentPackage, setCurrentPackage] = React.useState<any | null>(null);
  const [tasksByCategory, setTasksByCategory] = React.useState<
    Record<string, any[]>
  >({});

  // template/asset comparison
  const [newTemplateDetails, setNewTemplateDetails] = React.useState<
    any | null
  >(null);
  const [assetComparison, setAssetComparison] = React.useState<{
    common: { id?: any; name: string; type: string }[];
    onlyInNew: { id?: any; name: string; type: string }[];
  } | null>(null);

  // toggles
  const [createAssignments, setCreateAssignments] = React.useState(true);
  const [migrateCompleted, setMigrateCompleted] = React.useState(true);
  const [createPostingTasks, setCreatePostingTasks] = React.useState(true);

  // load packages
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setFetchingPkgs(true);
        const url = new URL(`/api/zisanpackages`, window.location.origin);
        url.searchParams.set("include", "stats");
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch packages");
        const data: ZisanPackage[] = await res.json();

        const q = query.trim().toLowerCase();
        const filtered = data
          .filter((p) => p.id !== (currentPackageId || "")) // exclude current
          .filter((p) =>
            !q
              ? true
              : p.name?.toLowerCase().includes(q) ||
                (p.description ?? "").toLowerCase().includes(q)
          )
          .sort(
            (a, b) =>
              (b.stats?.activeTemplates ?? 0) - (a.stats?.activeTemplates ?? 0)
          );
        setPackages(filtered);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Could not load packages");
      } finally {
        setFetchingPkgs(false);
      }
    })();
  }, [open, query, currentPackageId]);

  // load current client (package, tasks grouped by category)
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load client details");
        const data = await res.json();
        setClientSnapshot(data);
        setCurrentPackage(data?.package || null);
        // group tasks by category name
        const groups: Record<string, any[]> = {};
        (data?.tasks || []).forEach((t: any) => {
          const cat = t?.category?.name || "Uncategorized";
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(t);
        });
        setTasksByCategory(groups);
      } catch (e: any) {
        console.error(e);
        toast.error(
          e?.message || "Unable to load client's current package/tasks"
        );
      }
    })();
  }, [open, clientId]);

  // load templates for selected package
  React.useEffect(() => {
    if (!open) return;
    if (!selectedPackageId) {
      setTemplates([]);
      setSelectedTemplateId(null);
      setNewTemplateDetails(null);
      setAssetComparison(null);
      return;
    }
    (async () => {
      try {
        setFetchingTpls(true);
        const url = new URL(`/api/packages/templates`, window.location.origin);
        url.searchParams.set("packageId", selectedPackageId);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch templates");
        const data: Template[] = await res.json();
        setTemplates(data);
        setSelectedTemplateId(null);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Could not load templates");
      } finally {
        setFetchingTpls(false);
      }
    })();
  }, [open, selectedPackageId]);

  // when a template is selected, fetch details and compute asset comparison
  React.useEffect(() => {
    if (!open) return;
    if (!selectedTemplateId) {
      setNewTemplateDetails(null);
      setAssetComparison(null);
      return;
    }
    (async () => {
      try {
        // fetch template details with sitesAssets
        const res = await fetch(`/api/templates/${selectedTemplateId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load template details");
        const tpl = await res.json();
        setNewTemplateDetails(tpl);

        // collect existing assets from client's current assignments/templates
        const oldAssets: { name: string; type: string }[] = [];
        const seenKey = new Set<string>();
        const norm = (s: string | null | undefined) =>
          String(s ?? "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        const keyOf = (a: { name: string; type: string }) =>
          `${norm(a.type)}::${norm(a.name)}`;
        try {
          const c = clientSnapshot;
          if (c?.assignments?.length) {
            for (const asn of c.assignments) {
              const pkgId = asn?.template?.packageId;
              if (currentPackageId && pkgId !== currentPackageId) continue;
              const assets = asn?.template?.sitesAssets || [];
              for (const a of assets) {
                const rec = {
                  name: a?.name || "",
                  type: a?.type || "",
                } as { name: string; type: string };
                const k = keyOf(rec);
                if (!seenKey.has(k)) {
                  seenKey.add(k);
                  oldAssets.push(rec);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Failed to scan current assets", e);
        }

        const newAssets: { id?: any; name: string; type: string }[] = (
          tpl?.sitesAssets || []
        ).map((a: any) => ({
          id: a.id,
          name: a.name || "",
          type: a.type || "",
        }));
        const oldKeys = new Set(oldAssets.map((a) => keyOf(a)));
        const common = newAssets.filter((a) => oldKeys.has(keyOf(a)));
        const onlyInNew = newAssets.filter((a) => !oldKeys.has(keyOf(a)));
        setAssetComparison({ common, onlyInNew });
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Failed to prepare asset comparison");
        setNewTemplateDetails(null);
        setAssetComparison(null);
      }
    })();
  }, [open, selectedTemplateId, clientSnapshot, currentPackageId]);

  const handleConfirm = async () => {
    if (!selectedPackageId) return toast.error("Please select a package.");
    if (!selectedTemplateId) return toast.error("Please select a template.");

    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upgrade",
          newPackageId: selectedPackageId,
          templateId: selectedTemplateId, // ✅ send selected template
          createAssignments,
          migrateCompleted, // copy done tasks from old package
          createPostingTasks, // auto-generate tasks for non-common assets of this template
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || "Upgrade failed");
      toast.success("Package upgraded successfully.");

      if (j?.createdPosting != null) {
        toast.success(`Posting tasks created/filled: ${j.createdPosting}`);
      }
      // If the new package has more months than the old one, generate remaining month's tasks
      try {
        const oldMonths =
          Number(clientSnapshot?.package?.totalMonths ?? 0) || 0;
        const newMonths =
          Number(
            packages.find((p) => p.id === selectedPackageId)?.totalMonths ?? 0
          ) || 0;
        if (newMonths > oldMonths) {
          const r = await fetch(
            `/api/tasks/remain-tasks-create-and-distrubution`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId }),
            }
          );
          const jr = await r.json().catch(() => ({}));
          if (r.ok) {
            toast.success(
              `Created ${
                jr?.created ?? 0
              } extra task(s) for the additional month(s).`
            );
          } else {
            console.warn("Remaining tasks creation failed", jr);
          }
        }
      } catch (ee) {
        console.warn("Post-upgrade remaining task creation failed", ee);
      }
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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            Upgrade Client Package
          </DialogTitle>
          <DialogDescription>
            Pick a new package, then choose a template under that package.
            Completed work from the old package can be included automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current package & tasks overview */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Current Package & Tasks
            </div>
            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">
                  Package: {currentPackage?.name ?? "—"}
                </Badge>
                <Badge variant="outline">
                  Months: {currentPackage?.totalMonths ?? "—"}
                </Badge>
                <Badge variant="outline">
                  Tasks:{" "}
                  {clientSnapshot?.taskCounts?.total ??
                    clientSnapshot?.tasks?.length ??
                    0}
                </Badge>
                <Badge variant="outline">
                  Progress: {clientSnapshot?.progress ?? 0}%
                </Badge>
              </div>
              <div className="mt-3">
                <Accordion type="multiple" className="w-full">
                  {Object.keys(tasksByCategory).length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      No tasks found.
                    </div>
                  )}
                  {Object.entries(tasksByCategory).map(([cat, items]) => (
                    <AccordionItem key={cat} value={cat}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {items.length} tasks
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="max-h-40 overflow-auto space-y-1">
                          {items.map((t: any) => (
                            <div
                              key={t.id}
                              className="text-xs flex items-center justify-between border rounded px-2 py-1"
                            >
                              <span className="truncate mr-2">{t.name}</span>
                              <span className="text-muted-foreground">
                                {t.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </div>
          {/* Package picker */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Badge variant="outline">
                {fetchingPkgs ? "Loading..." : `${packages.length} found`}
              </Badge>
            </div>

            {selectedPackageId && currentPackage?.totalMonths != null && (
              <div className="text-[11px] text-muted-foreground pl-1">
                Months change: {String(currentPackage.totalMonths ?? 0)} →{" "}
                {String(
                  packages.find((p) => p.id === selectedPackageId)
                    ?.totalMonths ?? "—"
                )}{" "}
                (missing cycles will be auto-created)
              </div>
            )}

            <ScrollArea className="h-40 rounded-md border">
              <div className="divide-y">
                {packages.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">
                    No other packages available.
                  </div>
                )}
                {packages.map((p) => {
                  const isSelected = selectedPackageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPackageId(p.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-cyan-50/60 transition-colors",
                        isSelected && "bg-cyan-50 ring-1 ring-cyan-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4 text-cyan-600" />
                            {p.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.description || "—"}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <Badge variant="secondary" className="text-xs">
                              Months: {p.totalMonths ?? "—"}
                            </Badge>
                            {!!p.stats && (
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
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Asset comparison section */}
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Asset Comparison (old vs selected template)
            </div>
            {!selectedTemplateId && (
              <div className="p-3 text-xs text-muted-foreground border rounded-md">
                Select a template to preview asset differences.
              </div>
            )}
            {selectedTemplateId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium mb-2">Common Assets</div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {assetComparison?.common?.length ? (
                      assetComparison.common.map((a) => (
                        <div
                          key={`${a.type}:${a.name}`}
                          className="text-xs flex items-center justify-between border rounded px-2 py-1"
                        >
                          <span className="truncate mr-2">{a.name}</span>
                          <Badge variant="outline" className="text-xxs">
                            {a.type}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">None</div>
                    )}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium mb-2">
                    New Assets (will get posting tasks)
                  </div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {assetComparison?.onlyInNew?.length ? (
                      assetComparison.onlyInNew.map((a) => (
                        <div
                          key={`${a.type}:${a.name}`}
                          className="text-xs flex items-center justify-between border rounded px-2 py-1"
                        >
                          <span className="truncate mr-2">{a.name}</span>
                          <Badge variant="outline" className="text-xxs">
                            {a.type}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">None</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Template picker (depends on selected package) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-purple-600" />
              <div className="text-sm font-medium">
                Templates under selected package
              </div>
              <Badge variant="outline">
                {fetchingTpls ? "Loading..." : `${templates.length} found`}
              </Badge>
            </div>

            <ScrollArea className="h-44 rounded-md border">
              <div className="divide-y">
                {!selectedPackageId && (
                  <div className="p-6 text-sm text-muted-foreground">
                    Select a package to view its templates.
                  </div>
                )}
                {selectedPackageId &&
                  templates.length === 0 &&
                  !fetchingTpls && (
                    <div className="p-6 text-sm text-muted-foreground">
                      No templates under this package.
                    </div>
                  )}
                {templates.map((t) => {
                  const isSel = selectedTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-purple-50/60 transition-colors",
                        isSel && "bg-purple-50 ring-1 ring-purple-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{t.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {t.description || "—"}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            <Badge variant="outline" className="text-xs">
                              Status: {t.status ?? "—"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Assets: {t._count?.sitesAssets ?? 0}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Members: {t._count?.templateTeamMembers ?? 0}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  Generate tasks for non-common assets of the selected template.
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
            disabled={loading || !selectedPackageId || !selectedTemplateId}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upgrade & Migrate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
