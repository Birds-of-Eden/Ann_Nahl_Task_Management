// // components/clients/PackageUpgradeDialog.tsx
// "use client";

// import * as React from "react";
// import {
//   Loader2,
//   Package,
//   ShieldCheck,
//   TrendingUp,
//   Search,
//   LayoutTemplate,
// } from "lucide-react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Badge } from "@/components/ui/badge";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { toast } from "sonner";
// import { cn } from "@/lib/utils";
// import {
//   Accordion,
//   AccordionContent,
//   AccordionItem,
//   AccordionTrigger,
// } from "@/components/ui/accordion";

// type ZisanPackage = {
//   id: string;
//   name: string;
//   description: string | null;
//   totalMonths: number | null;
//   createdAt: string;
//   updatedAt: string;
//   stats?: {
//     clients: number;
//     templates: number;
//     activeTemplates: number;
//     sitesAssets: number;
//     teamMembers: number;
//     assignments: number;
//     tasks: number;
//   };
// };

// type Template = {
//   id: string;
//   name: string;
//   description: string | null;
//   status: string | null;
//   packageId: string;
//   _count?: { sitesAssets: number; templateTeamMembers: number };
// };

// interface Props {
//   open: boolean;
//   onOpenChange: (v: boolean) => void;
//   clientId: string;
//   currentPackageId?: string | null;
//   onUpgraded?: () => void;
// }

// export default function PackageUpgradeDialog({
//   open,
//   onOpenChange,
//   clientId,
//   currentPackageId,
//   onUpgraded,
// }: Props) {
//   const [loading, setLoading] = React.useState(false);
//   const [fetchingPkgs, setFetchingPkgs] = React.useState(false);
//   const [fetchingTpls, setFetchingTpls] = React.useState(false);
//   const [packages, setPackages] = React.useState<ZisanPackage[]>([]);
//   const [templates, setTemplates] = React.useState<Template[]>([]);
//   const [query, setQuery] = React.useState("");
//   const [selectedPackageId, setSelectedPackageId] = React.useState<
//     string | null
//   >(null);
//   const [selectedTemplateId, setSelectedTemplateId] = React.useState<
//     string | null
//   >(null);

//   // current client snapshot
//   const [clientSnapshot, setClientSnapshot] = React.useState<any | null>(null);
//   const [currentPackage, setCurrentPackage] = React.useState<any | null>(null);
//   const [tasksByCategory, setTasksByCategory] = React.useState<
//     Record<string, any[]>
//   >({});

//   // template/asset comparison
//   const [newTemplateDetails, setNewTemplateDetails] = React.useState<
//     any | null
//   >(null);
//   const [assetComparison, setAssetComparison] = React.useState<{
//     common: { id?: any; name: string; type: string }[];
//     onlyInNew: { id?: any; name: string; type: string }[];
//   } | null>(null);

//   // toggles
//   const [createAssignments, setCreateAssignments] = React.useState(true);
//   const [migrateCompleted, setMigrateCompleted] = React.useState(true);
//   const [createPostingTasks, setCreatePostingTasks] = React.useState(true);

//   // load packages
//   React.useEffect(() => {
//     if (!open) return;
//     (async () => {
//       try {
//         setFetchingPkgs(true);
//         const url = new URL(`/api/zisanpackages`, window.location.origin);
//         url.searchParams.set("include", "stats");
//         const res = await fetch(url.toString(), { cache: "no-store" });
//         if (!res.ok) throw new Error("Failed to fetch packages");
//         const data: ZisanPackage[] = await res.json();

//         const q = query.trim().toLowerCase();
//         const filtered = data
//           .filter((p) => p.id !== (currentPackageId || "")) // exclude current
//           .filter((p) =>
//             !q
//               ? true
//               : p.name?.toLowerCase().includes(q) ||
//                 (p.description ?? "").toLowerCase().includes(q)
//           )
//           .sort(
//             (a, b) =>
//               (b.stats?.activeTemplates ?? 0) - (a.stats?.activeTemplates ?? 0)
//           );
//         setPackages(filtered);
//       } catch (e: any) {
//         console.error(e);
//         toast.error(e?.message || "Could not load packages");
//       } finally {
//         setFetchingPkgs(false);
//       }
//     })();
//   }, [open, query, currentPackageId]);

