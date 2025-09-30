// lib/getAuthUser.ts

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
