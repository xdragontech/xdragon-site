import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicLogout } from "../../../../lib/commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "../../../../lib/commandBffSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandBffSessionToken(req);

  try {
    if (sessionToken) {
      await commandPublicLogout(sessionToken);
    }
  } catch (error) {
    console.warn("[bff/logout] upstream logout failed", error);
  } finally {
    clearCommandBffSessionCookie(res);
  }

  return res.status(200).json({ ok: true });
}