//   // load current client (package, tasks grouped by category)
//   React.useEffect(() => {
//     if (!open) return;
//     (async () => {
//       try {
//         const res = await fetch(`/api/clients/${clientId}`, {
//           cache: "no-store",
//         });
//         if (!res.ok) throw new Error("Failed to load client details");
//         const data = await res.json();
//         setClientSnapshot(data);
//         setCurrentPackage(data?.package || null);
//         // group tasks by category name
//         const groups: Record<string, any[]> = {};
//         (data?.tasks || []).forEach((t: any) => {
//           const cat = t?.category?.name || "Uncategorized";
//           if (!groups[cat]) groups[cat] = [];
//           groups[cat].push(t);
//         });
//         setTasksByCategory(groups);
//       } catch (e: any) {
//         console.error(e);
//         toast.error(
//           e?.message || "Unable to load client's current package/tasks"
//         );
//       }
//     })();
//   }, [open, clientId]);

//   // load templates for selected package
//   React.useEffect(() => {
//     if (!open) return;
//     if (!selectedPackageId) {
//       setTemplates([]);
//       setSelectedTemplateId(null);
//       setNewTemplateDetails(null);
//       setAssetComparison(null);
//       return;
//     }
//     (async () => {
//       try {
//         setFetchingTpls(true);
//         const url = new URL(`/api/packages/templates`, window.location.origin);
//         url.searchParams.set("packageId", selectedPackageId);
//         const res = await fetch(url.toString(), { cache: "no-store" });
//         if (!res.ok) throw new Error("Failed to fetch templates");
//         const data: Template[] = await res.json();
//         setTemplates(data);
//         setSelectedTemplateId(null);
//       } catch (e: any) {
//         console.error(e);
//         toast.error(e?.message || "Could not load templates");
//       } finally {
//         setFetchingTpls(false);
//       }
//     })();
//   }, [open, selectedPackageId]);

//   // when a template is selected, fetch details and compute asset comparison
//   React.useEffect(() => {
//     if (!open) return;
//     if (!selectedTemplateId) {
//       setNewTemplateDetails(null);
//       setAssetComparison(null);
//       return;
//     }
//     (async () => {
//       try {
//         // fetch template details with sitesAssets
//         const res = await fetch(`/api/templates/${selectedTemplateId}`, {
//           cache: "no-store",
//         });
//         if (!res.ok) throw new Error("Failed to load template details");
//         const tpl = await res.json();
//         setNewTemplateDetails(tpl);

//         // collect existing assets from client's current assignments/templates
//         const oldAssets: { name: string; type: string }[] = [];
//         const seenKey = new Set<string>();
//         const norm = (s: string | null | undefined) =>
//           String(s ?? "")
//             .toLowerCase()
//             .replace(/\s+/g, " ")
//             .trim();
//         const keyOf = (a: { name: string; type: string }) =>
//           `${norm(a.type)}::${norm(a.name)}`;
//         try {
//           const c = clientSnapshot;
//           if (c?.assignments?.length) {
//             for (const asn of c.assignments) {
//               const pkgId = asn?.template?.packageId;
//               if (currentPackageId && pkgId !== currentPackageId) continue;
//               const assets = asn?.template?.sitesAssets || [];
//               for (const a of assets) {
//                 const rec = {
//                   name: a?.name || "",
//                   type: a?.type || "",
//                 } as { name: string; type: string };
//                 const k = keyOf(rec);
//                 if (!seenKey.has(k)) {
//                   seenKey.add(k);
//                   oldAssets.push(rec);
//                 }
//               }
//             }
//           }
//         } catch (e) {
//           console.warn("Failed to scan current assets", e);
//         }

//         const newAssets: { id?: any; name: string; type: string }[] = (
//           tpl?.sitesAssets || []
//         ).map((a: any) => ({
//           id: a.id,
//           name: a.name || "",
//           type: a.type || "",
//         }));
//         const oldKeys = new Set(oldAssets.map((a) => keyOf(a)));
//         const common = newAssets.filter((a) => oldKeys.has(keyOf(a)));
//         const onlyInNew = newAssets.filter((a) => !oldKeys.has(keyOf(a)));
//         setAssetComparison({ common, onlyInNew });
//       } catch (e: any) {
//         console.error(e);
//         toast.error(e?.message || "Failed to prepare asset comparison");
//         setNewTemplateDetails(null);
//         setAssetComparison(null);
//       }
//     })();
//   }, [open, selectedTemplateId, clientSnapshot, currentPackageId]);

