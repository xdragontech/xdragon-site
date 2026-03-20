import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/auth";
import { createEditableBrand, listEditableBrands } from "../../../../lib/brandRegistry";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });
  if (auth.principal.role !== "SUPERADMIN") return json(res, 403, { ok: false, error: "Forbidden" });

  try {
    if (req.method === "GET") {
      const query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
      const brands = await listEditableBrands(String(query || ""));
      return json(res, 200, { ok: true, brands });
    }

    if (req.method === "POST") {
      const brand = await createEditableBrand(req.body || {});
      return json(res, 200, { ok: true, brand });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Server error";
    return json(res, 400, { ok: false, error: message });
  }
}
