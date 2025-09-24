// app/data_entry/clients/[clientId]/tasks/page.tsx

import DataEntryCompleteTasksPanel from "@/components/dataentry/DataEntryCompleteTasksPanel";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  return (
    <div className="p-2 sm:p-4">
      <DataEntryCompleteTasksPanel clientId={clientId} />
    </div>
  );
}