//   const handleConfirm = async () => {
//     if (!selectedPackageId) return toast.error("Please select a package.");
//     if (!selectedTemplateId) return toast.error("Please select a template.");

//     setLoading(true);
//     try {
//       const res = await fetch(`/api/clients/${clientId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           action: "upgrade",
//           newPackageId: selectedPackageId,
//           templateId: selectedTemplateId, // ✅ send selected template
//           createAssignments,
//           migrateCompleted, // copy done tasks from old package
//           createPostingTasks, // auto-generate tasks for non-common assets of this template
//         }),
//       });
//       const j = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(j?.message || "Upgrade failed");
//       toast.success("Package upgraded successfully.");

//       if (j?.createdPosting != null) {
//         toast.success(`Posting tasks created/filled: ${j.createdPosting}`);
//       }
//       // If the new package has more months than the old one, generate remaining month's tasks
//       try {
//         const oldMonths =
//           Number(clientSnapshot?.package?.totalMonths ?? 0) || 0;
//         const newMonths =
//           Number(
//             packages.find((p) => p.id === selectedPackageId)?.totalMonths ?? 0
//           ) || 0;
//         if (newMonths > oldMonths) {
//           const r = await fetch(
//             `/api/tasks/remain-tasks-create-and-distrubution`,
//             {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ clientId }),
//             }
//           );
//           const jr = await r.json().catch(() => ({}));
//           if (r.ok) {
//             toast.success(
//               `Created ${
//                 jr?.created ?? 0
//               } extra task(s) for the additional month(s).`
//             );
//           } else {
//             console.warn("Remaining tasks creation failed", jr);
//           }
//         }
//       } catch (ee) {
//         console.warn("Post-upgrade remaining task creation failed", ee);
//       }
//       onOpenChange(false);
//       onUpgraded?.();
//     } catch (e: any) {
//       console.error(e);
//       toast.error(e?.message || "Failed to upgrade");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <TrendingUp className="h-5 w-5 text-cyan-600" />
//             Upgrade Client Package
//           </DialogTitle>
//           <DialogDescription>
//             Pick a new package, then choose a template under that package.
//             Completed work from the old package can be included automatically.
//           </DialogDescription>
//         </DialogHeader>

//         <div className="space-y-5">
//           {/* Current package & tasks overview */}
//           <div className="space-y-2">
//             <div className="text-sm font-medium flex items-center gap-2">
//               <Package className="h-4 w-4 text-muted-foreground" />
//               Current Package & Tasks
//             </div>
//             <div className="rounded-md border p-3">
//               <div className="flex flex-wrap items-center gap-2 text-sm">
//                 <Badge variant="secondary">
//                   Package: {currentPackage?.name ?? "—"}
//                 </Badge>
//                 <Badge variant="outline">
//                   Months: {currentPackage?.totalMonths ?? "—"}
//                 </Badge>
//                 <Badge variant="outline">
//                   Tasks:{" "}
//                   {clientSnapshot?.taskCounts?.total ??
//                     clientSnapshot?.tasks?.length ??
//                     0}
//                 </Badge>
//                 <Badge variant="outline">
//                   Progress: {clientSnapshot?.progress ?? 0}%
//                 </Badge>
//               </div>
//               <div className="mt-3">
//                 <Accordion type="multiple" className="w-full">
//                   {Object.keys(tasksByCategory).length === 0 && (
//                     <div className="text-xs text-muted-foreground">
//                       No tasks found.
//                     </div>
//                   )}
//                   {Object.entries(tasksByCategory).map(([cat, items]) => (
//                     <AccordionItem key={cat} value={cat}>
//                       <AccordionTrigger>
//                         <div className="flex items-center gap-2">
//                           <Badge variant="outline" className="text-xs">
//                             {cat}
//                           </Badge>
//                           <span className="text-xs text-muted-foreground">
//                             {items.length} tasks
//                           </span>
//                         </div>
//                       </AccordionTrigger>
//                       <AccordionContent>
//                         <div className="max-h-40 overflow-auto space-y-1">
//                           {items.map((t: any) => (
//                             <div
//                               key={t.id}
//                               className="text-xs flex items-center justify-between border rounded px-2 py-1"
//                             >
//                               <span className="truncate mr-2">{t.name}</span>
//                               <span className="text-muted-foreground">
//                                 {t.status}
//                               </span>
//                             </div>
//                           ))}
//                         </div>
//                       </AccordionContent>
//                     </AccordionItem>
//                   ))}
//                 </Accordion>
//               </div>
//             </div>
//           </div>
//           {/* Package picker */}
//           <div className="space-y-2">
//             <div className="flex items-center gap-2">
//               <Search className="h-4 w-4 text-muted-foreground" />
//               <Input
//                 placeholder="Search packages..."
//                 value={query}
//                 onChange={(e) => setQuery(e.target.value)}
//               />
//               <Badge variant="outline">
//                 {fetchingPkgs ? "Loading..." : `${packages.length} found`}
//               </Badge>
//             </div>

