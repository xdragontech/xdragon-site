import type { NextApiRequest, NextApiResponse } from "next";

type Ok = { ok: true };
type Err = { ok: false; error: string };
type Resp = Ok | Err;

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL; // set to hello@xdragon.tech in Vercel env vars
  const CONTACT_FROM_EMAIL =
    process.env.CONTACT_FROM_EMAIL || "X Dragon Website <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    return res
      .status(500)
      .json({ ok: false, error: "Email service not configured (missing RESEND_API_KEY)." });
  }
  if (!CONTACT_TO_EMAIL) {
    return res
      .status(500)
      .json({ ok: false, error: "Email target not configured (missing CONTACT_TO_EMAIL)." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();
  const companyWebsite = String(body.company_website ?? "").trim(); // honeypot

  // Honeypot triggered: pretend success to avoid tipping off bots
  if (companyWebsite) return res.status(200).json({ ok: true });

  if (!name || name.length < 2) return res.status(400).json({ ok: false, error: "Please enter your name." });
  if (!email || !isEmail(email)) return res.status(400).json({ ok: false, error: "Please enter a valid email." });
  if (!message || message.length < 10)
    return res.status(400).json({ ok: false, error: "Please enter a message (at least 10 characters)." });

  // Basic length caps
  const safeName = name.slice(0, 120);
  const safeEmail = email.slice(0, 200);
  const safePhone = phone.slice(0, 80);
  const safeMessage = message.slice(0, 6000);

  const subject = `New contact request — ${safeName}`;

  const text = [
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    safePhone ? `Phone: ${safePhone}` : "",
    "",
    "Message:",
    safeMessage,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>New contact request</h2>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
      ${safePhone ? `<p><strong>Phone:</strong> ${escapeHtml(safePhone)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <pre style="white-space: pre-wrap; padding: 12px; background: #f5f5f5; border-radius: 12px;">${escapeHtml(
        safeMessage
      )}</pre>
    </div>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        subject,
        text,
        html,
      }),
    });

    if (!r.ok) {
      const details = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, error: "Email delivery failed.", ...(details ? { } : {}) });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: "Email delivery failed." });
  }
}
