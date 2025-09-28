// New file: app/[role]/clients/select-existing/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { ClientList } from "@/components/clients/client-list";
import type { Client } from "@/types/client";

export default function SelectExistingClientPage() {
  const router = useRouter();
  const params = useParams() as { role: string };
  const base = `/${params.role}`;
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/clients", { cache: "no-store" });
        const data: Client[] = await r.json();
        setClients(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      [c.name, c.company, c.designation, c.email, c.package?.name, c.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [clients, q]);

  const handleView = (client: Client) => {
    // Keep behavior consistent with your details page
    router.push(`/admin/clients/${client.id}`);
    // or: router.push(`${base}/clients/${client.id}`)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-8">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h1 className="text-xl font-semibold">Select Existing Client</h1>
        <p className="text-sm text-muted-foreground">
          Search and choose a client that already exists in the system.
        </p>
        <div className="mt-4">
          <Input
            placeholder="Search by name, company, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          <p className="text-lg font-medium mb-2">No clients found.</p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <ClientList clients={filtered} onViewDetails={handleView} />
        </div>
      )}
    </div>
  );
}
