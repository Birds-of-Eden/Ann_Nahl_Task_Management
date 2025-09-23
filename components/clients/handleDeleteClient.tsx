import { toast } from "sonner";
// import useSWR or your data refetcher if you need to refresh the list
// import { mutate } from "swr";
import { mutate } from "swr"; // ✅ add

export async function handleDeleteClient(
  clientId: string,
  swrKey: string = "/api/clients" // ✅ add
): Promise<boolean> {
  const confirmed = window.confirm(
    "Delete this client and all related data? This cannot be undone."
  );
  if (!confirmed) return false; // ✅ return boolean

  try {
    const res = await fetch(`/api/clients?id=${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Failed to delete client");
    }

    toast.success("Client deleted successfully");
    // mutate("/api/clients"); // <-- uncomment if using SWR to refresh list
    await mutate(swrKey); // ✅ SWR list auto-refresh
    return true; // ✅
  } catch (err: any) {
    toast.error(err?.message || "Failed to delete client");
    return false; // ✅
  }
}
