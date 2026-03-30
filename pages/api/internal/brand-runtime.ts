import type { NextApiRequest, NextApiResponse } from "next";
import { getRuntimeHostConfig } from "../../../lib/runtimeHostConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const host = Array.isArray(req.query.host) ? req.query.host[0] : req.query.host;
  const config = await getRuntimeHostConfig(String(host || ""));
  const runtime = config.runtime;

  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return res.status(200).json({ ok: true, runtime });
}
