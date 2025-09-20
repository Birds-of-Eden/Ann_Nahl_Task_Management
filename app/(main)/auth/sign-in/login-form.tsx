"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // ✅ কুকি পাঠানো/নেওয়া
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Invalid credentials");
        return;
      }

      toast.success("Signed in successfully!");

      // লগইনের পর সাথে সাথে heartbeat (ঐচ্ছিক)
      await fetch("/api/presence/heartbeat", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});

      const role = (data?.user?.role || "").toLowerCase();
      const target =
        role === "admin"
          ? "/admin"
          : role === "agent"
          ? "/agent"
          : role === "manager"
          ? "/manager"
          : role === "qc"
          ? "/qc"
          : role === "am"
          ? "/am"
          : role === "am_ceo"
          ? "/am_ceo"
          : role === "client"
          ? "/client"
          : role === "data_entry"
          ? "/data_entry"
          : "/";

      // ✅ সবচেয়ে নির্ভরযোগ্য redirect
      window.location.href = target;
      // অথবা শুধু client navigation চাইলে:
      // router.replace(target);
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-transparent border-none">
      <CardHeader>
        <div className="flex items-center text-slate-500 justify-center mb-3">
          <img src="/aan-logo.png" alt="aan-logo" />
        </div>
        <CardTitle className="text-2xl text-white flex items-center justify-center">
          Task Management
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-transparent">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="m@example.com"
                required
                autoComplete="username"
                className="placeholder:text-white/80 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  className="placeholder:text-white/80 text-white pr-10"
                />
                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-white/80 hover:text-white"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={cn(
                "relative w-full rounded-md px-4 py-2 font-semibold text-white",
                "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
                "transition-all duration-300 ease-in-out hover:from-pink-500 hover:to-indigo-500",
                "shadow-lg hover:shadow-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={loading}
            >
              {loading ? (
                <Loader className="animate-spin w-5 h-5 mx-auto" />
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
