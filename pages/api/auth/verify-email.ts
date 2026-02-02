import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";

/**
 * POST /api/auth/verify-email
 * Body: { token: string }
 *
 * Supports either:
 *  - token stored as raw UUID in EmailVerificationToken.token
 *  - OR token stored hashed (sha256 hex) in EmailVerificationToken.token
 *
 * On success:
 *  - sets user.emailVerified
 *  - deletes verification token row
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { token } = req.body || {};
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) return res.status(400).json({ ok: false, error: "Missing token" });

    // Try raw token match first
    let rec = await prisma.emailVerificationToken.findUnique({ where: { token: raw } });

    // If not found, try sha256(token) (in case you store hashes)
    if (!rec) {
      const hashed = crypto.createHash("sha256").update(raw).digest("hex");
      rec = await prisma.emailVerificationToken.findUnique({ where: { token: hashed } });
    }

    if (!rec) return res.status(400).json({ ok: false, error: "Invalid verification token" });

    if (rec.expires < new Date()) {
      // Delete expired token
      await prisma.emailVerificationToken.delete({ where: { token: rec.token } }).catch(() => {});
      return res.status(410).json({ ok: false, error: "Verification token expired" });
    }

    // In your schema, identifier is the user's email
    const email = rec.identifier?.toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "Token missing identifier" });

    // Mark verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date(), status: "ACTIVE" },
    });

    // Burn token
    await prisma.emailVerificationToken.delete({ where: { token: rec.token } }).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("verify-email error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
