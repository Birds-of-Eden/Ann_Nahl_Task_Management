// lib/auth-client.ts
import { signOut as nextSignOut } from "next-auth/react";

function sendActivityBeacon(payload: unknown) {
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      return (navigator as any).sendBeacon("/api/activity", blob);
    }
  } catch {}
  return false;
}

export async function signOut() {
  // 1) Try non-blocking beacon first (redirect abort সমস্যা এড়াতে)
  const activityPayload = {
    entityType: "auth",
    entityId: "self",
    action: "sign_out" as const,
  };
  const sent = sendActivityBeacon(activityPayload);

  // 2) Fallback: keepalive fetch (await না করে fire-and-forget)
  if (!sent) {
    try {
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload),
        keepalive: true,
        cache: "no-store",
      }).catch(() => {});
    } catch {}
  }

  // 3) NextAuth signOut → server-side /api/auth/signout হিট হবে এবং রিডাইরেক্ট করবে
  await nextSignOut({ redirect: true, callbackUrl: "/auth/sign-in" });
  return true;
}

export default { signOut };
