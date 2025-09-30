// app/[role]/layout.tsx
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import DynamicBreadcrumb from "@/components/DynamicBreadcrumb";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";
import { getAuthUser } from "@/lib/getAuthUser";

type Role =
  | "admin"
  | "manager"
  | "agent"
  | "qc"
  | "am"
  | "am_ceo"
  | "data_entry"
  | "client";

const ALLOWED: Role[] = [
  "admin",
  "manager",
  "agent",
  "qc",
  "am",
  "am_ceo",
  "data_entry",
  "client",
];

export default async function UnifiedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");

  // ✅ params আগে await করুন
  const { role } = await params;
  const segment = role as Role;

  if (!ALLOWED.includes(segment)) redirect("/");

  // আপনার session.user.role এখন string, তাই .name লাগবে না
  const userRole = (user.role || "client") as Role;
  // if (segment !== userRole && userRole !== "admin") redirect(`/${userRole}`);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ImpersonationBanner />
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <DynamicBreadcrumb />
          </div>
        </header>
        <div>
          {children}
          <Toaster richColors closeButton />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
