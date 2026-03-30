import type { NextApiRequest, NextApiResponse } from "next";
import { BrandStatus } from "@prisma/client";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol, normalizeHost } from "./requestHost";
import { getRuntimeHostConfig } from "./runtimeHostConfig";

export type BrandEnvironment = "production" | "preview";

export type PublicBrandContext = {
  brandId?: string;
  brandKey: string;
  brandName: string;
  status: BrandStatus | "ACTIVE";
  environment: BrandEnvironment;
  matchedHost: string;
  canonicalPublicHost: string;
  canonicalAdminHost: string;
  apexHost: string;
};

export type BackofficeBrandScope = {
  allowedBrandKeys: string[];
  lastSelectedBrandKey?: string | null;
};

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function createBackofficeBrandScope(
  allowedBrandKeys: string[],
  lastSelectedBrandKey?: string | null
): BackofficeBrandScope {
  const normalizedKeys = Array.from(
    new Set(
      allowedBrandKeys
        .map((value) => normalizeBrandKey(value))
        .filter((value): value is string => Boolean(value))
    )
  );

  const selected = normalizeBrandKey(lastSelectedBrandKey);
  return {
    allowedBrandKeys: normalizedKeys,
    lastSelectedBrandKey: selected && normalizedKeys.includes(selected) ? selected : null,
  };
}

export function canAccessBrand(scope: BackofficeBrandScope, brandKey: string | null | undefined): boolean {
  const normalized = normalizeBrandKey(brandKey);
  if (!normalized) return false;
  return scope.allowedBrandKeys.includes(normalized);
}

export async function resolvePublicBrandContextForHost(host: string): Promise<PublicBrandContext | null> {
  const config = await getRuntimeHostConfig(host);
  const runtime = config.runtime;
  if (!runtime) return null;

  return {
    brandId: runtime.brandId,
    brandKey: normalizeBrandKey(runtime.brandKey) || runtime.brandKey,
    brandName: runtime.brandName,
    status: runtime.status,
    environment: runtime.environment,
    matchedHost: normalizeHost(runtime.matchedHost),
    canonicalPublicHost: normalizeHost(runtime.canonicalPublicHost),
    canonicalAdminHost: normalizeHost(runtime.canonicalAdminHost),
    apexHost: normalizeHost(runtime.apexHost),
  };
}

export async function resolvePublicBrandContext(req: NextApiRequest): Promise<PublicBrandContext | null> {
  return resolvePublicBrandContextForHost(getApiRequestHost(req));
}

export function getCanonicalPublicOrigin(req: NextApiRequest, brand: PublicBrandContext): string {
  return buildOrigin(getApiRequestProtocol(req), brand.canonicalPublicHost);
}

export function getRequestedBrandKey(req: NextApiRequest): string | null {
  const fromHeader = normalizeBrandKey(req.headers["x-brand-key"]);
  if (fromHeader) return fromHeader;

  const queryValue = Array.isArray(req.query?.brandKey) ? req.query.brandKey[0] : req.query?.brandKey;
  const fromQuery = normalizeBrandKey(queryValue);
  if (fromQuery) return fromQuery;

  return normalizeBrandKey((req.body || {}).brandKey);
}

export type EnsuredPublicBrandRequest = {
  brand: PublicBrandContext;
  requestedBrandKey: string | null;
};

export async function ensurePublicBrandRequest(
  req: NextApiRequest,
  res: NextApiResponse<any>
): Promise<EnsuredPublicBrandRequest | null> {
  const brand = await resolvePublicBrandContext(req);
  if (!brand) {
    res.status(403).json({ ok: false, error: "Unknown brand host" });
    return null;
  }

  if (brand.status !== BrandStatus.ACTIVE) {
    res.status(403).json({ ok: false, error: "Brand is not active" });
    return null;
  }

  const requestedBrandKey = getRequestedBrandKey(req);
  if (requestedBrandKey && requestedBrandKey !== brand.brandKey) {
    res.status(409).json({ ok: false, error: "Brand mismatch for request host" });
    return null;
  }

  return { brand, requestedBrandKey };
}
