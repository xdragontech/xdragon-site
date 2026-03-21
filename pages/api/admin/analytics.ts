import type { NextApiRequest, NextApiResponse } from "next";
import { requireBackofficeApi } from "../../../lib/backofficeAuth";
import { prisma } from "../../../lib/prisma";

type Ok = {
  ok: true;
  // Counts are UNIQUE "contacts" (not total events/messages).
  totals: { total: number; contact: number; chat: number };
  last7d: { contact: number; chat: number };
  updatedAt: string;
};

type Err = { ok: false; error: string };

type Resp = Ok | Err;

function countDistinctLeadContacts(
  rows: Array<{
    id: string;
    source: "CHAT" | "CONTACT";
    leadId: string | null;
    conversationId: string | null;
    raw: any;
  }>
) {
  const seenChat = new Set<string>();
  const seenContact = new Set<string>();

  for (const row of rows) {
    if (row.source === "CHAT") {
      seenChat.add(row.conversationId || row.leadId || row.id);
      continue;
    }

    const email =
      row.raw?.lead?.email ||
      row.raw?.email ||
      row.id;
    seenContact.add(row.leadId || email || row.id);
  }

  return {
    chat: seenChat.size,
    contact: seenContact.size,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireBackofficeApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  try {
    if (auth.principal.role !== "SUPERADMIN") {
      const [allRows, last7Rows] = await Promise.all([
        prisma.leadEvent.findMany({
          where: {
            brandId: { in: auth.principal.allowedBrandIds },
          },
          select: {
            id: true,
            source: true,
            leadId: true,
            conversationId: true,
            raw: true,
          },
        }),
        prisma.leadEvent.findMany({
          where: {
            brandId: { in: auth.principal.allowedBrandIds },
            createdAt: { gte: since },
          },
          select: {
            id: true,
            source: true,
            leadId: true,
            conversationId: true,
            raw: true,
          },
        }),
      ]);

      const totals = countDistinctLeadContacts(allRows as any);
      const last7d = countDistinctLeadContacts(last7Rows as any);

      return res.status(200).json({
        ok: true,
        totals: { total: totals.chat + totals.contact, contact: totals.contact, chat: totals.chat },
        last7d: { contact: last7d.contact, chat: last7d.chat },
        updatedAt: new Date().toISOString(),
      });
    }

    // UNIQUE contacts:
    // - CHAT: distinct conversationId (fallback to leadId when conversationId is null)
    // - CONTACT: distinct leadId (fallback to email when leadId is null)
    //
    // We use SQL COUNT(DISTINCT ...) for correctness and performance.
    const [chatTotalRow, contactTotalRow, chat7Row, contact7Row] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("conversationId", "leadId", "id")) AS n
        FROM "LeadEvent"
        WHERE "source" = 'CHAT'
      `,
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("leadId", ("raw"->'lead'->>'email'), ("raw"->>'email'), "id")) AS n
        FROM "LeadEvent"
        WHERE "source" = 'CONTACT'
      `,
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("conversationId", "leadId", "id")) AS n
        FROM "LeadEvent"
        WHERE "source" = 'CHAT' AND "createdAt" >= ${since}
      `,
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT COALESCE("leadId", ("raw"->'lead'->>'email'), ("raw"->>'email'), "id")) AS n
        FROM "LeadEvent"
        WHERE "source" = 'CONTACT' AND "createdAt" >= ${since}
      `,
    ]);

    const chat = Number(chatTotalRow?.[0]?.n ?? 0);
    const contact = Number(contactTotalRow?.[0]?.n ?? 0);
    const last7Chat = Number(chat7Row?.[0]?.n ?? 0);
    const last7Contact = Number(contact7Row?.[0]?.n ?? 0);

    return res.status(200).json({
      ok: true,
      totals: { total: chat + contact, contact, chat },
      last7d: { contact: last7Contact, chat: last7Chat },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("/api/admin/analytics failed", e);
    const msg = e instanceof Error ? e.message : "Failed to load analytics";
    return res.status(500).json({ ok: false, error: msg || "Failed to load analytics" });
  }
}
