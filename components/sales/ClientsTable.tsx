import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { StatusPill } from "./StatusPill";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function ClientsTable({
  isLoading,
  grouped,
  selectedPkg,
  setSelectedPkg,
  query,
  setQuery,
}: {
  isLoading: boolean;
  grouped: any[];
  selectedPkg: string | "all";
  setSelectedPkg: (v: string | "all") => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  const pkgOptions = grouped.map((g) => ({
    id: g.packageId,
    label: g.packageName ?? `(untitled ${g.packageId.slice(0, 6)})`,
    count: g.count,
  }));

  let currentClients: any[] = [];
  if (selectedPkg === "all") {
    for (const g of grouped) currentClients = currentClients.concat(g.clients);
  } else {
    const g = grouped.find((x) => x.packageId === selectedPkg);
    if (g) currentClients = g.clients;
  }

  const q = query.trim().toLowerCase();
  if (q)
    currentClients = currentClients.filter((c) =>
      `${c.name ?? ""} ${c.company ?? ""} ${c.email ?? ""}`
        .toLowerCase()
        .includes(q)
    );

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/60">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Clients
        </CardTitle>
        <div className="flex items-center gap-3">
          <Select
            value={selectedPkg}
            onValueChange={(v) => setSelectedPkg(v as any)}
          >
            <SelectTrigger className="w-60 border-slate-200 shadow-sm">
              <SelectValue placeholder="Select package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              {pkgOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label} ({p.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search client name, company, or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-80 pl-10 border-slate-200 shadow-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : currentClients.length === 0 ? (
          <EmptyState
            title="No clients found"
            hint="Try clearing filters or adjusting your search."
          />
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-semibold text-slate-900 w-[220px]">
                    Client
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Company
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Email
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Start
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Due
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-slate-900">
                      {c.name ?? "—"}
                    </TableCell>
                    <TableCell>{c.company ?? "—"}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.startDate ? formatDate(c.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.dueDate ? formatDate(c.dueDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
