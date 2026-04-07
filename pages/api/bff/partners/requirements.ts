import type { NextApiRequest, NextApiResponse } from "next";
import { handleParticipantPortalRequirements } from "../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleParticipantPortalRequirements(req, res);
}
