// components/users/ImpersonateButton.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader } from "lucide-react";
import { useSWRConfig } from "swr";

type Props = {
  targetUserId: string;
  targetName?: string | null;
  className?: string;
};

function roleToLanding(role?: string | null) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "/admin";
  if (r === "agent") return "/agent";
  if (r === "manager") return "/manager";
  if (r === "qc") return "/qc";
  if (r === "am") return "/am";
  if (r === "am_ceo") return "/am"; // চাইলে "/am-ceo" করো যদি আলাদা রুট থাকে
  if (r === "client") return "/client";
  return "/";
}

export default function ImpersonateButton({
  targetUserId,
  targetName,
  className,
}: Props) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => mounted && setSelfId(d?.user?.id || null))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (selfId && selfId === targetUserId) return null;

  const start = async () => {
    if (!targetUserId) return;
    if (!confirm(`Impersonate ${targetName || "this user"}?`)) return;

    try {
      setLoading(true);
      const res = await fetch("/api/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || "Failed to impersonate");
        return;
      }

      toast.success(
        `Now impersonating ${data?.actingUser?.email || targetName || "user"}`
      );

      // ⬇️ 1) ইমিডিয়েটলি /api/auth/me রিফেচ ও ক্যাশ আপডেট
      await mutate("/api/auth/me", undefined, { revalidate: true });

      // ⬇️ 2) নতুন acting role নিয়ে হার্ড ন্যাভ — সাথে সাথেই নতুন লেআউট লোড
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json();
      const dest = roleToLanding(
        me?.user?.role?.name ?? me?.user?.role ?? me?.role
      );
      router.replace(dest);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={start} disabled={loading} className={className}>
      {loading ? <Loader className="w-4 h-4 animate-spin" /> : "Impersonate"}
    </Button>
  );
}
