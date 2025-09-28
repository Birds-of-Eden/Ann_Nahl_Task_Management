// app/(main)/auth/sign-in/login-form.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader, Eye, EyeOff, Shield, LogIn } from "lucide-react";
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
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Invalid credentials");
        return;
      }

      toast.success("Signed in successfully!");

      // Optional heartbeat
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

      window.location.href = target;
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-transparent border-none shadow-none font-sans">
      <CardHeader className="space-y-6">
        <div className="flex flex-col items-center space-y-6">
          {/* Enhanced Logo Container */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-all duration-500 animate-pulse"></div>

            {/* Logo Background */}
            <div className="relative bg-slate-800/90 p-6 rounded-xl border border-cyan-500/30 backdrop-blur-sm group-hover:border-cyan-400/50 transition-all duration-300 shadow-2xl">
              {/* Actual Logo - Adjust height as needed */}
              <img
                src="/aan-logo.png"
                alt="AAN Logo"
                className="h-14 w-auto object-contain transition-all duration-300 group-hover:scale-110"
                onError={(e) => {
                  // Fallback if logo doesn't load
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            </div>

            {/* Floating particles effect */}
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 animate-ping"></div>
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 animate-ping delay-300"></div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent animate-gradient leading-tight">
            TASK MANAGEMENT
          </CardTitle>
          <p className="text-slate-300 text-lg font-medium tracking-wider bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
            Secure Workspace Access
          </p>
        </div>
      </CardHeader>

      <CardContent className="bg-transparent pt-6">
        <form onSubmit={handleSubmit} className="space-y-7">
          <div className="space-y-5">
            <div className="space-y-3">
              <Label
                htmlFor="email"
                className="text-slate-200 font-semibold text-base flex items-center space-x-2"
              >
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <span>Email Address</span>
              </Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                required
                autoComplete="username"
                className="bg-slate-700/60 border-slate-500 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-400 transition-all duration-300 focus:scale-[1.02] text-lg py-6 px-4 font-medium rounded-lg"
                disabled={loading}
              />
            </div>
            <div className="space-y-3">
              <Label
                htmlFor="password"
                className="text-slate-200 font-semibold text-base flex items-center space-x-2"
              >
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Password</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="bg-slate-700/60 border-slate-500 text-white placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-400 pr-12 transition-all duration-300 focus:scale-[1.02] text-lg py-6 px-4 font-medium rounded-lg"
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-300 hover:text-cyan-300 transition-all duration-300 hover:scale-125 disabled:opacity-50"
                  tabIndex={-1}
                  disabled={loading}
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className={cn(
              "relative w-full rounded-xl px-8 py-4 font-bold text-white text-lg",
              "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500",
              "transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-2xl",
              "shadow-xl shadow-cyan-500/30 hover:shadow-cyan-400/50",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
              "border border-cyan-400/40 hover:border-cyan-300/60",
              "group overflow-hidden"
            )}
            disabled={loading}
          >
            {/* Animated background shine */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            {loading ? (
              <div className="flex items-center justify-center space-x-3 relative z-10">
                <Loader className="animate-spin w-5 h-5" />
                <span className="text-lg">Signing In...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center space-x-3 relative z-10">
                <LogIn className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-1" />
                <span className="text-lg tracking-wide">Sign In</span>
              </span>
            )}
          </Button>

          <div className="text-center pt-2">
            <p className="text-sm text-slate-400 font-medium bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent">
              Enterprise-Grade Security • Premium Experience
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
