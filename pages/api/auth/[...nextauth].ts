// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "../../../lib/prisma";

/**
 * Notes:
 * - Supports Email magic link (SMTP), optional Google/GitHub, and password login via Credentials.
 * - Password login requires a verified email. We treat a user as verified if:
 *   - user.emailVerified is set, OR
 *   - they have an OAuth/email Account record (created after completing an email/OAuth sign-in)
 * - Users can be BLOCKED via `status` in DB.
 * - Admin allowlist is via ADMIN_EMAILS (comma-separated).
 */

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isUserVerified(userId: string, emailVerified: Date | null): Promise<boolean> {
  if (emailVerified) return true;

  // If the user has ever completed a sign-in via email/OAuth, NextAuth creates an Account row.
  // That is strong evidence they control the email or provider identity.
  const acct = await prisma.account.findFirst({
    where: {
      userId,
      provider: { in: ["email", "google", "github"] },
    },
    select: { id: true },
  });

  return !!acct;
}

async function notifyAdminsNewSignup(params: { email?: string | null; name?: string | null; provider?: string }) {
  const to = parseAdminEmails();
  if (!to.length) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "hello@xdragon.tech";

  // best-effort (never break auth)
  try {
    const subject = `New Tools Signup — ${params.email || "unknown email"}`;
    const text = [
      "A new user signed up for X Dragon Tools.",
      "",
      `Email: ${params.email || ""}`,
      `Name: ${params.name || ""}`,
      `Provider: ${params.provider || ""}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn("Resend signup notify failed:", resp.status, body);
    }
  } catch (err) {
    console.warn("Signup notify error:", err);
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/auth/signin" },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT || 465),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "hello@xdragon.tech",
      maxAge: 24 * 60 * 60,
    }),

    // Optional OAuth providers (safe to keep enabled; sign-in page will show buttons only if configured)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),

    // Password login
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = (credentials?.password || "").trim();

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            emailVerified: true,
            status: true,
          },
        });

        if (!user) return null;
        if (user.status === "BLOCKED") return null;
        if (!user.passwordHash) return null;

        // Require verified email (or prior verified account sign-in)
        const verified = await isUserVerified(user.id, user.emailVerified);
        if (!verified) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { email: true, status: true, role: true },
      });

      if (existing?.status === "BLOCKED") return false;

      // Promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      if (existing && admins.includes(email) && existing.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // Track last login time (best-effort)
      try {
        if (existing) {
          await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
        }
      } catch (e) {
        console.warn("lastLoginAt update failed:", e);
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.email = user.email;
        session.user.name = user.name;
      }
      return session;
    },
  },
  events: {
    async createUser(message) {
      const email = message.user.email?.toLowerCase();
      const admins = parseAdminEmails();

      if (email && admins.includes(email)) {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      await notifyAdminsNewSignup({
        email: message.user.email,
        name: message.user.name,
        provider: "email_or_oauth",
      });
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
