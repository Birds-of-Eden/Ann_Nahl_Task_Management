// lib/hooks/use-user-session.ts
"use client";

import { useSession } from "next-auth/react";

export const useUserSession = () => {
  const { data, status } = useSession();
  return {
    user: (data?.user as any) ?? null,
    loading: status === "loading",
  };
};
