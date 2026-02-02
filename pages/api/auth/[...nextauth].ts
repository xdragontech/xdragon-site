// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

function cookieDomain(): string | undefined {
  // Share the session cookie between www.xdragon.tech and admin.xdragon.tech in production.
  // In local dev, DO NOT set a Domain attribute (browsers will reject it).
  if (process.env.NODE_ENV !== "production") return undefined;

  // Allow override if you ever change domains.
  return process.env.AUTH_COOKIE_DOMAIN || ".xdragon.tech";
}

async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Credentials sign-in requires JWT strategy in NextAuth v4.
  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: true,

  // Keep the default user sign-in page. Admin routes should redirect to /admin/signin via middleware.
  pages: { signIn: "/auth/signin" },

  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: cookieDomain(),
      },
    },
    callbackUrl: {
      name: "__Secure-next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: cookieDomain(),
      },
    },
    csrfToken: {
      // Use a non-__Host cookie so we can share across subdomains when desired.
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: cookieDomain(),
      },
    },
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        if (!user) return null;

        // Enforce your safety controls.
        if (user.status === "BLOCKED") return null;
        if (!user.emailVerified) return null;

        // Password login only for users with a password set.
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Optional: update last login time
        try {
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        } catch {
          // best-effort
        }

// Record login IP (best-effort; do not block auth on logging failure)
try {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.loginEvent.create({ data: { userId: user.id, ip, userAgent } }),
  ]);
} catch (err) {
  console.warn("LoginEvent write failed:", err);
  // still allow login
}



        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      // Pull role/status from DB (keeps token accurate if you block/unblock).
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { role: true, status: true },
        });
        if (dbUser) {
          (token as any).role = dbUser.role;
          (token as any).status = dbUser.status;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = typeof token.email === "string" ? token.email : session.user.email;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        (session.user as any).id = typeof token.sub === "string" ? token.sub : undefined;
      }
      (session as any).role = (token as any).role;
      (session as any).status = (token as any).status;
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Prevent redirects to unexpected hosts (e.g. *.vercel.app) while still
      // allowing www/admin subdomains + the apex domain.
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;

        const target = new URL(url);
        const host = target.hostname.toLowerCase();

        const allowed =
          host === "xdragon.tech" ||
          host === "www.xdragon.tech" ||
          host === "admin.xdragon.tech" ||
          host.endsWith(".xdragon.tech");

        if (allowed) return url;
      } catch {
        // fall through
      }
      return baseUrl;
    },
  },

  logger: {
    error(code, metadata) {
      console.error("NextAuth error", code, metadata);
    },
    warn(code) {
      console.warn("NextAuth warn", code);
    },
  },
};

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
