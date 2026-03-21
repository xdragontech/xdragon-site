import bcrypt from "bcryptjs";
import {
  BackofficeMfaMethod,
  BackofficeRole,
  BackofficeUserStatus,
  BrandStatus,
  type Prisma,
} from "@prisma/client";
import { deriveBackofficeMfaState, type BackofficeMfaState } from "./backofficeMfa";
import { prisma } from "./prisma";
import { BACKOFFICE_AUTH_SCOPE, getAuthScope } from "./authScopes";

const XDADMIN_ID = "xdadmin";

type BrandAccessRow = {
  id: string;
  brandKey: string;
  status: BrandStatus;
};

type BackofficeUserWithAccess = Prisma.BackofficeUserGetPayload<{
  include: {
    brandAccesses: {
      include: {
        brand: {
          select: {
            id: true;
            brandKey: true;
            status: true;
          };
        };
      };
    };
  };
}>;

export type BackofficeIdentityState = {
  id: string;
  email: string | null;
  username: string;
  role: BackofficeRole;
  status: BackofficeUserStatus;
  mfaMethod: BackofficeMfaMethod | null;
  mfaState: BackofficeMfaState;
  mfaEnabledAt: string | null;
  allowedBrandIds: string[];
  allowedBrandKeys: string[];
  lastSelectedBrandKey: string | null;
  displayName: string;
  isEnvSuperadmin: boolean;
};

export type BackofficeAuthUser = {
  id: string;
  email?: string;
  name: string;
  username: string;
  role: "ADMIN";
  backofficeRole: BackofficeRole;
  status: BackofficeUserStatus;
  authScope: typeof BACKOFFICE_AUTH_SCOPE;
  mfaMethod: BackofficeMfaMethod | null;
  mfaState: BackofficeMfaState;
  mfaEnabledAt: string | null;
  allowedBrandIds: string[];
  allowedBrandKeys: string[];
  lastSelectedBrandKey: string | null;
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toDisplayName(user: { username: string; email: string | null }) {
  return user.email || user.username;
}

function getAccessibleBrands(rows: Array<{ brand: BrandAccessRow }>): BrandAccessRow[] {
  return rows
    .map((row) => row.brand)
    .filter((brand) => brand && brand.status !== BrandStatus.DISABLED);
}

function toBackofficeIdentityState(user: BackofficeUserWithAccess): BackofficeIdentityState {
  const accessibleBrands = getAccessibleBrands(user.brandAccesses);
  const allowedBrandIds = accessibleBrands.map((brand) => brand.id);
  const allowedBrandKeys = accessibleBrands.map((brand) => brand.brandKey);

  return {
    id: user.id,
    email: user.email || null,
    username: user.username,
    role: user.role,
    status: user.status,
    mfaMethod: user.mfaMethod || null,
    mfaState: deriveBackofficeMfaState({
      mfaMethod: user.mfaMethod,
      mfaEnabledAt: user.mfaEnabledAt,
      mfaSecretEncrypted: user.mfaSecretEncrypted,
      mfaRecoveryCodesEncrypted: user.mfaRecoveryCodesEncrypted,
    }),
    mfaEnabledAt: user.mfaEnabledAt ? user.mfaEnabledAt.toISOString() : null,
    allowedBrandIds,
    allowedBrandKeys,
    lastSelectedBrandKey:
      user.lastSelectedBrandKey && allowedBrandKeys.includes(user.lastSelectedBrandKey)
        ? user.lastSelectedBrandKey
        : null,
    displayName: toDisplayName(user),
    isEnvSuperadmin: false,
  };
}

function toBackofficeAuthUser(state: BackofficeIdentityState): BackofficeAuthUser {
  return {
    id: state.id,
    email: state.email || undefined,
    name: state.displayName,
    username: state.username,
    role: "ADMIN",
    backofficeRole: state.role,
    status: state.status,
    authScope: BACKOFFICE_AUTH_SCOPE,
    mfaMethod: state.mfaMethod,
    mfaState: state.mfaState,
    mfaEnabledAt: state.mfaEnabledAt,
    allowedBrandIds: state.allowedBrandIds,
    allowedBrandKeys: state.allowedBrandKeys,
    lastSelectedBrandKey: state.lastSelectedBrandKey,
  };
}

export function getXdAdminIdentity() {
  const username = normalizeUsername(process.env.XDADMIN_USERNAME || "xdadmin");
  const email = normalizeEmail(process.env.XDADMIN_EMAIL || "xdadmin@xdragon.tech");
  const password = process.env.XDADMIN_PASSWORD || "";
  return { id: XDADMIN_ID, username, email, password };
}

export function isEnvAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL_LIST || process.env.ADMIN_USERS || "";
  const allowed = new Set(
    raw
      .split(/[,\s]+/)
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
  );

  return allowed.has(normalized);
}

export function isProtectedBackofficeIdentity(email: string | null | undefined, username: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  const xd = getXdAdminIdentity();

  return Boolean(
    (normalizedEmail && (normalizedEmail === xd.email || isEnvAdminEmail(normalizedEmail))) ||
    (normalizedUsername && normalizedUsername === xd.username)
  );
}

