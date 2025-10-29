// components/clients/client-grid.tsx

"use client";

import { ClientCard } from "@/components/clients/client-card";
import type { Client } from "@/types/client";

interface ClientGridProps {
  clients: Client[];
  onViewDetails: (client: Client) => void;
  /** Favorites (am_ceo only): pass through so ClientCard can render heart */
  favoriteIds?: Set<string>;
  onToggleFavorite?: (clientId: string) => void;
}

export function ClientGrid({
  clients,
  onViewDetails,
  favoriteIds,
  onToggleFavorite,
}: ClientGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          clientId={client.id}
          clientUserId={(client as any).clientUserId ?? null}
          onViewDetails={() => onViewDetails(client)}
          isFavorite={favoriteIds?.has(client.id) ?? false}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
