// lib/auth.ts (NextAuth v4 + JWT, no PrismaAdapter)
import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // ⛳ JWT session to avoid PrismaAdapter/schema mismatch
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = creds?.email?.toString().trim().toLowerCase();
        const password = creds?.password?.toString() || "";
        if (!email || !password) return null;

        // আপনার schema অনুসারে: User.passwordHash
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

        // lastSeenAt (ঐচ্ছিক)
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        // v4 + JWT: user রিটার্ন করলেই টোকেনে যাবে
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        } as any;
      },
    }),
  ],

  callbacks: {
    // JWT-তে যা লাগবে সেট করুন (প্রথম সাইনইনে user থাকে)
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id; // ensure user id on token
      }
      return token;
    },

    // session.user-এ আপনার কাস্টম ফিল্ডগুলো বসান
    async session({ session, token }) {
      if (!session.user || !token?.sub) return session;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.sub as string },
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } },
          },
        },
      });

      (session.user as any).id = token.sub;
      (session.user as any).role = dbUser?.role?.name ?? null;
      (session.user as any).roleId = dbUser?.roleId ?? null;
      (session.user as any).clientId = dbUser?.clientId ?? null;
      (session.user as any).permissions =
        dbUser?.role?.rolePermissions.map((rp) => rp.permission.id) ?? [];

      return session;
    },
  },

  pages: { signIn: "/auth/sign-in" },
};

// App Router (v4) handler export
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
