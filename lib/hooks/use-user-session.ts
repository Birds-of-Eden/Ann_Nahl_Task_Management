// lib/hooks/use-user-session.ts
"use client";
import useSWR from "swr";

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

export const useUserSession = () => {
  const { data, mutate, isLoading } = useSWR("/api/auth/me", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });
  const user = data?.user ?? null;
  const permissions: string[] = user?.permissions ?? [];
  const hasPerm = (id?: string) => (id ? permissions.includes(id) : true);
  return {
    user,
    permissions,
    hasPerm,
    loading: isLoading,
    mutateAuthMe: () => mutate(),
  };
};
