// pages/api/admin/backfill-login-geo.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

type Ok = {
  ok: true;
  processed: number;
  updated: number;
  skippedPrivate: number;
  unresolved: number;
  remainingMissing: number;
  dryRun: boolean;
};

type Err = { ok: false; error: string };

function getSessionRole(session: any): string | null {
  return (session?.role as string) || (session?.user?.role as string) || null;
}

function isPrivateIp(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

// Normalizes common stored IP formats:
// - "1.2.3.4, 10.0.0.1"  -> "1.2.3.4"
// - "1.2.3.4:12345"      -> "1.2.3.4"
// - "::ffff:1.2.3.4"     -> "1.2.3.4"
// - "[2001:db8::1]:443"  -> "2001:db8::1"
function normalizeIp(raw: string): string {
  let ip = (raw || "").trim();
  if (!ip) return "";

  // Take first from comma-separated (X-Forwarded-For style)
  if (ip.includes(",")) ip = ip.split(",")[0].trim();

  // IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);

  // Bracketed IPv6 with port: [::1]:1234
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
    return ip.trim();
  }

  // Strip port for IPv4 a.b.c.d:port
  const v4Port = ip.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}):(\d{1,5})$/);
  if (v4Port) return v4Port[1].trim();

  // Heuristic: unbracketed IPv6 rarely includes a port here; keep as-is.
  return ip;
}

type Geo = { name: string | null; iso2: string | null };
const geoCache: Map<string, Geo> =
  (global as any).__xdragonGeoCacheBackfill || ((global as any).__xdragonGeoCacheBackfill = new Map<string, Geo>());

const iso2ToCountryName = (iso2: string | null): string | null => {
  if (!iso2) return null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (dn.of(iso2.trim().toUpperCase()) as string) || null;
  } catch {
    return null;
  }
};

async function geoForIp(ip: string): Promise<Geo> {
  const empty: Geo = { name: null, iso2: null };
  if (!ip) return empty;
  if (isPrivateIp(ip)) return { name: "Private", iso2: null };
  if (geoCache.has(ip)) return geoCache.get(ip) ?? empty;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,continent_code,country_code`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!resp.ok) {
      geoCache.set(ip, empty);
      return empty;
    }
    const data: any = await resp.json();
    if (!data?.success) {
      geoCache.set(ip, empty);
      return empty;
    }
    const iso2 = typeof data.country_code === "string" ? data.country_code.toUpperCase() : null;
    const name = typeof data.country === "string" ? data.country : iso2ToCountryName(iso2);
    const out = { iso2, name };
    geoCache.set(ip, out);
    return out;
  } catch {
    geoCache.set(ip, empty);
    return empty;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Treat GET as a safe dry-run convenience (so you can run it in a browser).
  // Writes are only allowed via POST.
  const forceDryRun = req.method === "GET";
  // Auth: must be signed in AND an ADMIN.
  const session = await getServerSession(req, res, authOptions as any);
  const role = getSessionRole(session);
  if (!session || role !== "ADMIN") return res.status(401).json({ ok: false, error: "Unauthorized" });

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const dryRunRaw = Array.isArray(req.query.dryRun) ? req.query.dryRun[0] : req.query.dryRun;

  const limit = Math.max(1, Math.min(2000, Number(limitRaw || 500) || 500));
  const dryRun = forceDryRun || (String(dryRunRaw || "").toLowerCase() === "true");

  // Build a "known geo" map from existing login events that already have country data.
  // This avoids external geo lookups entirely for IPs we've seen since geo capture was enabled.
  const known = await prisma.loginEvent.findMany({
    where: {
      AND: [{ countryIso2: { not: null } }, { countryName: { not: null } }],
    },
    select: { ip: true, countryIso2: true, countryName: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const ipToGeo = new Map<string, Geo>();
  for (const row of known) {
    const ipNorm = normalizeIp(row.ip);
    if (!ipNorm || isPrivateIp(ipNorm)) continue;
    if (ipToGeo.has(ipNorm)) continue; // keep most-recent (query is DESC)
    ipToGeo.set(ipNorm, {
      iso2: row.countryIso2 ? String(row.countryIso2).toUpperCase() : null,
      name: row.countryName ? String(row.countryName) : null,
    });
  }

  // Pull a batch of historical logins missing country info.
  const missing = await prisma.loginEvent.findMany({
    where: {
      OR: [{ countryIso2: null }, { countryName: null }],
    },
    select: { id: true, ip: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let processed = 0;
  let updated = 0;
  let skippedPrivate = 0;
  let unresolved = 0;
  let matchedExisting = 0;
  let resolvedExternal = 0;

  // Group ids by resolved iso2+name so we can updateMany efficiently.
  const updatesByKey = new Map<string, { iso2: string; name: string; ids: string[] }>();

  for (const row of missing) {
    processed += 1;
    const ipNorm = normalizeIp(row.ip);
    if (!ipNorm || isPrivateIp(ipNorm)) {
      skippedPrivate += 1;
      continue;
    }

    // 1) Prefer first-party geo captured on newer login events (self-healing).
    const knownGeo = ipToGeo.get(ipNorm);
    if (knownGeo?.iso2 || knownGeo?.name) matchedExisting += 1;
    let geo: Geo | null = knownGeo ? { iso2: knownGeo.iso2, name: knownGeo.name } : null;

    // 2) Fallback to external geo only if we have never seen this IP with geo data.
    if (!geo?.iso2 && !geo?.name) {
      geo = await geoForIp(ipNorm);
      if (geo?.iso2 || geo?.name) resolvedExternal += 1;
    }

    if (!geo?.iso2 && !geo?.name) {
      unresolved += 1;
      continue;
    }

    const iso2 = (geo.iso2 || "").trim().toUpperCase();
    const name = (geo.name || iso2ToCountryName(iso2) || "Unknown").trim();
    if (!iso2 && !name) {
      unresolved += 1;
      continue;
    }

    const key = `${iso2}::${name}`;
    const existing = updatesByKey.get(key);
    if (existing) {
      existing.ids.push(row.id);
    } else {
      updatesByKey.set(key, { iso2, name, ids: [row.id] });
    }
  }

  if (!dryRun) {
    // Avoid iterating MapIterator directly (can fail under TS downlevel targets)
    const batches = Array.from(updatesByKey.values());
    for (let i = 0; i < batches.length; i++) {
      const { iso2, name, ids } = batches[i];
      if (!ids.length) continue;
      const result = await prisma.loginEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          countryIso2: iso2 || null,
          countryName: name || null,
        },
      });
      updated += result.count;
    }
  }

  const remainingMissing = await prisma.loginEvent.count({
    where: {
      OR: [{ countryIso2: null }, { countryName: null }],
    },
  });

  return res.status(200).json({
    ok: true,
    processed,
    updated,
    skippedPrivate,
    unresolved,
    matchedExisting,
    resolvedExternal,
    remainingMissing,
    dryRun,
  });
}
