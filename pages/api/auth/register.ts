// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { ensurePublicBrandRequest, getCanonicalPublicOrigin } from "../../../lib/brandContext";
import { findOrBridgeExternalUserByEmail } from "../../../lib/externalIdentity";

/**
 * Password signup + email verification
 *
 * Flow:
 * 1) POST { email, password, name? }
 * 2) Create user with passwordHash + status
 * 3) Create verification token
 * 4) Email verification link
 * 5) Return { ok: true }
 *
 * Notes:
 * - This route is intentionally "best-effort" on email sending: we still create the user
 *   and return ok=true even if the notification email fails (we log it).
 * - Ensure you have these env vars set in Vercel + locally:
 *   - NEXTAUTH_URL (prod)
 *   - NEXTAUTH_SECRET
 *   - RESEND_API_KEY
 *   - RESEND_FROM (e.g. "X Dragon <hello@xdragon.tech>")
 *   - ADMIN_EMAILS (comma-separated) (optional, for admin notifications elsewhere)
 */

type Data =
  | { ok: true }
  | { ok: false; error: string };

function cleanEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  // simple sanity check (avoid over-rejecting)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendVerifyEmail(params: { to: string; url: string; brandName: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set; skipping verification email");
    return;
  }

  // Resend requires "Name <email@domain>" or "email@domain"
  const from =
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    "X Dragon <hello@xdragon.tech>";

  const subject = `Verify your email to access ${params.brandName}`;
  const text = [
    `Thanks for signing up for ${params.brandName}.`,
    "",
    "Verify your email to activate your account:",
    params.url,
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: params.to,
      subject,
      text,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.warn("Resend verify email failed:", resp.status, body);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const brandRequest = await ensurePublicBrandRequest(req, res);
  if (!brandRequest) return;

  const { brand } = brandRequest;

  try {
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Valid email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const existing = await findOrBridgeExternalUserByEmail(brand, email);
    if (existing) {
      // Avoid leaking whether account exists; respond ok.
      return res.status(200).json({ ok: true });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user (fields assumed to exist in your Prisma schema)
    const brandId = brand.brandId;
    if (!brandId) {
      return res.status(500).json({ ok: false, error: "Brand is missing a persisted brand record" });
    }

    await prisma.externalUser.create({
      data: {
        brandId,
        email,
        name,
        passwordHash,
        status: "ACTIVE",
        // emailVerified is kept null until verified
        emailVerified: null,
      },
    });

    // Create verification token (schema assumed to include EmailVerificationToken model)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.externalEmailVerificationToken.create({
      data: {
        brandId,
        identifier: email,
        token,
        expires: expiresAt,
      },
    });
    const verifyUrl = `${getCanonicalPublicOrigin(req, brand)}/auth/verify?token=${encodeURIComponent(token)}`;

    // Best-effort email
    await sendVerifyEmail({ to: email, url: verifyUrl, brandName: brand.brandName });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("register error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
