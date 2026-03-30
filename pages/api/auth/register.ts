import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicRegister, CommandPublicApiError } from "../../../lib/commandPublicApi";
import { getWebsiteAnalyticsSessionId } from "../../../lib/websiteAnalytics";
import { recordWebsiteRequestPerformance } from "../../../lib/websitePerformance";

type Data =
  | { ok: true; verificationRequired?: boolean }
  | { ok: false; error: string };

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = performance.now();
  let statusCode: number | undefined;

  try {
    const result = await commandPublicRegister({
      email: cleanEmail(req.body?.email),
      password: String(req.body?.password || ""),
      name: String(req.body?.name || "").trim() || null,
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    statusCode = 200;
    return res.status(statusCode).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      statusCode = error.status;
      return res.status(statusCode).json({ ok: false, error: error.message });
    }

    statusCode = 500;
    return res.status(statusCode).json({ ok: false, error: "Server error" });
  } finally {
    await recordWebsiteRequestPerformance({
      req,
      routeKey: "SIGNUP",
      durationMs: performance.now() - startedAt,
      statusCode,
    });
  }
}
