import type { NextApiRequest, NextApiResponse } from "next";
import { requireBackofficeApi } from "../../../lib/backofficeAuth";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

function retiredMessage() {
  return "Legacy login geo backfill has been retired from xdragon-site. Use the command backoffice for supported reporting and geo tooling.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireBackofficeApi(req, res, { superadminOnly: true });
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });

  if (req.method === "GET" || req.method === "POST") {
    return json(res, 410, { ok: false, error: retiredMessage() });
  }

  res.setHeader("Allow", "GET, POST");
  return json(res, 405, { ok: false, error: "Method not allowed" });
}
