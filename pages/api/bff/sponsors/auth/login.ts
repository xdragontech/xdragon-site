import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalLogin } from "../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalLogin(req, res, "sponsors");
}
