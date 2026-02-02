// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Subdomain-safe NextAuth config
 *
 * Fixes redirect/session loops when serving the same deployment on both
 * https://www.xdragon.tech and https://admin.xdragon.tech.
 *
 * Key idea: NextAuth uses NEXTAUTH_URL as its baseUrl. In a multi-host setup,
 * a single static NEXTAUTH_URL can cause callback URLs to hop to the wrong host
 * (and then your middleware bounces back), producing "too many redirects".
 *
 * We set NEXTAUTH_URL dynamically per request to the current host.
 */

function getRequestBaseUrl(req: NextApiRequest): string {
  const hostHeader = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  const protoHeader = (req.headers["x-forwarded-proto"] || "https").toString();

  const host = hostHeader.split(",")[0].trim();
  const proto = protoHeader.split(",")[0].trim();

  if (!host) return "https://www.xdragon.tech";
  return `${proto}://${host}`;
}

export const authOptions: NextAuthOptions = {
  // You can keep the adapter even with JWT sessions; it powers user lookup/management.
  adapter: PrismaAdapter(prisma),

  // Credentials sign-in in NextAuth v4 requires JWT sessions.
  session: { strategy: "jwt" },

  // Allow NextAuth to trust the incoming host (useful on Vercel).
  trustHost: true,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = (credentials?.password || "").trim();

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Only allow password sign-in if the account is verified + active.
        if (user.status === "BLOCKED") return null;
        if (!user.emailVerified) return null;
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name || undefined,
          email: user.email || undefined,
          // Pass through extra fields via `jwt` callback.
          role: user.role,
          status: user.status,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, NextAuth provides `user`.
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.status = (user as any).status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session as any).role = token.role;
        (session as any).status = token.status;
      }
      return session;
    },
  },

  // Share the session token across subdomains (www + admin) so you don't have to
  // log in twice. This also helps avoid edge-case loops where a callback lands on
  // the other subdomain.
  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        domain: ".xdragon.tech",
      },
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
  // IMPORTANT: set baseUrl dynamically per request.
  // This prevents NEXTAUTH_URL from forcing callbacks to the wrong host.
  process.env.NEXTAUTH_URL = getRequestBaseUrl(req);

  return NextAuth(req, res, authOptions);
}
