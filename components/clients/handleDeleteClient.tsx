import { toast } from "sonner";
// import useSWR or your data refetcher if you need to refresh the list
// import { mutate } from "swr";

export async function handleDeleteClient(clientId: string) {
  const confirmed = window.confirm("Delete this client and all related data? This cannot be undone.");
  if (!confirmed) return;

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
  } catch (err: any) {
    toast.error(err?.message || "Failed to delete client");
  }
}
