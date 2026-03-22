import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicGetSession,
  isCommandPublicApiEnabled,
  isUnauthorizedCommandError,
  CommandPublicApiError,
  logCommandPublicApiError,
} from "../../../../lib/commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "../../../../lib/commandBffSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isCommandPublicApiEnabled()) {
    return res.status(503).json({ ok: false, error: "Command public API is not configured" });
  }

  const sessionToken = getCommandBffSessionToken(req);
  if (!sessionToken) {
    clearCommandBffSessionCookie(res);
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const result = await commandPublicGetSession(sessionToken);
    return res.status(200).json({
      ok: true,
      account: result.account,
    });
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      if (error instanceof CommandPublicApiError) {
        logCommandPublicApiError("bff-auth-session-unauthorized", error, {
          requestHost: req.headers.host || null,
          hasSessionCookie: true,
        });
      }
      clearCommandBffSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError("bff-auth-session", error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    console.error("[bff-auth-session] unexpected error", error);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
