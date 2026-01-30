import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

type Data =
  | { ok: true; id?: string }
  | { ok: false; error: string; details?: unknown };

function getEnv() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

  // Prefer explicit names, but support legacy ones you already use in Vercel.
  const FROM =
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    process.env.CONTACT_FROM_EMAIL ||
    "";

  const TO =
    process.env.RESEND_TO_EMAIL ||
    process.env.CONTACT_TO_EMAIL ||
    process.env.CONTACT_TO ||
    "";

  return { RESEND_API_KEY, FROM, TO };
}

function isEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function cleanStr(v: unknown, max = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { RESEND_API_KEY, FROM, TO } = getEnv();

  if (!RESEND_API_KEY) {
    return res.status(500).json({ ok: false, error: "Missing RESEND_API_KEY" });
  }
  if (!FROM) {
    return res.status(500).json({ ok: false, error: "Missing sender env var (set RESEND_FROM or RESEND_FROM_EMAIL)" });
  }
  if (!TO) {
    return res.status(500).json({ ok: false, error: "Missing recipient env var (set RESEND_TO_EMAIL)" });
  }

  const name = cleanStr(req.body?.name, 200);
  const email = cleanStr(req.body?.email, 320);
  const phone = cleanStr(req.body?.phone, 80);
  const message = cleanStr(req.body?.message, 4000);

  if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
  if (!isEmail(email)) return res.status(400).json({ ok: false, error: "Valid email is required" });
  if (!message) return res.status(400).json({ ok: false, error: "Message is required" });

  try {
    const resend = new Resend(RESEND_API_KEY);

    const subject = `New contact request — ${name}`;
    const text = [
      "New website contact request:",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : "Phone: (not provided)",
      "",
      "Message:",
      message,
      "",
      `Sent from: ${req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown IP"}`,
    ].join("\n");

    const result = await resend.emails.send({
      from: FROM, // must be verified in Resend
      to: [TO],
      replyTo: email,
      subject,
      text,
    });

    const id =
      (result as any)?.data?.id ||
      (result as any)?.id ||
      undefined;

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error("Contact email send failed", e);
    return res.status(500).json({ ok: false, error: "Failed to send message", details: e });
  }
}
