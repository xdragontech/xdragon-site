// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import {
  getClientIp,
  getCfCountryIso2,
  getUserAgent,
  iso2ToCountryName,
} from "../../../lib/requestIdentity";

const PROD_WWW_HOST = "www.xdragon.tech";
const PROD_ADMIN_HOST = "admin.xdragon.tech";
const STAGING_WWW_HOST = process.env.NEXT_PUBLIC_WWW_HOST || "staging.xdragon.tech";
const STAGING_ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST || "stg-admin.xdragon.tech";
const IS_PREVIEW =
  process.env.VERCEL_ENV === "preview" ||
  [STAGING_WWW_HOST, STAGING_ADMIN_HOST].some((h) => (process.env.NEXTAUTH_URL || "").includes(h));

function cookieName(kind: "session-token" | "callback-url"): string {
  return IS_PREVIEW ? `__Secure-stg-next-auth.${kind}` : `__Secure-next-auth.${kind}`;
}

function csrfCookieName(): string {
  return IS_PREVIEW ? "stg-next-auth.csrf-token" : "next-auth.csrf-token";
}

function cookieDomain(): string | undefined {
  if (IS_PREVIEW || process.env.VERCEL_ENV !== "production") return undefined;
  return process.env.AUTH_COOKIE_DOMAIN || ".xdragon.tech";
}

function cookieOptions({ httpOnly = true }: { httpOnly?: boolean } = {}) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    path: "/",
    secure: true,
    ...(cookieDomain() ? { domain: cookieDomain() } : {}),
  };
}

function allowedHosts(baseUrl: string): Set<string> {
  const set = new Set<string>([
    "xdragon.tech",
    PROD_WWW_HOST,
    PROD_ADMIN_HOST,
    STAGING_WWW_HOST,
    STAGING_ADMIN_HOST,
  ]);
  try {
    set.add(new URL(baseUrl).hostname.toLowerCase());
  } catch {}
  return set;
}

async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

function getXdAdminIdentity() {
  const username = (process.env.XDADMIN_USERNAME || "xdadmin").trim().toLowerCase();
  const email = (process.env.XDADMIN_EMAIL || "xdadmin@xdragon.tech").trim().toLowerCase();
  const password = process.env.XDADMIN_PASSWORD || "";
  return { username, email, password };
}

function isEnvAdminEmail(email: string | null | undefined): boolean {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL_LIST || process.env.ADMIN_USERS || "";
  if (!raw.trim()) return false;
  const set = new Set(
    raw
      .split(/[\s,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(e);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: true,
  pages: { signIn: "/auth/signin" },
  cookies: {
    sessionToken: {
      name: cookieName("session-token"),
      options: cookieOptions({ httpOnly: true }),
    },
    callbackUrl: {
      name: cookieName("callback-url"),
      options: cookieOptions({ httpOnly: true }),
    },
    csrfToken: {
      name: csrfCookieName(),
      options: cookieOptions({ httpOnly: true }),
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
        const emailRaw = credentials?.email?.trim() || "";
        const email = emailRaw.toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) return null;

        const xd = getXdAdminIdentity();
        if (email === xd.username || email === xd.email) {
          if (!xd.password || password !== xd.password) return null;
          try {
            const ip = getClientIp(req);
            const countryIso2 = getCfCountryIso2(req);
            const countryName = iso2ToCountryName(countryIso2);
            const userAgent = getUserAgent(req);
            await prisma.loginEvent.create({ data: { userId: "xdadmin", ip, userAgent, countryIso2, countryName } });
          } catch (err) {
            console.warn("xdadmin LoginEvent write failed:", err);
          }
          return { id: "xdadmin", email: xd.email, name: "xdadmin" };
        }

        const user = await getUserByEmail(email);
        if (!user || user.status === "BLOCKED" || !user.emailVerified || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        try {
          const ip = getClientIp(req);
          const countryIso2 = getCfCountryIso2(req);
          const countryName = iso2ToCountryName(countryIso2);
          const userAgent = getUserAgent(req);
          await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
            prisma.loginEvent.create({ data: { userId: user.id, ip, userAgent, countryIso2, countryName } }),
          ]);
        } catch (err) {
          console.warn("LoginEvent write failed:", err);
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

      const xd = getXdAdminIdentity();
      const tokenEmail = token.email ? String(token.email).toLowerCase() : "";
      if (tokenEmail && tokenEmail === xd.email) {
        (token as any).role = "ADMIN";
        (token as any).status = "ACTIVE";
        return token;
      }

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
          select: { role: true, status: true },
        });
        if (dbUser) {
          (token as any).role = dbUser.role;
          (token as any).status = dbUser.status;
        }
        if ((token as any).role !== "ADMIN" && isEnvAdminEmail(String(token.email))) {
          (token as any).role = "ADMIN";
        }
      }

      if ((token as any).role !== "ADMIN" && isEnvAdminEmail(String(token.email))) {
        (token as any).role = "ADMIN";
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = (token as any).role || "USER";
        (session.user as any).status = (token as any).status || "ACTIVE";
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const target = new URL(url);
        const host = target.hostname.toLowerCase();
        if (allowedHosts(baseUrl).has(host)) return url;
      } catch {}
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
