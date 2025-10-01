// lib/auth-client.ts
import { signOut as nextSignOut } from "next-auth/react";

async function logActivity(payload: {
  entityType: string;
  entityId: string;
  action: "sign_in" | "sign_out";
  details?: unknown;
}) {
  try {
    console.log("🔄 Sending activity log:", payload);

    const res = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("✅ Activity log response:", data);

    return data;
  } catch (e) {
    console.error("❌ Failed to log activity:", e);
  }
}

export async function signOut() {
  console.log("🚪 Signing out...");

  // আগে activity log এ লেখো
  await logActivity({
    entityType: "auth",
    entityId: "self",
    action: "sign_out",
  });

  // তারপর NextAuth signOut
  await nextSignOut({ callbackUrl: "/auth/sign-in" });

  console.log("👋 Signed out done.");
  return true;
}

export default { signOut };
