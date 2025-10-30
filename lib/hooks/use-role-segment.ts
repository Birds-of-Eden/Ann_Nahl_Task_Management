"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

const SEGMENT_PATTERN = /^[a-z0-9_-]+$/;

export function useRoleSegment(defaultSegment: string = "admin") {
  const pathname = usePathname();

  return useMemo(() => {
    const rawPath = typeof pathname === "string" ? pathname : "";
    const segment = rawPath.split("/").filter(Boolean)[0] ?? "";
    const normalized = segment.trim().toLowerCase();
    return SEGMENT_PATTERN.test(normalized) ? normalized : defaultSegment;
  }, [pathname, defaultSegment]);
}
