import bcrypt from "bcryptjs";
import {
  BrandStatus,
  ExternalUserStatus,
  UserStatus,
  type Prisma,
  type User,
} from "@prisma/client";
import type { NextApiRequest } from "next";
import { prisma } from "./prisma";
import { type PublicBrandContext, resolvePublicBrandContext } from "./brandContext";
import {
  EXTERNAL_AUTH_SCOPE,
  EXTERNAL_LEGACY_AUTH_SCOPE,
  getAuthScope,
  getSessionBrandKey,
  isExternalSession,
} from "./authScopes";
import { getCfCountryIso2, getClientIp, getUserAgent, iso2ToCountryName } from "./requestIdentity";
import { getBrandSiteConfig } from "./siteConfig";

type ExternalUserWithBrand = Prisma.ExternalUserGetPayload<{
  include: {
    brand: {
      select: {
        id: true;
        brandKey: true;
        name: true;
        status: true;
      };
    };
  };
}>;

type LegacyExternalSeed = Pick<
  User,
  "id" | "email" | "name" | "passwordHash" | "status" | "emailVerified" | "createdAt" | "lastLoginAt"
>;

export type ExternalIdentityState = {
  id: string;
  email: string | null;
  name: string | null;
  brandId: string;
  brandKey: string;
  brandName: string;
  status: ExternalUserStatus;
};

