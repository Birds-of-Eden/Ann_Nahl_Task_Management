// lib/impersonation.ts
import prisma from "@/lib/prisma";

export async function canImpersonate(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });
  if (!user) return { ok: false as const };

  const roleName = user.role?.name?.toLowerCase();
  if (roleName === "admin" || roleName === "am")
    return { ok: true as const, roleName };

  const perms =
    user.role?.rolePermissions.map((rp) => rp.permission.name) || [];
  if (perms.includes("user_impersonate"))
    return { ok: true as const, roleName };

  return { ok: false as const, roleName };
}

export async function amScopeCheck(amUserId: string, targetUserId: string) {
  // AM কেবল client ইউজারকে এবং নিজের ক্লায়েন্টস-অনারশিপের মধ্যে ইমপারসোনেট করতে পারবে
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  });
  if (!target) return { ok: false as const, reason: "Target user not found" };

  if (target.role?.name?.toLowerCase() !== "client") {
    return {
      ok: false as const,
      reason: "AM can only impersonate client users",
    };
  }
  if (!target.clientId) {
    return { ok: false as const, reason: "Target client link missing" };
  }
  const client = await prisma.client.findUnique({
    where: { id: target.clientId },
    select: { amId: true },
  });
  if (!client || String(client.amId) !== String(amUserId)) {
    return { ok: false as const, reason: "Not your client" };
  }
  return { ok: true as const };
}
