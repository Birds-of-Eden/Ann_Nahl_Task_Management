// app/page.tsx (server)
import { getAuthUser } from "@/lib/getAuthUser";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");
  redirect(`/${user.role?.name || "client"}`);
}
