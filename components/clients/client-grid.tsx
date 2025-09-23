// components/clients/client-grid.tsx (pass clientUserId to card)
"use client";

import { ClientCard } from "@/components/clients/client-card";
import type { Client } from "@/types/client";

interface ClientGridProps {
  clients: Client[];
  onViewDetails: (client: Client) => void;
}

export function ClientGrid({ clients, onViewDetails }: ClientGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          clientId={client.id}
          clientUserId={(client as any).clientUserId ?? null}
          onViewDetails={() => onViewDetails(client)}
        />
      ))}
    </div>
  );
}
