import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalRegister } from "../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalRegister(req, res, "partners");
}
