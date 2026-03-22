import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicLogout, isCommandPublicApiEnabled } from "../../../../lib/commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "../../../../lib/commandBffSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandBffSessionToken(req);

  try {
    if (isCommandPublicApiEnabled() && sessionToken) {
      await commandPublicLogout(sessionToken);
    }
  } catch (error) {
    console.warn("[bff/logout] upstream logout failed", error);
  } finally {
    clearCommandBffSessionCookie(res);
  }

  return res.status(200).json({ ok: true });
}