async function listActiveBrandAccessRows(
  tx: Pick<typeof prisma, "brand"> = prisma
): Promise<Array<{ id: string; brandKey: string }>> {
  return tx.brand.findMany({
    where: { status: { not: BrandStatus.DISABLED } },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, brandKey: true },
  });
}

async function fetchBackofficeUserByIdentifier(identifier: string): Promise<BackofficeUserWithAccess | null> {
  return prisma.backofficeUser.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
    include: {
      brandAccesses: {
        include: {
          brand: {
            select: {
              id: true,
              brandKey: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

async function fetchBackofficeUserById(id: string): Promise<BackofficeUserWithAccess | null> {
  return prisma.backofficeUser.findUnique({
    where: { id },
    include: {
      brandAccesses: {
        include: {
          brand: {
            select: {
              id: true,
              brandKey: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

export async function authorizeBackofficeCredentials(
  credentials: Record<string, unknown> | undefined
): Promise<BackofficeAuthUser | null> {
  const identifierRaw = String(credentials?.email || credentials?.username || "").trim();
  const identifier = normalizeUsername(identifierRaw);
  const password = String(credentials?.password || "");

  if (!identifier || !password) return null;

  const xd = getXdAdminIdentity();
  if (identifier === xd.username || identifier === xd.email) {
    if (!xd.password || password !== xd.password) return null;
    const brands = await listActiveBrandAccessRows();
    return toBackofficeAuthUser({
      id: XDADMIN_ID,
      email: xd.email,
      username: xd.username,
      role: BackofficeRole.SUPERADMIN,
      status: BackofficeUserStatus.ACTIVE,
      mfaMethod: null,
      mfaState: "DISABLED",
      mfaEnabledAt: null,
      allowedBrandIds: brands.map((brand) => brand.id),
      allowedBrandKeys: brands.map((brand) => brand.brandKey),
      lastSelectedBrandKey: brands[0]?.brandKey || null,
      displayName: xd.email,
      isEnvSuperadmin: true,
    });
  }

  let user = await fetchBackofficeUserByIdentifier(identifier);

  if (!user) return null;
  if (user.status === BackofficeUserStatus.BLOCKED) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  await prisma.backofficeUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const state = toBackofficeIdentityState(user);
  if (state.role !== BackofficeRole.SUPERADMIN && state.allowedBrandIds.length === 0) {
    return null;
  }

  return toBackofficeAuthUser(state);
}
export async function refreshBackofficeIdentity(sessionLike: { sub?: string | null; email?: string | null }): Promise<BackofficeAuthUser | null> {
  const xd = getXdAdminIdentity();
  const tokenEmail = normalizeEmail(sessionLike.email);
  const tokenId = String(sessionLike.sub || "");

  if (tokenId === XDADMIN_ID || tokenEmail === xd.email) {
    const brands = await listActiveBrandAccessRows();
    return toBackofficeAuthUser({
      id: XDADMIN_ID,
      email: xd.email,
      username: xd.username,
      role: BackofficeRole.SUPERADMIN,
      status: BackofficeUserStatus.ACTIVE,
      mfaMethod: null,
      mfaState: "DISABLED",
      mfaEnabledAt: null,
      allowedBrandIds: brands.map((brand) => brand.id),
      allowedBrandKeys: brands.map((brand) => brand.brandKey),
      lastSelectedBrandKey: brands[0]?.brandKey || null,
      displayName: xd.email,
      isEnvSuperadmin: true,
    });
  }

  if (!tokenId) return null;

  const user = await fetchBackofficeUserById(tokenId);
  if (!user) return null;

  const state = toBackofficeIdentityState(user);
  if (state.role !== BackofficeRole.SUPERADMIN && state.allowedBrandIds.length === 0) {
    return null;
  }

  return toBackofficeAuthUser(state);
}

export async function getBackofficeIdentityFromSession(session: any): Promise<BackofficeIdentityState | null> {
  if (getAuthScope(session) !== BACKOFFICE_AUTH_SCOPE) return null;

  const hydrated = await refreshBackofficeIdentity({
    sub: session?.user?.id || session?.id || session?.sub || null,
    email: session?.user?.email || session?.email || null,
  });

  if (!hydrated) return null;

  return {
    id: hydrated.id,
    email: hydrated.email || null,
    username: hydrated.username,
    role: hydrated.backofficeRole,
    status: hydrated.status,
    mfaMethod: hydrated.mfaMethod,
    mfaState: hydrated.mfaState,
    mfaEnabledAt: hydrated.mfaEnabledAt,
    allowedBrandIds: hydrated.allowedBrandIds,
    allowedBrandKeys: hydrated.allowedBrandKeys,
    lastSelectedBrandKey: hydrated.lastSelectedBrandKey,
    displayName: hydrated.name,
    isEnvSuperadmin: hydrated.id === XDADMIN_ID,
  };
}
