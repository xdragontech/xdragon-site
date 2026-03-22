import type { NextApiRequest, NextApiResponse } from "next";
import { ensurePublicBrandRequest } from "../../lib/brandContext";
import { resolveBrandEmailConfig, sendBrandEmail, type BrandEmailRuntimeConfig } from "../../lib/brandEmail";
import {
  commandPublicContact,
  isCommandPublicApiEnabled,
  CommandPublicApiError,
} from "../../lib/commandPublicApi";

type PrismaMod = { prisma?: any; default?: any };

async function getPrisma() {
  const mod: PrismaMod = await import("../../lib/prisma");
  return (mod as any).prisma ?? (mod as any).default;
}

/**
 * Basic Upstash Redis rate limiting (fixed-window).
 * - Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
 * - If env vars are missing, rate limiting is skipped (no-op).
 */
function getClientIp(req: NextApiRequest): string {
  const cf = (req.headers["cf-connecting-ip"] as string) || "";
  if (cf) return cf;
  const xf = (req.headers["x-forwarded-for"] || "") as string;
  const first = xf.split(",")[0]?.trim();
  return (
    first ||
    (req.headers["x-real-ip"] as string) ||
    (req.socket.remoteAddress as string) ||
    "unknown"
  );
}

function getCfCountry(req: NextApiRequest): { iso2: string | null; name: string | null } {
  const iso2 = String(req.headers["cf-ipcountry"] || "").trim().toUpperCase();
  if (!iso2 || iso2 === "XX") return { iso2: null, name: null };
  let name: string | null = null;
  try {
    // eslint-disable-next-line no-undef
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    name = dn.of(iso2) || null;
  } catch {
    name = null;
  }
  return { iso2, name };
}

async function upstashIncr(key: string): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const resp = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) return null;
    const data = (await resp.json()) as { result?: number };
    return typeof data?.result === "number" ? data.result : null;
  } catch (error) {
    console.warn("Contact rate limit increment failed; allowing request", error);
    return null;
  }
}

async function upstashExpire(key: string, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}


async function upstashLpush(key: string, value: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/lpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function upstashLtrim(key: string, start: number, stop: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/ltrim/${encodeURIComponent(key)}/${start}/${stop}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

/**
 * Lightweight lead logging (backup trail beyond email).
 * Stores JSON events in Upstash Redis list keys:
 * - leadlog:contact
 * - leadlog:chat
 *
 * Keeps the latest 1000 events, TTL 90 days.
 */
async function logLeadEvent(kind: "contact" | "chat", payload: Record<string, unknown>): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const key = `leadlog:${kind}`;
  const entry = JSON.stringify(payload);

  await upstashLpush(key, entry);
  await upstashLtrim(key, 0, 999);
  await upstashExpire(key, 60 * 60 * 24 * 90);
}

type RateLimitConfig = {
  name: string; // route name
  perMinute: number;
  perHour: number;
  scopeKey?: string | null;
};

async function enforceRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  cfg: RateLimitConfig
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // no-op if not configured

  try {
    const ip = getClientIp(req);

    const now = Date.now();
    const minuteWindow = Math.floor(now / 60_000);
    const hourWindow = Math.floor(now / 3_600_000);

    const scope = cfg.scopeKey ? `${cfg.scopeKey}:` : "";
    const minuteKey = `rl:${cfg.name}:${scope}m:${minuteWindow}:${ip}`;
    const hourKey = `rl:${cfg.name}:${scope}h:${hourWindow}:${ip}`;

    const minuteCount = await upstashIncr(minuteKey);
    if (minuteCount === 1) await upstashExpire(minuteKey, 60);

    const hourCount = await upstashIncr(hourKey);
    if (hourCount === 1) await upstashExpire(hourKey, 3600);

    const minuteExceeded = typeof minuteCount === "number" && minuteCount > cfg.perMinute;
    const hourExceeded = typeof hourCount === "number" && hourCount > cfg.perHour;

    if (minuteExceeded || hourExceeded) {
      const retryAfter = minuteExceeded ? 60 : 3600;
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        ok: false,
        error: "Rate limit exceeded. Please try again shortly.",
      } as any);
      return false;
    }
  } catch (error) {
    console.warn("Contact rate limiting failed; allowing request", error);
  }

  return true;
}


type Data =
  | { ok: true; id?: string; notification?: "sent" | "deferred" }
  | { ok: false; error: string; details?: unknown };

function isEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function cleanStr(v: unknown, max = 2000) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

