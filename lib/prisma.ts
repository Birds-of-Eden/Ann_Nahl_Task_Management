// lib/prisma.ts

import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // ✅ Connection pool configuration for better performance
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// ✅ Connection pooling optimization
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// ✅ Optimized Middleware: Cache roles to avoid repeated DB queries
const roleCache = new Map<string, string>();
let roleCacheInitialized = false;

// Initialize role cache on first use
async function initRoleCache() {
  if (roleCacheInitialized) return;
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  roles.forEach(r => roleCache.set(r.name, r.id));
  roleCacheInitialized = true;
}

prisma.$use(async (params, next) => {
  if (params.model === "User" && params.action === "create") {
    const data = params.args.data;
    if (data.role && typeof data.role === "string") {
      const roleName = data.role;
      delete data.role;
      
      // Initialize cache if needed
      await initRoleCache();
      
      const roleId = roleCache.get(roleName);
      if (roleId) {
        data.role = { connect: { id: roleId } };
      } else {
        console.warn(
          `Prisma Middleware: Role '${roleName}' not found in cache. User will be created without a linked role.`
        );
      }
    }
  }
  return next(params);
});

export default prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
