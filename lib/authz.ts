// lib/authz.ts
// ✅ NextAuth + RBAC গার্ড/হেল্পার (App Router friendly)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  roleId?: string | null;
  clientId?: string | null;
  permissions?: (string | number)[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) ?? null;
}

// ❌ 401
export function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

// ❌ 403
export function forbidden() {
  return NextResponse.json(
    { success: false, error: "Forbidden" },
    { status: 403 }
  );
}

// ✅ বেসিক প্রটেকশন
export async function requireAuth() {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false as const, res: unauthorized() };
  return { ok: true as const, user };
}

// ✅ রোল চেক (যেমন: ["admin"])
export async function requireRole(allowed: string[]) {
  const r = await requireAuth();
  if (!r.ok) return r;
  const role = (r.user.role || "").toLowerCase();
  if (!allowed.map((x) => x.toLowerCase()).includes(role)) {
    return { ok: false as const, res: forbidden() };
  }
  return r;
}

// ✅ পারমিশন চেক (id স্ট্রিং/নাম্বার যেটাই থাকুক)
export async function requirePermissions(required: (string | number)[]) {
  const r = await requireAuth();
  if (!r.ok) return r;
  const have = new Set((r.user.permissions ?? []).map(String));
  const need = required.map(String);
  const missing = need.filter((p) => !have.has(p));
  if (missing.length) return { ok: false as const, res: forbidden() };
  return r;
}

// ✅ HOF: রুটকে র‍্যাপ করুন (role/permissions)
type Guard =
  | { role: string[]; permissions?: never }
  | { role?: never; permissions: (string | number)[] }
  | { role?: never; permissions?: never };

export function withAuth<
  H extends (req: NextRequest, ctx?: any) => Promise<Response> | Response
>(handler: H, guard?: Guard) {
  return async (req: NextRequest, ctx?: any) => {
    // বেসিক auth
    const base = await requireAuth();
    if (!base.ok) return base.res;

    // role গার্ড
    if (guard?.role) {
      const r = await requireRole(guard.role);
      if (!r.ok) return r.res;
    }

    // permission গার্ড
    if (guard?.permissions) {
      const r = await requirePermissions(guard.permissions);
      if (!r.ok) return r.res;
    }

    return handler(req, ctx);
  };
}