export type ExternalAuthUser = {
  id: string;
  email?: string;
  name: string;
  role: "USER";
  status: ExternalUserStatus;
  authScope: typeof EXTERNAL_AUTH_SCOPE;
  brandKey: string;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function getLegacyExternalBridgeBrandKey(): string {
  return normalizeBrandKey(getBrandSiteConfig().brandKey) || "xdragon";
}

function canBridgeLegacyExternalUser(brandKey: string): boolean {
  return normalizeBrandKey(brandKey) === getLegacyExternalBridgeBrandKey();
}

function requireBrandId(brand: Pick<PublicBrandContext, "brandId" | "brandKey">): string {
  if (!brand.brandId) {
    throw new Error(`Brand ${brand.brandKey} is missing a persisted brand record`);
  }
  return brand.brandId;
}

function toExternalIdentityState(user: ExternalUserWithBrand): ExternalIdentityState {
  return {
    id: user.id,
    email: user.email || null,
    name: user.name || null,
    brandId: user.brandId,
    brandKey: user.brand.brandKey,
    brandName: user.brand.name,
    status: user.status,
  };
}

function isExternalUserAccessible(user: ExternalUserWithBrand | null | undefined): user is ExternalUserWithBrand {
  return Boolean(user && user.brand.status === BrandStatus.ACTIVE);
}

function toExternalAuthUser(user: ExternalUserWithBrand): ExternalAuthUser {
  const state = toExternalIdentityState(user);
  return {
    id: state.id,
    email: state.email || undefined,
    name: state.name || state.email || state.brandName,
    role: "USER",
    status: state.status,
    authScope: EXTERNAL_AUTH_SCOPE,
    brandKey: state.brandKey,
  };
}

async function fetchExternalUserById(id: string): Promise<ExternalUserWithBrand | null> {
  if (!id) return null;
  return prisma.externalUser.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function fetchExternalUserByBrandAndEmail(brandId: string, email: string): Promise<ExternalUserWithBrand | null> {
  return prisma.externalUser.findFirst({
    where: {
      brandId,
      email,
    },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function fetchExternalUserByBrandKeyAndEmail(brandKey: string, email: string): Promise<ExternalUserWithBrand | null> {
  return prisma.externalUser.findFirst({
    where: {
      email,
      brand: {
        brandKey,
      },
    },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function fetchEligibleLegacyExternalUser(email: string): Promise<LegacyExternalSeed | null> {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
}

async function ensureExternalUserFromLegacy(
  brand: Pick<PublicBrandContext, "brandId" | "brandKey" | "brandName">,
  legacy: LegacyExternalSeed
): Promise<ExternalUserWithBrand> {
  const brandId = requireBrandId(brand);
  const email = normalizeEmail(legacy.email);
  const passwordHash = legacy.passwordHash;

  if (!email || !passwordHash) {
    throw new Error("Legacy external user is missing required credentials");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.externalUser.findFirst({
      where: {
        brandId,
        email,
      },
      include: {
        brand: {
          select: {
            id: true,
            brandKey: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (existing) {
      if (!existing.legacyUserId || existing.legacyUserId !== legacy.id) {
        return tx.externalUser.update({
          where: { id: existing.id },
          data: { legacyUserId: existing.legacyUserId || legacy.id },
          include: {
            brand: {
              select: {
                id: true,
                brandKey: true,
                name: true,
                status: true,
              },
            },
          },
        });
      }
      return existing;
    }

    return tx.externalUser.create({
      data: {
        brandId,
        legacyUserId: legacy.id,
        email,
        name: legacy.name || null,
        passwordHash,
        emailVerified: legacy.emailVerified,
        status: legacy.status === UserStatus.BLOCKED ? ExternalUserStatus.BLOCKED : ExternalUserStatus.ACTIVE,
        createdAt: legacy.createdAt,
        lastLoginAt: legacy.lastLoginAt,
      },
      include: {
        brand: {
          select: {
            id: true,
            brandKey: true,
            name: true,
            status: true,
          },
        },
      },
    });
  });
}

async function maybeBridgeLegacyExternalUser(
  brand: Pick<PublicBrandContext, "brandId" | "brandKey" | "brandName">,
  email: string
): Promise<ExternalUserWithBrand | null> {
  if (!canBridgeLegacyExternalUser(brand.brandKey)) return null;

  const legacy = await fetchEligibleLegacyExternalUser(email);
  if (!legacy) return null;

  return ensureExternalUserFromLegacy(brand, legacy);
}

async function recordExternalLogin(user: ExternalUserWithBrand, req: Pick<NextApiRequest, "headers">): Promise<void> {
  try {
    const ip = getClientIp(req);
    const countryIso2 = getCfCountryIso2(req);
    const countryName = iso2ToCountryName(countryIso2);
    const userAgent = getUserAgent(req);

    await prisma.$transaction([
      prisma.externalUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.externalLoginEvent.create({
        data: {
          externalUserId: user.id,
          brandId: user.brandId,
          ip,
          userAgent,
          countryIso2,
          countryName,
        },
      }),
    ]);
  } catch (error) {
    console.warn("External user login telemetry write failed:", error);
  }
}

export async function findOrBridgeExternalUserByEmail(
  brand: Pick<PublicBrandContext, "brandId" | "brandKey" | "brandName">,
  email: string
): Promise<ExternalUserWithBrand | null> {
  const brandId = requireBrandId(brand);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const external = await fetchExternalUserByBrandAndEmail(brandId, normalizedEmail);
  if (external) return external;

  return maybeBridgeLegacyExternalUser(brand, normalizedEmail);
}

export async function authorizeExternalCredentials(
  credentials: Record<string, unknown> | undefined,
  req: Pick<NextApiRequest, "headers">
): Promise<ExternalAuthUser | null> {
  const brand = await resolvePublicBrandContext(req as NextApiRequest);
  if (!brand || brand.status !== BrandStatus.ACTIVE) return null;

  const email = normalizeEmail(credentials?.email);
  const password = String(credentials?.password || "");
  if (!email || !password) return null;

  const user = await findOrBridgeExternalUserByEmail(brand, email);
  if (!user) return null;
  if (user.status === ExternalUserStatus.BLOCKED) return null;
  if (!user.emailVerified) return null;
  if (!user.passwordHash) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  await recordExternalLogin(user, req);
  return toExternalAuthUser(user);
}

export async function refreshExternalIdentity(sessionLike: {
  sub?: string | null;
  email?: string | null;
  brandKey?: string | null;
  authScope?: string | null;
}): Promise<ExternalAuthUser | null> {
  const tokenId = typeof sessionLike.sub === "string" ? sessionLike.sub : "";
  if (tokenId) {
    const user = await fetchExternalUserById(tokenId);
    if (isExternalUserAccessible(user)) return toExternalAuthUser(user);
    if (user) return null;
  }

  const email = normalizeEmail(sessionLike.email);
  if (!email) return null;

  const brandKey = normalizeBrandKey(sessionLike.brandKey);
  if (brandKey) {
    const user = await fetchExternalUserByBrandKeyAndEmail(brandKey, email);
    if (isExternalUserAccessible(user)) return toExternalAuthUser(user);
    if (user) return null;
  }

  const matches = await prisma.externalUser.findMany({
    where: { email },
    take: 2,
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (matches.length === 1 && isExternalUserAccessible(matches[0])) {
    return toExternalAuthUser(matches[0]);
  }

  if (matches.length === 0 && sessionLike.authScope === EXTERNAL_LEGACY_AUTH_SCOPE) {
    const bridgeBrandKey = getLegacyExternalBridgeBrandKey();
    const bridgeBrand = await prisma.brand.findUnique({
      where: { brandKey: bridgeBrandKey },
      select: {
        id: true,
        brandKey: true,
        name: true,
      },
    });

    if (bridgeBrand) {
      const bridged = await maybeBridgeLegacyExternalUser(
        {
          brandId: bridgeBrand.id,
          brandKey: bridgeBrand.brandKey,
          brandName: bridgeBrand.name,
        },
        email
      );

      if (bridged) return toExternalAuthUser(bridged);
    }
  }

  return null;
}

export async function getExternalIdentityFromSession(session: any): Promise<ExternalIdentityState | null> {
  if (!isExternalSession(session)) return null;

  const hydrated = await refreshExternalIdentity({
    sub: session?.user?.id || session?.id || session?.sub || null,
    email: session?.user?.email || session?.email || null,
    brandKey: getSessionBrandKey(session),
    authScope: getAuthScope(session),
  });

  if (!hydrated) return null;

  const user = await fetchExternalUserById(hydrated.id);
  return isExternalUserAccessible(user) ? toExternalIdentityState(user) : null;
}
