// context/auth-context.tsx  (NextAuth wrapper ভার্সন)
"use client";

import React, { createContext, useContext } from "react";
import { useSession, signOut } from "next-auth/react";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  // permissions আপনি session callback-এ ids পাঠাচ্ছেন—number[]/string[] যেটা দিয়েছেন সেটা দিন
  permissions?: string[] | number[];
  roleId?: string | null;
  clientId?: string | null;
};

interface AuthContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  // setUser তুলে দিলাম—NextAuth session মিউটেট করা উচিত না
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, status } = useSession();
  const user = (data?.user as User) ?? null;

  const logout = async () => {
    await signOut({ callbackUrl: "/auth/sign-in" });
  };

  return (
    <AuthContext.Provider value={{ user, status, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