//             {selectedPackageId && currentPackage?.totalMonths != null && (
//               <div className="text-[11px] text-muted-foreground pl-1">
//                 Months change: {String(currentPackage.totalMonths ?? 0)} →{" "}
//                 {String(
//                   packages.find((p) => p.id === selectedPackageId)
//                     ?.totalMonths ?? "—"
//                 )}{" "}
//                 (missing cycles will be auto-created)
//               </div>
//             )}

//             <ScrollArea className="h-40 rounded-md border">
//               <div className="divide-y">
//                 {packages.length === 0 && (
//                   <div className="p-6 text-sm text-muted-foreground">
//                     No other packages available.
//                   </div>
//                 )}
//                 {packages.map((p) => {
//                   const isSelected = selectedPackageId === p.id;
//                   return (
//                     <button
//                       key={p.id}
//                       type="button"
//                       onClick={() => setSelectedPackageId(p.id)}
//                       className={cn(
//                         "w-full text-left p-3 hover:bg-cyan-50/60 transition-colors",
//                         isSelected && "bg-cyan-50 ring-1 ring-cyan-200"
//                       )}
//                     >
//                       <div className="flex items-start justify-between gap-4">
//                         <div>
//                           <div className="font-semibold flex items-center gap-2">
//                             <Package className="h-4 w-4 text-cyan-600" />
//                             {p.name}
//                           </div>
//                           <div className="text-xs text-muted-foreground line-clamp-1">
//                             {p.description || "—"}
//                           </div>
//                           <div className="flex flex-wrap gap-1 pt-1">
//                             <Badge variant="secondary" className="text-xs">
//                               Months: {p.totalMonths ?? "—"}
//                             </Badge>
//                             {!!p.stats && (
//                               <>
//                                 <Badge variant="outline" className="text-xs">
//                                   Templates: {p.stats.templates}
//                                 </Badge>
//                                 <Badge variant="outline" className="text-xs">
//                                   Active: {p.stats.activeTemplates}
//                                 </Badge>
//                                 <Badge variant="outline" className="text-xs">
//                                   Assets: {p.stats.sitesAssets}
//                                 </Badge>
//                               </>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>
//             </ScrollArea>
//           </div>