async function sendContactNotification(params: {
  config: BrandEmailRuntimeConfig;
  brandName: string;
  brandKey: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  sourceIp: string;
}) {
  const subject = `${params.brandName}: New contact request — ${params.name}`;
  const text = [
    `Brand: ${params.brandName} (${params.brandKey})`,
    "",
    "New website contact request:",
    "",
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    params.phone ? `Phone: ${params.phone}` : "Phone: (not provided)",
    "",
    "Message:",
    params.message,
    "",
    `Sent from: ${params.sourceIp}`,
  ].join("\n");

  return sendBrandEmail({
    config: params.config,
    to: params.config.supportEmails,
    subject,
    text,
    replyTo: params.email,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (isCommandPublicApiEnabled()) {
    try {
      const result = await commandPublicContact({
        name: cleanStr(req.body?.name, 200),
        email: cleanStr(req.body?.email, 320),
        phone: cleanStr(req.body?.phone, 80) || null,
        message: cleanStr(req.body?.message, 4000),
      });

      const status = result.ok && result.notification === "deferred" ? 202 : 200;
      return res.status(status).json(result);
    } catch (error) {
      if (error instanceof CommandPublicApiError) {
        return res.status(error.status).json({ ok: false, error: error.message });
      }
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }

  const brandRequest = await ensurePublicBrandRequest(req, res);
  if (!brandRequest) return;

  const { brand } = brandRequest;

  const _rlOk = await enforceRateLimit(req, res, {
    name: "contact",
    perMinute: 5,
    perHour: 40,
    scopeKey: brand.brandKey,
  });
  if (!_rlOk) return;

  const name = cleanStr(req.body?.name, 200);
  const email = cleanStr(req.body?.email, 320);
  const phone = cleanStr(req.body?.phone, 80);
  const message = cleanStr(req.body?.message, 4000);
  let capturedLeadId: string | undefined;

  if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
  if (!isEmail(email)) return res.status(400).json({ ok: false, error: "Valid email is required" });
  if (!message) return res.status(400).json({ ok: false, error: "Message is required" });

  const notificationConfig = await resolveBrandEmailConfig(brand, "notification");
  if (!notificationConfig.ok) {
    return res.status(notificationConfig.status).json({ ok: false, error: notificationConfig.error });
  }

  try {
    const ip = getClientIp(req);
    const userAgent = cleanStr(req.headers["user-agent"], 400);

    // Durable record in Postgres for cross-referencing / records.
    // Dedupe rule: (email + createdAt day).
    try {
      const prisma = await getPrisma();
      if (!prisma?.lead) throw new Error("Prisma client missing Lead model");

      const normalizedEmail = String(email || "").trim().toLowerCase();
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const existing = await prisma.lead.findFirst({
        where: {
          source: "CONTACT",
          email: normalizedEmail,
          createdAt: { gte: dayStart, lt: dayEnd },
          ...(brand.brandId
            ? {
                OR: [{ brandId: brand.brandId }, { brandId: null }],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      // NOTE: Keep DB schema coupling minimal.
      // The Lead model can evolve; do not assume extra scalar columns like
      // userAgent/message exist. Full context remains available via email + Redis log.

      const cc = getCfCountry(req);
      const ua = cleanStr(req.headers["user-agent"], 400);
      const referer = cleanStr(req.headers["referer"], 600);

      let leadId: string | null = null;

      if (existing?.id) {
        const updated = await prisma.lead.update({
          where: { id: existing.id },
          data: {
            ...(brand.brandId ? { brandId: brand.brandId } : {}),
            name,
            email: normalizedEmail,
            ip,
          },
        });
        leadId = updated?.id || existing.id;
      } else {
        const created = await prisma.lead.create({
          data: {
            ...(brand.brandId ? { brandId: brand.brandId } : {}),
            source: "CONTACT",
            name,
            email: normalizedEmail,
            ip,
          },
        });
        leadId = created?.id || null;
      }

      // Append-only LeadEvent (source of truth for the Leads table + analytics)
      if (prisma?.leadEvent) {
        await prisma.leadEvent.create({
          data: {
            ...(brand.brandId ? { brandId: brand.brandId } : {}),
            source: "CONTACT",
            leadId: leadId || undefined,
            ip,
            countryIso2: cc.iso2,
            countryName: cc.name,
            userAgent: ua || null,
            referer: referer || null,
            raw: {
              name,
              email: normalizedEmail,
              phone: phone || null,
              message,
              brandId: brand.brandId || null,
              brandKey: brand.brandKey,
              brandHost: brand.matchedHost,
              brandEnvironment: brand.environment,
            },
          },
        });
      }

      capturedLeadId = leadId || undefined;
    } catch (e) {
      // Do not block contact email delivery on DB issues.
      console.error("Contact lead DB write failed", e);
    }

    // Backup trail in Redis (if configured)
    logLeadEvent("contact", {
      brandId: brand.brandId || null,
      brandKey: brand.brandKey,
      brandHost: brand.matchedHost,
      brandEnvironment: brand.environment,
      name,
      email,
      phone: phone || null,
      message,
      ip,
      userAgent,
      ts: new Date().toISOString(),
    }).catch(() => {});

    const result = await sendContactNotification({
      config: notificationConfig.config,
      brandName: brand.brandName,
      brandKey: brand.brandKey,
      name,
      email,
      phone,
      message,
      sourceIp: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown IP"),
    });

    const id =
      (result as any)?.data?.id ||
      (result as any)?.id ||
      undefined;

    return res.status(200).json({ ok: true, id, notification: "sent" });
  } catch (e) {
    console.error("Contact email send failed", e);
    if (capturedLeadId) {
      return res.status(202).json({ ok: true, id: capturedLeadId, notification: "deferred" });
    }

    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
}
