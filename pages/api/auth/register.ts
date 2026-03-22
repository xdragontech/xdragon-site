// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { ensurePublicBrandRequest, getCanonicalPublicOrigin } from "../../../lib/brandContext";
import { resolveBrandEmailConfig, sendBrandEmail, type BrandEmailRuntimeConfig } from "../../../lib/brandEmail";
import { findExternalUserByEmail } from "../../../lib/externalIdentity";
import { commandPublicRegister, isCommandPublicApiEnabled, CommandPublicApiError } from "../../../lib/commandPublicApi";

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
 * - This route now requires an ACTIVE BrandEmailConfig for the resolved brand.
 * - We block signup before user creation when the brand email setup is incomplete.
 */

type Data =
  | { ok: true; verificationRequired?: boolean }
  | { ok: false; error: string };

function cleanEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  // simple sanity check (avoid over-rejecting)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendVerifyEmail(params: {
  to: string;
  url: string;
  brandName: string;
  emailConfig: BrandEmailRuntimeConfig;
}) {
  const subject = `Verify your email to access ${params.brandName}`;
  const text = [
    `Thanks for signing up for ${params.brandName}.`,
    "",
    "Verify your email to activate your account:",
    params.url,
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");
  await sendBrandEmail({
    config: params.emailConfig,
    to: params.to,
    subject,
    text,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (isCommandPublicApiEnabled()) {
    try {
      const result = await commandPublicRegister({
        email: cleanEmail(req.body?.email),
        password: String(req.body?.password || ""),
        name: String(req.body?.name || "").trim() || null,
      });

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CommandPublicApiError) {
        return res.status(error.status).json({ ok: false, error: error.message });
      }
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }

  const brandRequest = await ensurePublicBrandRequest(req, res);
  if (!brandRequest) return;

  const { brand } = brandRequest;

  try {
    const emailConfig = await resolveBrandEmailConfig(brand, "auth");
    if (!emailConfig.ok) {
      return res.status(emailConfig.status).json({ ok: false, error: emailConfig.error });
    }

    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Valid email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const existing = await findExternalUserByEmail(brand, email);
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
    await sendVerifyEmail({
      to: email,
      url: verifyUrl,
      brandName: brand.brandName,
      emailConfig: emailConfig.config,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("register error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
