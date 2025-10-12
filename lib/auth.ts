// lib/auth.ts
import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher/server";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString() || "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  pages: { signIn: "/auth/sign-in" },
  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: any;
      account: any;
      profile?: any;
    }) {
      if (account?.provider === "google" && user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            const clientRole = await prisma.role.findUnique({
              where: { id: "client" },
            });

            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || profile?.name || "Google User",
                emailVerified: true,
                roleId: clientRole?.id || null,
                status: "active",
              },
            });

            user.id = newUser.id;
          } else {
            user.id = existingUser.id;
          }
        } catch (error) {
          console.error("Error creating/finding Google user:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: string }) {
      // ✅ On sign-in, enrich token with user role
      if (user?.id) {
        token.sub = user.id;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { role: true },
          });
          token.role = dbUser?.role?.name ?? null;
          token.roleId = dbUser?.roleId ?? null;
        } catch (error) {
          console.error("[JWT Callback] Error fetching user role:", error);
          token.role = null;
        }
      }

      // ✅ On subsequent requests, refresh role if needed
      // This handles role changes without requiring re-login
      if (trigger === "update" && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            include: { role: true },
          });
          token.role = dbUser?.role?.name ?? null;
          token.roleId = dbUser?.roleId ?? null;
        } catch (error) {
          console.error("[JWT Callback] Error refreshing role:", error);
        }
      }

      return token;
    },
    async redirect({
      url,
      baseUrl,
      token,
    }: {
      url: string;
      baseUrl: string;
      token?: any;
    }) {
      if (url.startsWith("/")) url = baseUrl + url;
      try {
        const target = new URL(url);
        if (target.origin !== baseUrl) return baseUrl;
        if (target.pathname === "/auth/sign-in") {
          const role = (token?.role || "").toLowerCase();
          const dest =
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
          return baseUrl + dest;
        }
        return url;
      } catch {
        return baseUrl;
      }
    },
    async session({ session, token }: { session: any; token: any }) {
      if (!session.user || !token?.sub) return session;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub },
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      });

      session.user.id = token.sub;
      (session.user as any).role = dbUser?.role?.name ?? null;
      (session.user as any).roleId = dbUser?.roleId ?? null;
      (session.user as any).clientId = dbUser?.clientId ?? null;
      (session.user as any).permissions =
        dbUser?.role?.rolePermissions.map((rp) => rp.permission.id) ?? [];

      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      try {
        const id = `log_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        const log = await prisma.activityLog.create({
          data: {
            id,
            entityType: "auth",
            entityId: (user as any)?.id ?? user.email ?? "unknown",
            userId: (user as any)?.id ?? undefined,
            action: "sign_in",
            details: {
              provider: account?.provider ?? "unknown",
              email: user.email ?? null,
              name: user.name ?? null,
            },
          },
        });
        try {
          await pusherServer.trigger("activity", "activity:new", {
            id: log.id,
            entityType: log.entityType,
            entityId: log.entityId,
            action: log.action,
            details: log.details,
            timestamp: (log as any).timestamp ?? new Date().toISOString(),
          });
        } catch {}
      } catch (e) {}
    },
    async signOut({ token }) {
      try {
        const id = `log_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`;
        const entityId =
          (token as any)?.sub ?? (token as any)?.email ?? "unknown";
        const log = await prisma.activityLog.create({
          data: {
            id,
            entityType: "auth",
            entityId,
            userId: (token as any)?.sub ?? undefined,
            action: "sign_out",
            details: {
              email: (token as any)?.email ?? null,
            },
          },
        });
        try {
          await pusherServer.trigger("activity", "activity:new", {
            id: log.id,
            entityType: log.entityType,
            entityId: log.entityId,
            action: log.action,
            details: log.details,
            timestamp: (log as any).timestamp ?? new Date().toISOString(),
          });
        } catch {}
      } catch (e) {}
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
