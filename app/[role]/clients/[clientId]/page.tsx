// app/admin/clients/[clientId]/page.tsx

import { headers, cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ClientDashboard } from "@/components/clients/clientsID/client-dashboard";
import type { Client } from "@/types/client";

// Force dynamic rendering for this page (required for production)
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UNCATEGORIZED = {
  id: "uncategorized",
  name: "Uncategorized",
  description: "",
};

function normalizeClientData(apiData: any): Client {
  return {
    ...apiData,
    companywebsite:
      apiData?.companywebsite && typeof apiData.companywebsite === "string"
        ? apiData.companywebsite
        : "",
    tasks: (apiData?.tasks ?? []).map((t: any) => ({
      ...t,
      categoryId: t?.category?.id ?? t?.categoryId ?? "uncategorized",
      category: t?.category ?? UNCATEGORIZED,
      name: String(t?.name ?? ""),
      priority: String(t?.priority ?? "medium"),
      status: String(t?.status ?? "pending"),
      templateSiteAsset: {
        ...t?.templateSiteAsset,
        type: String(t?.templateSiteAsset?.type ?? ""),
        name: String(t?.templateSiteAsset?.name ?? ""),
        url: String(t?.templateSiteAsset?.url ?? ""),
      },
    })),
  };
}

async function fetchClient(clientId: string): Promise<Client | null> {
  const h = await headers();
  const cookieHeader = (await cookies()).toString();

  // ✅ Use NEXTAUTH_URL or NEXT_PUBLIC_BASE_URL fallback
  const envBase =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    `${proto}://${host}`;

  const res = await fetch(`${base}/api/clients/${clientId}`, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
    },
  });

  if (!res.ok) return null;
  const raw = await res.json();
  const data = raw?.client ?? raw;
  return normalizeClientData(data);
}

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const clientData = await fetchClient(clientId);

  if (!clientData) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <ClientDashboard clientData={clientData} />
    </div>
  );
}
