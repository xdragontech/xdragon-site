import type { NextRequest } from "next/server";
import type { IncomingHttpHeaders } from "http";

function firstValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function normalizeHost(value: string | null | undefined): string {
  return String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

type HeadersCarrier = {
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
};

export function getApiRequestHost(req: HeadersCarrier): string {
  return normalizeHost(firstValue(req.headers["x-forwarded-host"]) || firstValue(req.headers.host));
}

export function getMiddlewareRequestHost(req: NextRequest): string {
  return normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host"));
}

export function getApiRequestProtocol(req: HeadersCarrier): string {
  const proto = firstValue(req.headers["x-forwarded-proto"]).trim().toLowerCase();
  if (proto === "http" || proto === "https") return proto;
  return "https";
}

export function buildOrigin(protocol: string, host: string): string {
  const safeProtocol = protocol === "http" ? "http" : "https";
  return `${safeProtocol}://${normalizeHost(host)}`;
}
