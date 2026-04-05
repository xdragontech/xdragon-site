import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalChangePassword } from "../../../../../lib/partnerPortalBff";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalChangePassword(req, res, "sponsors");
}
