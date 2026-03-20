import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/auth";
import { deleteEditableBrand, updateEditableBrand } from "../../../../lib/brandRegistry";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return json(res, 400, { ok: false, error: "Missing id" });

  try {
    if (req.method === "PATCH" || req.method === "PUT" || req.method === "POST") {
      const brand = await updateEditableBrand(id, req.body || {});
      return json(res, 200, { ok: true, brand });
    }

    if (req.method === "DELETE") {
      await deleteEditableBrand(id);
      return json(res, 200, { ok: true });
    }

    res.setHeader("Allow", "PATCH, PUT, POST, DELETE");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Server error";
    return json(res, 400, { ok: false, error: message });
  }
}
