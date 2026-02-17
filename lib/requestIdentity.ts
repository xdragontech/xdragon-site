// lib/requestIdentity.ts
// Shared request identity helpers for API routes.

import type { NextApiRequest } from "next";

type ReqLike = NextApiRequest | { headers?: any; socket?: any; connection?: any };

export function getHeader(req: ReqLike, name: string): string | undefined {
  const headers = (req as any)?.headers;
  if (!headers) return undefined;

  const key = name.toLowerCase();
  const val = headers[key] ?? headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0];
  if (typeof val === "string") return val;
  return undefined;
}

export function getClientIp(req: ReqLike): string {
  // Cloudflare (proxied): CF-Connecting-IP is the true client IP.
  const cfIp = getHeader(req, "cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Proxies: x-forwarded-for is usually a comma-separated list.
  const xff = getHeader(req, "x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = getHeader(req, "x-real-ip");
  if (realIp) return realIp.trim();

  // Node req sometimes has socket/connection
  const socketIp = (req as any)?.socket?.remoteAddress || (req as any)?.connection?.remoteAddress;
  if (typeof socketIp === "string" && socketIp) return socketIp;

  return "unknown";
}

export function getCfCountryIso2(req: ReqLike): string | null {
  const c = getHeader(req, "cf-ipcountry");
  if (!c) return null;
  const v = c.trim().toUpperCase();
  // Cloudflare uses "XX" for unknown.
  if (!v || v === "XX") return null;
  return v;
}

export function iso2ToCountryName(iso2: string | null): string | null {
  if (!iso2) return null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (dn.of(iso2) as string) || null;
  } catch {
    return null;
  }
}

export function getUserAgent(req: ReqLike): string {
  return getHeader(req, "user-agent")?.trim() || "";
}
