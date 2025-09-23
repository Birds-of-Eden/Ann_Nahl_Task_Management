// components/users/ImpersonateButton.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader } from "lucide-react";

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
  if (r === "client") return "/client";
  return "/";
}

export default function ImpersonateButton({
  targetUserId,
  targetName,
  className,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  // কেবল নিজের আইডি ধরার জন্য
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        setSelfId(d?.user?.id || null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  // নিজেরেই impersonate করা যাবে না
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

      // নতুন রোলে ল্যান্ডিং
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      const dest = roleToLanding(me?.user?.role);
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