//           {/* Asset comparison section */}
//           <div className="space-y-2">
//             <div className="text-sm font-medium flex items-center gap-2">
//               <ShieldCheck className="h-4 w-4 text-emerald-600" />
//               Asset Comparison (old vs selected template)
//             </div>
//             {!selectedTemplateId && (
//               <div className="p-3 text-xs text-muted-foreground border rounded-md">
//                 Select a template to preview asset differences.
//               </div>
//             )}
//             {selectedTemplateId && (
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//                 <div className="rounded-md border p-3">
//                   <div className="text-xs font-medium mb-2">Common Assets</div>
//                   <div className="max-h-40 overflow-auto space-y-1">
//                     {assetComparison?.common?.length ? (
//                       assetComparison.common.map((a) => (
//                         <div
//                           key={`${a.type}:${a.name}`}
//                           className="text-xs flex items-center justify-between border rounded px-2 py-1"
//                         >
//                           <span className="truncate mr-2">{a.name}</span>
//                           <Badge variant="outline" className="text-xxs">
//                             {a.type}
//                           </Badge>
//                         </div>
//                       ))
//                     ) : (
//                       <div className="text-xs text-muted-foreground">None</div>
//                     )}
//                   </div>
//                 </div>
//                 <div className="rounded-md border p-3">
//                   <div className="text-xs font-medium mb-2">
//                     New Assets (will get posting tasks)
//                   </div>
//                   <div className="max-h-40 overflow-auto space-y-1">
//                     {assetComparison?.onlyInNew?.length ? (
//                       assetComparison.onlyInNew.map((a) => (
//                         <div
//                           key={`${a.type}:${a.name}`}
//                           className="text-xs flex items-center justify-between border rounded px-2 py-1"
//                         >
//                           <span className="truncate mr-2">{a.name}</span>
//                           <Badge variant="outline" className="text-xxs">
//                             {a.type}
//                           </Badge>
//                         </div>
//                       ))
//                     ) : (
//                       <div className="text-xs text-muted-foreground">None</div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Template picker (depends on selected package) */}
//           <div className="space-y-2">
//             <div className="flex items-center gap-2">
//               <LayoutTemplate className="h-4 w-4 text-purple-600" />
//               <div className="text-sm font-medium">
//                 Templates under selected package
//               </div>
//               <Badge variant="outline">
//                 {fetchingTpls ? "Loading..." : `${templates.length} found`}
//               </Badge>
//             </div>

//             <ScrollArea className="h-44 rounded-md border">
//               <div className="divide-y">
//                 {!selectedPackageId && (
//                   <div className="p-6 text-sm text-muted-foreground">
//                     Select a package to view its templates.
//                   </div>
//                 )}
//                 {selectedPackageId &&
//                   templates.length === 0 &&
//                   !fetchingTpls && (
//                     <div className="p-6 text-sm text-muted-foreground">
//                       No templates under this package.
//                     </div>
//                   )}
//                 {templates.map((t) => {
//                   const isSel = selectedTemplateId === t.id;
//                   return (
//                     <button
//                       key={t.id}
//                       type="button"
//                       onClick={() => setSelectedTemplateId(t.id)}
//                       className={cn(
//                         "w-full text-left p-3 hover:bg-purple-50/60 transition-colors",
//                         isSel && "bg-purple-50 ring-1 ring-purple-200"
//                       )}
//                     >
//                       <div className="flex items-start justify-between gap-4">
//                         <div>
//                           <div className="font-semibold">{t.name}</div>
//                           <div className="text-xs text-muted-foreground line-clamp-1">
//                             {t.description || "—"}
//                           </div>
//                           <div className="flex flex-wrap gap-1 pt-1">
//                             <Badge variant="outline" className="text-xs">
//                               Status: {t.status ?? "—"}
//                             </Badge>
//                             <Badge variant="outline" className="text-xs">
//                               Assets: {t._count?.sitesAssets ?? 0}
//                             </Badge>
//                             <Badge variant="outline" className="text-xs">
//                               Members: {t._count?.templateTeamMembers ?? 0}
//                             </Badge>
//                           </div>
//                         </div>
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>
//             </ScrollArea>
//           </div>

//           {/* toggles */}
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
//             <label className="flex items-center gap-2 rounded-md border p-3">
//               <Checkbox
//                 checked={createAssignments}
//                 onCheckedChange={(v) => setCreateAssignments(Boolean(v))}
//               />
//               <div className="text-sm">
//                 <div className="font-medium flex items-center gap-1">
//                   Create assignments{" "}
//                   <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
//                 </div>
//                 <div className="text-muted-foreground text-xs">
//                   Add assignments for the new package templates.
//                 </div>
//               </div>
//             </label>
//             <label className="flex items-center gap-2 rounded-md border p-3">
//               <Checkbox
//                 checked={migrateCompleted}
//                 onCheckedChange={(v) => setMigrateCompleted(Boolean(v))}
//               />
//               <div className="text-sm">
//                 <div className="font-medium">Include completed work</div>
//                 <div className="text-muted-foreground text-xs">
//                   Copy done tasks from old package.
//                 </div>
//               </div>
//             </label>
//             <label className="flex items-center gap-2 rounded-md border p-3">
//               <Checkbox
//                 checked={createPostingTasks}
//                 onCheckedChange={(v) => setCreatePostingTasks(Boolean(v))}
//               />
//               <div className="text-sm">
//                 <div className="font-medium">Auto-create posting tasks</div>
//                 <div className="text-muted-foreground text-xs">
//                   Generate tasks for non-common assets of the selected template.
//                 </div>
//               </div>
//             </label>
//           </div>
//         </div>

