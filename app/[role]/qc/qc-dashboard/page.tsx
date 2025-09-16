// app/[role]/qc/qc-dashboard/page.tsx
import QCDashboard from "@/components/QCDashboard";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

// keep helpers pure (no dynamic APIs inside)
function buildBaseUrl(proto: string, host: string) {
  return `${proto}://${host}`;
}

export default async function Page() {
  noStore(); // avoid caching
  let tasks: any[] = [];

  try {
    // ✅ await dynamic APIs
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

    const baseUrl = host ? buildBaseUrl(proto, host) : "";

    // ✅ cookies() is async now
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${baseUrl}/api/tasks`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      // next: { revalidate: 0 }
    });

    if (res.ok) {
      tasks = await res.json();
    } else {
      console.error("Failed to fetch tasks:", res.status, res.statusText);
    }
  } catch (error) {
    console.error("Failed to load tasks:", error);
  }

  return (
    <div>
      <QCDashboard tasks={tasks} />
    </div>
  );
}
