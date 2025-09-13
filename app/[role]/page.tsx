// app/[role]/page.tsx
import { getAuthUser } from "@/lib/getAuthUser";
import { redirect } from "next/navigation";

// Role dashboards
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { AMCeoDashboard } from "@/components/am_ceo/amCeoDashboard";
import { AMDashboard } from "@/components/account_manager/amDashboard";
import QCDashboard from "@/components/QCDashboard";
import { AgentDashboard } from "@/components/agent-dashboard";
import ClientSelfDashboard from "@/components/client-self-dashboard"; // নিচে ৩ নম্বর ফাইল

type Role =
  | "admin"
  | "manager"
  | "agent"
  | "qc"
  | "am"
  | "am_ceo"
  | "data_entry"
  | "client";

export default async function RoleBasedPage({
  params,
}: {
  params: { role: Role };
}) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");

  const role = (user.role?.name || "client") as Role;

  switch (role) {
    case "admin":
      return <AdminDashboard />;

    case "manager":
      return <AdminDashboard />; // চাইলে আলাদা ManagerDashboard ব্যবহার করতে পারেন

    case "agent":
      if (!user.id) {
        return (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-red-600">
              Could not determine agent ID. Please re-login.
            </p>
          </div>
        );
      }
      return <AgentDashboard agentId={user.id} />;

    case "qc":
      // QCDashboard নিজে ডেটা ফেচ করলে empty pass করুন, না হলে এখানে সার্ভার থেকে ফেচ করে props দিন
      return <QCDashboard tasks={[]} />;

    case "am":
      return <AMDashboard />;

    case "am_ceo":
      return <AMCeoDashboard />;

    case "data_entry":
      return (
        <div className="flex justify-center text-2xl font-bold text-gray-600">
          Data Entry Dashboard
        </div>
      );

    case "client":
    default:
      return <ClientSelfDashboard />;
  }
}
