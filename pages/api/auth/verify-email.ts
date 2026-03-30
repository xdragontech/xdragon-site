import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicVerifyEmail, CommandPublicApiError } from "../../../lib/commandPublicApi";
import { getWebsiteAnalyticsSessionId } from "../../../lib/websiteAnalytics";
import { recordWebsiteRequestPerformance } from "../../../lib/websitePerformance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = performance.now();
  let statusCode: number | undefined;

  try {
    const result = await commandPublicVerifyEmail({
      token: typeof req.body?.token === "string" ? req.body.token : "",
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
      routeKey: "VERIFY_EMAIL",
      durationMs: performance.now() - startedAt,
      statusCode,
    });
  }
}
