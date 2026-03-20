import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { BackofficeRole, type Brand } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import {
  getBackofficeIdentityFromSession,
  type BackofficeIdentityState,
} from "./backofficeIdentity";
import { getSessionEmail, getSessionUsername, isBackofficeSession } from "./authScopes";
import { prisma } from "./prisma";

type RequireBackofficeOptions = {
  callbackUrl?: string;
  superadminOnly?: boolean;
};

type BrandSelectionInput =
  | {
      brandId?: unknown;
      brandKey?: unknown;
    }
  | null
  | undefined;

function normalizeRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function buildAdminRedirect(callbackUrl?: string) {
  const target = callbackUrl || "/admin/library";
  return {
    redirect: {
      destination: `/admin/signin?callbackUrl=${encodeURIComponent(target)}`,
      permanent: false,
    },
  } as const;
}

async function loadResolvedPrincipal(
  session: any,
  options?: RequireBackofficeOptions
): Promise<BackofficeIdentityState | null> {
  if (!isBackofficeSession(session)) return null;

  const principal = await getBackofficeIdentityFromSession(session);
  if (!principal) return null;
  if (options?.superadminOnly && principal.role !== BackofficeRole.SUPERADMIN) return null;

  return principal;
}

export async function requireBackofficeApi(
  req: NextApiRequest,
  res: NextApiResponse,
  options?: RequireBackofficeOptions
) {
  const session = await getServerSession(req, res, authOptions as any);
  const principal = await loadResolvedPrincipal(session, options);

  if (!principal) {
    return { ok: false as const, session, principal: null };
  }

  return { ok: true as const, session, principal };
}

export async function requireBackofficePage(
  ctx: GetServerSidePropsContext,
  options?: RequireBackofficeOptions
) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);
  const principal = await loadResolvedPrincipal(session, options);

  if (!principal) {
    return {
      ok: false as const,
      session,
      principal: null,
      response: buildAdminRedirect(options?.callbackUrl || ctx.resolvedUrl || "/admin/library"),
    };
  }

  return {
    ok: true as const,
    session,
    principal,
    response: null,
    loggedInAs: getSessionEmail(session) || getSessionUsername(session) || principal.displayName,
  };
}

async function resolveRequestedBrand(raw: BrandSelectionInput): Promise<Pick<Brand, "id" | "brandKey"> | null> {
  const brandId = normalizeRecordId(raw?.brandId);
  if (brandId) {
    return prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, brandKey: true },
    });
  }

  const brandKey = normalizeBrandKey(raw?.brandKey);
  if (brandKey) {
    return prisma.brand.findUnique({
      where: { brandKey },
      select: { id: true, brandKey: true },
    });
  }

  return null;
}

export function canBackofficeAccessBrand(principal: BackofficeIdentityState, brandId: string | null | undefined): boolean {
  if (!brandId) return principal.role === BackofficeRole.SUPERADMIN;
  return principal.role === BackofficeRole.SUPERADMIN || principal.allowedBrandIds.includes(brandId);
}

export function assertBackofficeBrandAccess(principal: BackofficeIdentityState, brandId: string | null | undefined) {
  if (!canBackofficeAccessBrand(principal, brandId)) {
    throw new Error("You do not have access to that brand");
  }
}

export async function resolveBackofficeReadFilter(
  principal: BackofficeIdentityState,
  raw?: BrandSelectionInput,
  field = "brandId"
): Promise<Record<string, any>> {
  const selected = await resolveRequestedBrand(raw);
  if (selected) {
    assertBackofficeBrandAccess(principal, selected.id);
    return { [field]: selected.id };
  }

  if (principal.role === BackofficeRole.SUPERADMIN) {
    return {};
  }

  return {
    [field]: {
      in: principal.allowedBrandIds,
    },
  };
}

export async function resolveBackofficeWriteBrandId(
  principal: BackofficeIdentityState,
  raw?: BrandSelectionInput,
  options?: {
    allowSingleBrandFallback?: boolean;
  }
): Promise<string> {
  const selected = await resolveRequestedBrand(raw);
  if (selected) {
    assertBackofficeBrandAccess(principal, selected.id);
    return selected.id;
  }

  if (!options?.allowSingleBrandFallback) {
    throw new Error("Brand selection is required");
  }

  if (principal.role === BackofficeRole.SUPERADMIN) {
    const brands = await prisma.brand.findMany({
      select: { id: true },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
    });

    if (brands.length === 0) {
      throw new Error("No brand is configured. Run the brand sync before creating brand-scoped records.");
    }

    if (brands.length > 1) {
      throw new Error("Brand selection is required once multiple brands exist.");
    }

    return brands[0].id;
  }

  if (principal.allowedBrandIds.length === 0) {
    throw new Error("No brand access is assigned to this staff account");
  }

  if (principal.allowedBrandIds.length > 1) {
    throw new Error("Brand selection is required once multiple brands are assigned.");
  }

  return principal.allowedBrandIds[0];
}