//         <DialogFooter className="flex items-center justify-between gap-3">
//           <Button variant="outline" onClick={() => onOpenChange(false)}>
//             Cancel
//           </Button>
//           <Button
//             onClick={handleConfirm}
//             disabled={loading || !selectedPackageId || !selectedTemplateId}
//             className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
//           >
//             {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//             Upgrade & Migrate
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }















"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  ShieldCheck,
  TrendingUp,
  Search,
  LayoutTemplate,
  Clock,
  Users,
  FileText,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Star,
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
// You can keep ScrollArea if you like the custom scrollbar for inner lists.
// The main body now uses native overflow for stability.
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
  const [selectedPackageId, setSelectedPackageId] = React.useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);

  // current client snapshot
  const [clientSnapshot, setClientSnapshot] = React.useState<any | null>(null);
  const [currentPackage, setCurrentPackage] = React.useState<any | null>(null);
  const [tasksByCategory, setTasksByCategory] = React.useState<Record<string, any[]>>({});

  // template/asset comparison
  const [newTemplateDetails, setNewTemplateDetails] = React.useState<any | null>(null);
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
          templateId: selectedTemplateId,
          createAssignments,
          migrateCompleted,
          createPostingTasks,
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
        const oldMonths = Number(clientSnapshot?.package?.totalMonths ?? 0) || 0;
        const newMonths =
          Number(
            packages.find((p) => p.id === selectedPackageId)?.totalMonths ?? 0
          ) || 0;
        if (newMonths > oldMonths) {
          const r = await fetch(`/api/tasks/remain-tasks-create-and-distrubution`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId }),
          });
          const jr = await r.json().catch(() => ({}));
          if (r.ok) {
            toast.success(
              `Created ${jr?.created ?? 0} extra task(s) for the additional month(s).`
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

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Make the dialog a flex column and cap height. Remove overflow-hidden. */}
      <DialogContent className="max-w-7xl p-0">
        {/* Wrapper controls total height and layout */}
        <div className="flex max-h-[90vh] flex-col">
          {/* Header stays fixed */}
          <DialogHeader className="border-b border-slate-100 px-6 pb-6 pt-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl text-white">
                <TrendingUp className="h-6 w-6" />
              </div>
              Upgrade Client Package
            </DialogTitle>
            <DialogDescription className="text-lg text-slate-600 mt-2">
              Select a new package and template to upgrade your client's plan. All existing work can be migrated seamlessly.
            </DialogDescription>
          </DialogHeader>

          {/* Main scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-6">
              <div className="space-y-8 py-6">
                {/* Current Package Overview */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg text-white">
                      <Package className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Current Package Overview</h3>
                  </div>

                  <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200/60 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                          <Package className="h-4 w-4" />
                          Package
                        </div>
                        <div className="font-semibold text-lg text-slate-800">{currentPackage?.name || "—"}</div>
                      </div>

                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                          <Clock className="h-4 w-4" />
                          Duration
                        </div>
                        <div className="font-semibold text-lg text-slate-800">{currentPackage?.totalMonths || "—"} months</div>
                      </div>

                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                          <FileText className="h-4 w-4" />
                          Tasks
                        </div>
                        <div className="font-semibold text-lg text-slate-800">
                          {clientSnapshot?.taskCounts?.total ?? clientSnapshot?.tasks?.length ?? 0}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                          <TrendingUp className="h-4 w-4" />
                          Progress
                        </div>
                        <div className="font-semibold text-lg text-emerald-600">{clientSnapshot?.progress ?? 0}%</div>
                      </div>
                    </div>

                    {Object.keys(tasksByCategory).length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                        <Accordion type="multiple" className="w-full">
                          {Object.entries(tasksByCategory).map(([cat, items]) => (
                            <AccordionItem key={cat} value={cat} className="border-b border-slate-100 last:border-b-0">
                              <AccordionTrigger className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-medium">
                                    {cat}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    {items.length} task{items.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-6 pb-4">
                                <div className="max-h-48 overflow-auto space-y-2">
                                  {items.map((t: any) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 transition-colors hover:bg-slate-100"
                                    >
                                      <span className="font-medium text-slate-700 truncate mr-4">{t.name}</span>
                                      <Badge
                                        variant={t.status === "completed" ? "default" : "secondary"}
                                        className={cn(
                                          "text-xs",
                                          t.status === "completed" && "bg-emerald-100 text-emerald-700"
                                        )}
                                      >
                                        {t.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}

                    {Object.keys(tasksByCategory).length === 0 && (
                      <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No tasks found for this package</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Package Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg text-white">
                      <Search className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Select New Package</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Search packages by name or description..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-12 h-14 text-lg bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                          {fetchingPkgs ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading...
                            </div>
                          ) : (
                            `${packages.length} available`
                          )}
                        </Badge>
                      </div>
                    </div>

                    {selectedPackageId && currentPackage?.totalMonths != null && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium">Duration Change:</span>
                          <span>{String(currentPackage.totalMonths ?? 0)} months</span>
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-bold">
                            {String(selectedPackage?.totalMonths ?? "—")} months
                          </span>
                        </div>
                        <p className="text-amber-700 text-sm mt-1">
                          Missing task cycles will be automatically created for the additional months.
                        </p>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      {/* Inner list has its own scroll bound, but the main body also scrolls */}
                      <ScrollArea className="h-96">
                        <div className="divide-y divide-slate-100">
                          {packages.length === 0 && !fetchingPkgs && (
                            <div className="p-12 text-center">
                              <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                              <h4 className="text-lg font-semibold text-slate-600 mb-2">No Packages Available</h4>
                              <p className="text-slate-500">There are no other packages available for upgrade at this time.</p>
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
                                  "w-full text-left p-6 transition-all duration-200 hover:bg-blue-50/50 relative group",
                                  isSelected && "bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500"
                                )}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div
                                        className={cn(
                                          "p-2 rounded-lg transition-colors",
                                          isSelected
                                            ? "bg-blue-500 text-white"
                                            : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600"
                                        )}
                                      >
                                        <Package className="h-4 w-4" />
                                      </div>
                                      <h4 className="text-lg font-bold text-slate-800">{p.name}</h4>
                                      {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
                                    </div>

                                    <p className="text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                                      {p.description || "No description available"}
                                    </p>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">{p.totalMonths ?? "—"} months</span>
                                      </div>
                                      {p.stats && (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <LayoutTemplate className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">{p.stats.templates} templates</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">{p.stats.activeTemplates} active</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm text-slate-600">{p.stats.sitesAssets} assets</span>
                                          </div>
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
                  </div>
                </div>

                {/* Template Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg text-white">
                      <LayoutTemplate className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Choose Template</h3>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                      {fetchingTpls ? (
                        <div className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </div>
                      ) : (
                        `${templates.length} available`
                      )}
                    </Badge>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <ScrollArea className="h-80">
                      <div className="divide-y divide-slate-100">
                        {!selectedPackageId && (
                          <div className="p-12 text-center">
                            <LayoutTemplate className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h4 className="text-lg font-semibold text-slate-600 mb-2">Select a Package First</h4>
                            <p className="text-slate-500">Choose a package above to view its available templates.</p>
                          </div>
                        )}

                        {selectedPackageId && templates.length === 0 && !fetchingTpls && (
                          <div className="p-12 text-center">
                            <LayoutTemplate className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h4 className="text-lg font-semibold text-slate-600 mb-2">No Templates Available</h4>
                            <p className="text-slate-500">This package doesn't have any templates configured yet.</p>
                          </div>
                        )}

                        {templates.map((t) => {
                          const isSelected = selectedTemplateId === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTemplateId(t.id)}
                              className={cn(
                                "w-full text-left p-6 transition-all duration-200 hover:bg-purple-50/50 relative group",
                                isSelected && "bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-l-purple-500"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div
                                      className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        isSelected
                                          ? "bg-purple-500 text-white"
                                          : "bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-600"
                                      )}
                                    >
                                      <LayoutTemplate className="h-4 w-4" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">{t.name}</h4>
                                    {isSelected && <CheckCircle2 className="h-5 w-5 text-purple-500" />}
                                  </div>

                                  <p className="text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                                    {t.description || "No description available"}
                                  </p>

                                  <div className="flex items-center gap-4">
                                    <Badge
                                      variant={t.status === "active" ? "default" : "secondary"}
                                      className={cn(t.status === "active" && "bg-emerald-100 text-emerald-700")}
                                    >
                                      {t.status ?? "—"}
                                    </Badge>
                                    <div className="flex items-center gap-2 text-slate-500">
                                      <FileText className="h-4 w-4" />
                                      <span className="text-sm">{t._count?.sitesAssets ?? 0} assets</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-500">
                                      <Users className="h-4 w-4" />
                                      <span className="text-sm">{t._count?.templateTeamMembers ?? 0} members</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Asset Comparison */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Asset Migration Preview</h3>
                  </div>

                  {!selectedTemplateId ? (
                    <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                      <ShieldCheck className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-slate-600 mb-2">Select Template to Preview</h4>
                      <p className="text-slate-500">Choose a template above to see how assets will be migrated.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Common Assets */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-emerald-500 rounded-lg text-white">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <h4 className="font-semibold text-emerald-800">Existing Assets</h4>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            {assetComparison?.common?.length ?? 0} items
                          </Badge>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-auto">
                          {assetComparison?.common?.length ? (
                            assetComparison.common.map((a, index) => (
                              <div
                                key={`${a.type}:${a.name}:${index}`}
                                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-emerald-100"
                              >
                                <span className="font-medium text-slate-700 truncate mr-3">{a.name}</span>
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                  {a.type}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                              <p className="text-emerald-600 font-medium">No common assets found</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* New Assets */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-500 rounded-lg text-white">
                            <Star className="h-4 w-4" />
                          </div>
                          <h4 className="font-semibold text-blue-800">New Assets</h4>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            {assetComparison?.onlyInNew?.length ?? 0} items
                          </Badge>
                        </div>

                        <p className="text-blue-700 text-sm mb-4 bg-blue-100 rounded-lg p-3">
                          These assets will get automated posting tasks created
                        </p>

                        <div className="space-y-2 max-h-64 overflow-auto">
                          {assetComparison?.onlyInNew?.length ? (
                            assetComparison.onlyInNew.map((a, index) => (
                              <div
                                key={`${a.type}:${a.name}:${index}`}
                                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-100"
                              >
                                <span className="font-medium text-slate-700 truncate mr-3">{a.name}</span>
                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                  {a.type}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-blue-300 mx-auto mb-3" />
                              <p className="text-blue-600 font-medium">No new assets to add</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Migration Options */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg text-white">
                      <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Migration Options</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="group cursor-pointer">
                      <div
                        className={cn(
                          "rounded-2xl border-2 p-6 transition-all duration-200",
                          createAssignments
                            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
                            : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={createAssignments}
                            onCheckedChange={(v) => setCreateAssignments(Boolean(v))}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="h-5 w-5 text-emerald-600" />
                              <h4 className="font-semibold text-slate-800">Create Assignments</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed">
                              Automatically generate assignments for the new package templates
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="group cursor-pointer">
                      <div
                        className={cn(
                          "rounded-2xl border-2 p-6 transition-all duration-200",
                          migrateCompleted
                            ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50"
                            : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={migrateCompleted}
                            onCheckedChange={(v) => setMigrateCompleted(Boolean(v))}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="h-5 w-5 text-blue-600" />
                              <h4 className="font-semibold text-slate-800">Migrate Completed Work</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed">
                              Copy all completed tasks from the previous package
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>

                    <label className="group cursor-pointer">
                      <div
                        className={cn(
                          "rounded-2xl border-2 p-6 transition-all duration-200",
                          createPostingTasks
                            ? "border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50"
                            : "border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50/30"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={createPostingTasks}
                            onCheckedChange={(v) => setCreatePostingTasks(Boolean(v))}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-5 w-5 text-purple-600" />
                              <h4 className="font-semibold text-slate-800">Auto-Create Tasks</h4>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed">
                              Generate posting tasks for new template assets
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer stays fixed */}
          <DialogFooter className="border-t border-slate-100 px-6 py-6">
            <div className="flex items-center justify-between w-full gap-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="px-8 py-3 text-base font-medium"
              >
                Cancel
              </Button>

              <Button
                onClick={handleConfirm}
                disabled={loading || !selectedPackageId || !selectedTemplateId}
                className="px-8 py-3 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Upgrade & Migrate
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
