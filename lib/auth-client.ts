// lib/auth-client.ts
import { signOut as nextSignOut } from "next-auth/react";

export async function signOut() {
  await nextSignOut({ callbackUrl: "/auth/sign-in" });
  return true;
}

export default { signOut };
