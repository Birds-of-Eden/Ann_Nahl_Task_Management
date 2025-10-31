// app/[role]/am_ceo_clients/page.tsx

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Import necessary components
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { AmCeoClientOverviewHeader } from "@/components/clients/am-ceo-client-overview-header";
import { AmGroupedClientView } from "@/components/clients/am-grouped-client-view"; // ✅ The key component for the new UI

// Type definition for a single AM Group
type AmGroup = {
  am: { id: string; name: string | null; email: string | null };
  clients: Client[];
};

export default function ClientsPage() {
  const router = useRouter();

  // Session State
  const { user, loading: sessionLoading } = useUserSession();

  // Data and UI State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");

  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  const currentUserId = user?.id ?? undefined;
  const currentUserRole = user?.role ?? undefined;
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";
  const isAMCeo = (currentUserRole ?? "").toLowerCase() === "am_ceo";

  // Enforce AM filtering to their own ID
  useEffect(() => {
    if (
      !sessionLoading &&
      isAM &&
      currentUserId &&
      amFilter !== currentUserId
    ) {
      setAmFilter(currentUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, isAM, currentUserId]);

  // --- Clients Fetch ---
  const fetchClients = useCallback(async () => {
    if (sessionLoading) return;
    setLoading(true);
    try {
      // Apply server-side scope for AM role
      const url =
        isAM && currentUserId
          ? `/api/clients?amId=${encodeURIComponent(currentUserId)}`
          : "/api/clients";

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch clients");

      const raw = await response.json();

      const list =
        (Array.isArray(raw) && raw) ||
        (Array.isArray(raw?.clients) && raw.clients) ||
        (Array.isArray(raw?.data) && raw.data) ||
        (Array.isArray(raw?.data?.clients) && raw.data.clients) ||
        [];

      // Normalize IDs to strings
      const normalized: Client[] = (list as any[]).map((c) => ({
        ...c,
        id: String(c.id),
        amId: c?.amId != null ? String(c.amId) : c?.amId,
        packageId: c?.packageId != null ? String(c.packageId) : c?.packageId,
        accountManager: c?.accountManager
          ? {
              ...c.accountManager,
              id:
                c.accountManager.id != null
                  ? String(c.accountManager.id)
                  : c.accountManager.id,
            }
          : c?.accountManager,
      }));

      setClients(normalized);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients data.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [sessionLoading, isAM, currentUserId]);

  // --- Packages Fetch ---
  const fetchPackages = useCallback(async () => {
    try {
      const resp = await fetch("/api/packages", { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed to fetch packages");

      const raw = await resp.json();
      const list =
        (Array.isArray(raw) && raw) ||
        (Array.isArray(raw?.data) && raw.data) ||
        [];

      const mapped: { id: string; name: string }[] = (list as any[]).map(
        (p) => ({
          id: String(p.id),
          name: String(p.name ?? "Unnamed"),
        })
      );
      setPackages(mapped);
    } catch {
      // Fallback: derive from existing clients
      const derived = Array.from(
        clients.reduce((map, c) => {
          if (c.packageId)
            map.set(String(c.packageId), {
              id: String(c.packageId),
              name: c.package?.name ?? String(c.packageId),
            });
          return map;
        }, new Map<string, { id: string; name: string }>())
      ).map(([, v]) => v);
      setPackages(derived);
    }
  }, [clients]);

  // Effects for fetching data
  useEffect(() => {
    if (!sessionLoading) fetchClients();
  }, [sessionLoading, fetchClients]);

  useEffect(() => {
    if (!sessionLoading) fetchPackages();
  }, [sessionLoading, fetchPackages]);

  // Navigation handler
  const handleViewClientDetails = (client: Client) => {
    router.push(`/am_ceo/clients/${client.id}`);
  };

  // Build list of Account Managers for the filter dropdown
  const accountManagers = useMemo(
    () =>
      Array.from(
        clients.reduce((map, c) => {
          const id = c.amId ?? c.accountManager?.id;
          if (!id) return map;
          const nm = c.accountManager?.name ?? null;
          const email = c.accountManager?.email ?? null;
          // Format: "Name (email)" or "Name" or "ID"
          const label = nm ? (email ? `${nm} (${email})` : nm) : String(id);
          if (!map.has(String(id)))
            map.set(String(id), { id: String(id), label });
          return map;
        }, new Map<string, { id: string; label: string }>())
      ).map(([, v]) => v),
    [clients]
  );

  // --- Client-side filtering logic ---
  const filteredClients = clients.filter((client) => {
    // Status filter
    if (
      statusFilter !== "all" &&
      (client.status ?? "").toLowerCase() !== statusFilter.toLowerCase()
    ) {
      return false;
    }

    // Package filter
    const clientPkgId =
      client.packageId != null ? String(client.packageId) : null;
    if (packageFilter !== "all" && clientPkgId !== String(packageFilter)) {
      return false;
    }

    // AM scope filter (enforces AM's own scope first)
    const effectiveAmFilter =
      isAM && currentUserId
        ? String(currentUserId)
        : amFilter === "all"
        ? "all"
        : String(amFilter);
    const clientAm = client.amId ?? client.accountManager?.id ?? null;
    if (
      effectiveAmFilter !== "all" &&
      String(clientAm ?? "") !== effectiveAmFilter
    ) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hit =
        client.name?.toLowerCase().includes(q) ||
        client.company?.toLowerCase().includes(q) ||
        client.designation?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // --- Core: Grouping filtered clients by AM ID ---
  const groupedClients: AmGroup[] = useMemo(() => {
    const groups = new Map<string, AmGroup>();

    filteredClients.forEach((client) => {
      // Use "unassigned" if no AM ID is present
      const effectiveAmId =
        client.amId ?? client.accountManager?.id ?? "unassigned";

      if (!groups.has(effectiveAmId)) {
        // Find the AM's label from the pre-built list
        const amLabel = accountManagers.find(
          (am) => am.id === effectiveAmId
        )?.label;
        let amName = null;
        let amEmail = null;

        if (amLabel) {
          // Attempt to parse "Name (email)" format
          const match = amLabel.match(/(.*)\s\((.*)\)/);
          if (match) {
            amName = match[1].trim();
            amEmail = match[2].trim();
          } else {
            amName = amLabel;
          }
        }

        groups.set(effectiveAmId, {
          am: {
            id: effectiveAmId,
            // Prioritize data from the client object if available, otherwise use parsed label
            name: client.accountManager?.name || amName || null,
            email: client.accountManager?.email || amEmail || null,
          },
          clients: [],
        });
      }

      groups.get(effectiveAmId)?.clients.push(client);
    });

    // Convert Map to Array
    const groupsArray = Array.from(groups.values());

    // Sort: Unassigned clients go to the bottom
    groupsArray.sort((a, b) => {
      if (a.am.id === "unassigned") return 1;
      if (b.am.id === "unassigned") return -1;
      // Sort by name alphabetically
      return (a.am.name || a.am.id).localeCompare(b.am.name || b.am.id);
    });

    return groupsArray;
  }, [filteredClients, accountManagers]);

  // Loading UI
  if (sessionLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Final Render
  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header + Filters + Summary */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <AmCeoClientOverviewHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          packageFilter={packageFilter}
          setPackageFilter={setPackageFilter}
          packages={packages}
          amFilter={amFilter}
          setAmFilter={setAmFilter}
          accountManagers={accountManagers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
        {/* Note: Summary uses ALL clients, not filtered ones, for overall stats */}
        <ClientStatusSummary clients={clients} />
      </div>

      {/* Clients Grouped by AM (The new professional view) */}
      {groupedClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <AmGroupedClientView
          groupedClients={groupedClients}
          onViewDetails={handleViewClientDetails}
          viewMode={viewMode}
          canImpersonateAm={isAMCeo}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
