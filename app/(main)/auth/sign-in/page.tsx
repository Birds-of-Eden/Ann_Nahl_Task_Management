// app/(main)/auth/sign-in/page.tsx

"use client";

import { BackgroundGradient } from "@/components/ui/background-gradient";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-svh flex items-center justify-center px-6 py-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(30deg,#1e293b_12%,transparent_12.5%,transparent_87%,#1e293b_87.5%,#1e293b)] bg-[length:60px_60px] opacity-10"></div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 -left-10 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-10 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>

      <BackgroundGradient
        containerClassName="w-full max-w-md rounded-2xl border border-slate-700/50 shadow-2xl"
        className="p-8 bg-slate-800/80 backdrop-blur-sm"
      >
        <LoginForm />
      </BackgroundGradient>
    </div>
  );
}
