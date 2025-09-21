// app/(main)/auth/sign-in/login-form.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useState } from "react";
import { Loader, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      // credentials provider কল
      const res = await signIn("credentials", {
        redirect: false, // নিজে রিডাইরেক্ট কন্ট্রোল করব
        email,
        password,
      });

      if (res?.error) {
        toast.error(res.error || "Invalid credentials");
        return;
      }

      toast.success("Signed in successfully!");

      // role-ভিত্তিক রিডাইরেক্ট (session callback এ role সেট হয়)
      // ছোট ডিলে দিয়ে session hydrate হওয়ার সময় দিন
      setTimeout(async () => {
        // ক্লায়েন্ট থেকে session ফেচ
        const me = await fetch("/api/auth/session"); // NextAuth built-in
        const json = await me.json();
        const role = (json?.user?.role || "").toLowerCase();

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
            : role === "data_entry"
            ? "/data_entry"
            : "/client";

        window.location.href = target;
      }, 150);
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
                  required
                  autoComplete="current-password"
                  className="placeholder:text-white/80 text-white pr-10"
                />
                <button
                  type="button"
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
